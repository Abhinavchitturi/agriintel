from fastapi import APIRouter, HTTPException, Query, Request, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(5, ge=1, le=20)
    threshold: float = Field(0.7, ge=0.0, le=1.0)
    filter_category: Optional[str] = None
    filter_crop: Optional[str] = None


class RAGQueryResponse(BaseModel):
    results: List[Dict[str, Any]]
    count: int
    query_time_ms: float


@router.post("/query", response_model=RAGQueryResponse)
async def query_rag(request: RAGQueryRequest, http_request: Request):
    try:
        rag_service = http_request.app.state.rag_service
        
        import time
        start = time.time()
        
        results = await rag_service.search(
            request.query,
            top_k=request.top_k,
            threshold=request.threshold,
            filters={"category": request.filter_category, "crop": request.filter_crop} if request.filter_category or request.filter_crop else None
        )
        
        return RAGQueryResponse(
            results=[
                {"text": chunk.text, "metadata": chunk.metadata, "score": score}
                for chunk, score in results
            ],
            count=len(results),
            query_time_ms=(time.time() - start) * 1000,
        )
    except Exception as e:
        logger.error(f"RAG search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_rag(
    q: str = Query(..., min_length=1, description="Search query"),
    top_k: int = Query(5, ge=1, le=20),
    category: Optional[str] = Query(None, description="Filter by category"),
    crop: Optional[str] = Query(None, description="Filter by crop"),
    http_request: Request = None
):
    try:
        rag_service = http_request.app.state.rag_service
        results = await rag_service.search(q, top_k=top_k, filters={"category": category, "crop": crop} if category or crop else None)
        return {
            "query": q,
            "results": [
                {"text": chunk.text[:300], "metadata": chunk.metadata, "score": score}
                for chunk, score in results
            ],
        }
    except Exception as e:
        logger.error(f"RAG search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def get_categories():
    return {
        "categories": [
            "cereal", "pulse", "oilseed", "fiber", "vegetable", "fruit", "cash",
            "soil", "water", "pest", "weather", "general"
        ],
        "crops": [
            "rice", "wheat", "maize", "cotton", "sugarcane",
            "soybean", "groundnut", "mustard", "sunflower",
            "tomato", "potato", "onion", "chili", "turmeric",
            "mango", "banana", "citrus", "grape", "pomegranate",
            "chickpea", "pigeonpea", "lentil", "general",
        ],
        "seasons": ["kharif", "rabi", "zaid", "annual", "perennial", "multi", "all"],
    }


@router.get("/stats")
async def get_rag_stats(http_request: Request):
    try:
        rag_service = http_request.app.state.rag_service
        stats = rag_service.get_stats()
        return stats
    except Exception as e:
        logger.error(f"RAG stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rebuild")
async def rebuild_index(http_request: Request, x_admin_key: str = Header(alias="X-Admin-Key")):
    from app.config import settings
    if x_admin_key != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        rag_service = http_request.app.state.rag_service
        await rag_service._build_index()
        return {"status": "success", "message": "Index rebuilt successfully"}
    except Exception as e:
        logger.error(f"Index rebuild error: {e}")
        raise HTTPException(status_code=500, detail=str(e))