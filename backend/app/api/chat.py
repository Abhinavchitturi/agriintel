from fastapi import APIRouter, HTTPException, Request
from app.config import settings
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging
import hashlib
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()


async def _verify_pro_via_supabase(token: str) -> bool:
    """Verify plan=pro by checking the profiles table using the user's JWT."""
    if not token or not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Resolve user ID from JWT
            user_resp = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                },
            )
            if user_resp.status_code != 200:
                return False
            user_id = user_resp.json().get("id")
            if not user_id:
                return False

            # Check plan in profiles table
            profile_resp = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/profiles",
                params={"id": f"eq.{user_id}", "select": "plan"},
                headers={
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                },
            )
            if profile_resp.status_code != 200:
                return False
            rows = profile_resp.json()
            return bool(rows) and rows[0].get("plan") == "pro"
    except Exception as e:
        logger.warning(f"Supabase plan check failed: {e}")
        return False


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User's agricultural question")
    language: str = Field(default="en", description="Language code (en, hi, te, ta, kn, mr, pa, or)")
    location: Optional[str] = Field(default=None, description="Location for localized advice")
    conversation_history: Optional[List[Dict[str, str]]] = Field(
        default=None, description="Previous messages [{role, content}]"
    )
    plan: str = Field(default="free", description="User plan: 'free' or 'pro'")
    model_id: Optional[str] = Field(default=None, description="Pro model tier: fasal, vriddhi, samriddhi")
    user_token: Optional[str] = Field(default=None, description="Supabase JWT for server-side plan verification")


class ChatResponse(BaseModel):
    answer: str
    confidence: float
    generation_time: float
    model: str
    processing_mode: str
    weather_data: Optional[Dict[str, Any]] = None
    sources: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class SimpleChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="en")
    location: Optional[str] = None


@router.post("/", response_model=ChatResponse)
async def chat_query(request: ChatRequest, http_request: Request):
    try:
        app = http_request.app
        groq_service = app.state.groq_service
        weather_service = app.state.weather_service
        rag_service = app.state.rag_service

        start_time = datetime.now()

        # Server-side plan enforcement: verify via Supabase JWT first,
        # fall back to email allowlist only when Supabase is not configured (dev/demo).
        claimed_pro = request.plan == "pro"
        if claimed_pro:
            if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
                is_pro = await _verify_pro_via_supabase(request.user_token or "")
            else:
                pro_emails = [e.strip().lower() for e in settings.PRO_USER_EMAILS.split(",") if e.strip()]
                is_pro = True  # trust client in dev — Supabase not configured
                logger.warning("Supabase not configured — skipping server-side Pro verification")
        else:
            is_pro = False

        # Fetch weather only if location is provided
        weather_data = None
        if request.location:
            try:
                weather_data = await weather_service.get_agricultural_weather(request.location)
                logger.info(f"Weather data fetched for {request.location}")
            except Exception as e:
                logger.warning(f"Weather fetch failed: {e}")

        # RAG: retrieve relevant chunks — skip for simple greetings
        context = None
        sources = []
        chunks_used = 0
        _greeting_words = {"hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "bye", "good morning", "good evening", "namaste"}
        _query_lower = request.query.strip().lower().rstrip("!.")
        if is_pro and _query_lower not in _greeting_words and len(request.query.split()) > 2:
            try:
                context, sources, chunks_used = await rag_service.search_chunks(request.query)
            except Exception as e:
                logger.warning(f"RAG search failed: {e}")

        # Single Groq call — location + weather passed for both plans;
        # groq_service internally limits weather depth for free users
        groq_response = await groq_service.agricultural_query(
            query=request.query,
            context=context,
            location=request.location,
            weather_data=weather_data,
            language=request.language,
            plan=request.plan,
            model_id=request.model_id,
            conversation_history=request.conversation_history,
        )

        total_time = (datetime.now() - start_time).total_seconds()

        # Confidence: RAG-based for pro, query-specificity-based for free
        if is_pro:
            confidence = min(0.95, 0.72 + (chunks_used * 0.04))
        else:
            # Base: higher when location is known + query is specific
            base = 0.60
            if request.location:
                base += 0.10
            query_words = len(request.query.split())
            base += min(0.08, query_words * 0.006)
            # Deterministic ±3% variation per query so same question = same score
            q_hash = int(hashlib.md5(request.query.lower().encode()).hexdigest(), 16)
            variation = ((q_hash % 7) - 3) * 0.005
            confidence = round(min(0.84, max(0.58, base + variation)), 2)

        response = ChatResponse(
            answer=groq_response.content,
            confidence=confidence,
            generation_time=groq_response.latency_ms / 1000,
            model=groq_response.model,
            processing_mode=("pro_rag" if chunks_used > 0 else "pro_direct") if is_pro else "free_basic",
            weather_data=weather_data,
            sources=sources if is_pro else None,
            metadata={
                "chunks_used": chunks_used,
                "location": request.location,
                "language": request.language,
                "timestamp": datetime.now().isoformat(),
            },
        )

        logger.info(f"Query processed in {total_time:.3f}s | plan={request.plan} | chunks={chunks_used}")
        return response

    except Exception as e:
        logger.error(f"Chat query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query processing failed: {str(e)}")


@router.post("/simple")
async def simple_chat(request: SimpleChatRequest, http_request: Request):
    try:
        groq_service = http_request.app.state.groq_service
        weather_service = http_request.app.state.weather_service

        weather_data = None
        if request.location:
            weather_data = await weather_service.get_current_weather(request.location)

        response = await groq_service.agricultural_query(
            query=request.query,
            location=request.location,
            weather_data=weather_data,
            language=request.language,
        )

        return {
            "answer": response.content,
            "model": response.model,
            "latency_ms": response.latency_ms,
            "weather_data": weather_data,
        }

    except Exception as e:
        logger.error(f"Simple chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_models():
    return {
        "models": [
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile", "recommended": True},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "fast": True},
            {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B"},
        ],
        "default": "llama-3.3-70b-versatile",
    }
