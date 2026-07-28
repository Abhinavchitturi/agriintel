import asyncio
import logging
import time
from typing import Dict, Any, Optional, List
from groq import Groq
from dataclasses import dataclass

from app.config import settings

logger = logging.getLogger(__name__)

def _get_pro_model_map() -> dict:
    return {
        "fasal":     settings.GROQ_MODEL_FASAL,
        "vriddhi":   settings.GROQ_MODEL_VRIDDHI,
        "samriddhi": settings.GROQ_MODEL_SAMRIDDHI,
    }


@dataclass
class GroqResponse:
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str
    latency_ms: float


FREE_SYSTEM_PROMPT = """You are AgriIntel Starter, a free-tier farming assistant.

OUTPUT RULES:
1. Answer in 3-5 clear sentences. Be genuinely useful and practical.
2. Plain text ONLY — no markdown, no bullet points, no headers, no bold, no tables.
3. Cover the 2-3 most actionable points the farmer needs right now.
4. Do NOT repeat information already given in the conversation. If you already mentioned the current temperature or weather conditions in a previous message, skip that — give new, different advice instead.
5. If the user's question asks for something only available on Pro (7-day forecast, NPK schedules, pest alerts, crop stage plans), give a brief useful answer with what you can, then end with one short sentence: "For [specific feature they asked about], upgrade to Pro."

WEATHER: If weather data is provided and you have NOT already mentioned the temperature/conditions in this conversation, briefly state the current temperature and conditions, then give one direct farming implication. If you already shared weather info, skip repeating it and focus on new advice.

FACTUAL ACCURACY — CRITICAL:
- Never make absolute statements like "X crop cannot grow here." Instead, distinguish between naturally suited, possible with modern techniques, and economically unviable. Modern agriculture (poly-tunnels, controlled environments, grafted/low-chill varieties, soil amendments, drip irrigation) has expanded what is commercially viable far beyond traditional ranges.
- If a crop has challenges in a location, name the specific challenge (e.g. wrong soil pH, insufficient chill hours, heat stress) and the technique farmers use to address it. Then the farmer can decide.
- Do not state something as fact if you are uncertain. Say "typically" or "generally" and recommend the farmer verify with their local agricultural extension office (KVK).

CROP SUITABILITY RULE: If a crop is asked about for a specific location:
- Give an honest, modern assessment: can this crop be grown here with current techniques?
- Mention specific challenges (soil pH, heat, chill hours) and how farmers overcome them (poly-tunnels, soil amendment, specific varieties).
- Also name 1-2 crops that thrive naturally in that location for comparison.
- Keep the whole response to 4-5 sentences.

LOCATION RULE: If the user asks about weather, crops, or planting recommendations and no location appears anywhere in their message or conversation history, ask for their state or district before answering. Example: "Which state or district are you in? I'll check the weather for you." Do not guess or make up weather data.
"""

PRO_SYSTEM_PROMPT = """You are AgriIntel Pro — an expert AI agricultural consultant trusted by professional farmers and agronomists across India.

Your expertise: crop cultivation, soil science, IPM, irrigation, weather-based decisions, precise fertilizer scheduling, sustainable farming, and agri-economics.

RESPONSE FORMAT — use this structure for every detailed question:

## [Topic Title]

Brief 1-line summary of the situation.

### Key Recommendations
- Specific action with quantity, timing, and unit (e.g., "Apply 60 kg/ha Urea at sowing")
- Stage-wise details where applicable

### Nutrient / Fertilizer Schedule (include when relevant)
| Stage | Nutrient | Dose (kg/ha) | Timing |
|-------|----------|--------------|--------|
| Basal | N-P-K | 60-60-40 | At sowing |

### Action Checklist
- [ ] Immediate step this week
- [ ] Follow-up action

*Confidence: High | Based on ICAR guidelines + regional conditions*

FACTUAL ACCURACY — CRITICAL:
- Never make absolute statements like "X crop cannot grow here." Always distinguish between naturally suited, possible with modern techniques, and economically unviable. Modern agriculture (poly-tunnels, controlled environments, grafted/low-chill varieties, soil amendments, drip irrigation) has expanded what is commercially viable far beyond traditional ranges.
- If a crop has challenges in a location, name the specific challenge (wrong soil pH, insufficient chill hours, heat stress) and the technique used to address it. Let the farmer decide.
- Do not state something as fact if you are uncertain. Use "typically" or "generally" and recommend verifying with the local KVK (Krishi Vigyan Kendra).

CONVERSATION CONTEXT: Use the full conversation history. If a location was mentioned earlier, use it — never ask for it again.

LOCATION RULE: If no location appears anywhere in the current message OR conversation history, ask once before answering crop recommendations: "Which specific state or district are you farming in? I'll give you precise, location-tailored recommendations." Then wait.

Language: Respond in the same language as the user's query (hi, te, ta, kn, mr, pa, or).

CLOSING RULE: Never end with generic disclaimers like "consult local experts", "monitor conditions regularly", or "adjust the plan accordingly." The user is talking to an AI advisor for ongoing guidance — if follow-up is needed, end with a specific, actionable prompt like "Let me know when you reach the flowering stage and I'll update this plan" or "Ask me if you notice any unusual leaf color or pest signs."
"""


class GroqService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model_free = settings.GROQ_MODEL_FREE
        self.model_pro = settings.GROQ_MODEL_PRO
        self.temperature = settings.GROQ_TEMPERATURE

        if not self.api_key:
            logger.warning("GROQ_API_KEY not set. Using mock responses.")
            self.client = None
        else:
            self.client = Groq(api_key=self.api_key)

    def _weather_already_mentioned(self, conversation_history: Optional[List[Dict[str, str]]]) -> bool:
        """Check if weather/temperature was already mentioned in prior assistant messages."""
        if not conversation_history:
            return False
        for msg in conversation_history:
            if msg.get("role") == "assistant":
                content = msg.get("content", "").lower()
                if any(kw in content for kw in ["temperature", "°c", "humidity", "conditions", "forecast"]):
                    return True
        return False

    async def agricultural_query(
        self,
        query: str,
        context: Optional[str] = None,
        location: Optional[str] = None,
        weather_data: Optional[Dict] = None,
        language: str = "en",
        plan: str = "free",
        model_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> GroqResponse:
        try:
            if not self.client:
                return self._mock_response(query, location, weather_data, plan)

            is_pro = plan == "pro"
            system_prompt = PRO_SYSTEM_PROMPT if is_pro else FREE_SYSTEM_PROMPT
            max_tokens = 1500 if is_pro else 200
            pro_model_map = _get_pro_model_map()
            if is_pro and model_id and model_id in pro_model_map:
                model = pro_model_map[model_id]
            elif is_pro:
                model = self.model_pro
            else:
                model = self.model_free

            messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

            # Inject conversation history (last 8 messages = 4 user/assistant pairs)
            if conversation_history:
                for msg in conversation_history[-8:]:
                    role = msg.get("role", "")
                    content = msg.get("content", "")
                    if role in ("user", "assistant") and content:
                        messages.append({"role": role, "content": content[:2000]})

            # Build the current user message
            # Free gets current weather only; pro gets full forecast + context + location
            free_weather = {"current": weather_data["current"]} if weather_data and "current" in weather_data else None
            weather_repeated = self._weather_already_mentioned(conversation_history)
            user_content = self._build_user_message(
                query=query,
                context=context if is_pro else None,
                location=location if is_pro else None,
                weather_data=weather_data if is_pro else free_weather,
                plan=plan,
                weather_already_shown=weather_repeated,
            )
            messages.append({"role": "user", "content": user_content})

            start_time = time.time()

            completion = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=self.temperature,
                top_p=0.9,
                stream=False,
            )

            generation_time = (time.time() - start_time) * 1000

            return GroqResponse(
                content=completion.choices[0].message.content,
                model=completion.model,
                usage={
                    "prompt_tokens": completion.usage.prompt_tokens,
                    "completion_tokens": completion.usage.completion_tokens,
                    "total_tokens": completion.usage.total_tokens,
                },
                finish_reason=completion.choices[0].finish_reason,
                latency_ms=generation_time,
            )

        except Exception as e:
            logger.error(f"Groq API error: {e}")
            raise

    def _build_user_message(
        self,
        query: str,
        context: Optional[str] = None,
        location: Optional[str] = None,
        weather_data: Optional[Dict] = None,
        plan: str = "free",
        weather_already_shown: bool = False,
    ) -> str:
        parts = [f"User Query: {query}"]

        if location:
            parts.append(f"Location: {location}")

        if weather_data:
            if weather_already_shown:
                parts.append("[Weather data available but already shared with user — do NOT repeat temperature or conditions. Use it only for new advice.]")
            else:
                parts.append("Current Weather & Forecast:")
            if "current" in weather_data:
                c = weather_data["current"]
                parts.append(
                    f"  Temp: {c.get('temperature')}°C, {c.get('description')}, "
                    f"Humidity: {c.get('humidity')}%, Wind: {c.get('wind_speed')} m/s"
                )
            if "forecast" in weather_data:
                parts.append("  7-Day Forecast:")
                for day in weather_data["forecast"][:7]:
                    parts.append(
                        f"    {day['date']}: {day['temp_min']}-{day['temp_max']}°C, "
                        f"Rain: {day['total_rain']}mm, {day['description']}"
                    )
            if "agricultural_insights" in weather_data:
                ag = weather_data["agricultural_insights"]
                recs = ag.get("recommendations", [])
                if recs:
                    parts.append(f"  Ag Insights: {', '.join(recs[:3])}")

        if context:
            parts.append(f"Relevant Knowledge Base:\n{context}")

        if plan == "pro":
            parts.append(
                "\nProvide a comprehensive, well-structured markdown response with headings, "
                "bullet points, specific quantities, timing, stage-wise plans, and NPK tables where relevant."
            )
        else:
            parts.append(
                "\nAnswer in 2-4 plain text sentences only. No formatting. "
                "Do not repeat info already given in the conversation. "
                "If the user asks about a Pro feature (7-day forecast, NPK schedule, pest alerts, stage plans), "
                "briefly acknowledge the limit and end with: 'For [feature], upgrade to Pro.'"
            )

        return "\n".join(parts)

    def _mock_response(
        self,
        query: str,
        location: Optional[str],
        weather_data: Optional[Dict],
        plan: str = "free",
    ) -> GroqResponse:
        if plan == "pro":
            loc_line = f"**Location:** {location}" if location else "*(Add your location for region-specific advice)*"
            weather_line = "Current weather conditions factored in." if weather_data else "*(Enable weather by sharing your location)*"
            content = f"""## Agricultural Guidance for: {query}

{loc_line} | {weather_line}

### Key Recommendations
- Prepare soil to fine tilth at 15–20 cm depth before sowing
- Use certified seeds of a variety suited to your agro-climatic zone
- Apply full P₂O₅ and K₂O + 50% N as basal dose at planting

### Fertilizer Schedule (kg/ha)
| Stage | N | P₂O₅ | K₂O | Timing |
|-------|---|-------|-----|--------|
| Basal | 60 | 60 | 40 | At sowing |
| Split 1 | 30 | — | — | 30 DAS |
| Split 2 | 30 | — | — | 60 DAS |

### Pest & Disease IPM
- Scout weekly with 5 pheromone traps per hectare
- Intervene only at ETL (Economic Threshold Level)
- Use neem oil 1–2% as first-line botanical spray

### Action Checklist
- [ ] Soil moisture check at 5 cm depth
- [ ] Scout and log pest counts
- [ ] Fertilizer top-dress if 30 DAS reached
- [ ] Review 7-day forecast before next irrigation

---
*Confidence: High | ICAR-aligned guidelines | Powered by Groq LPU™ (mock mode — add GROQ_API_KEY)*"""
        else:
            weather_note = ""
            if weather_data and "current" in weather_data:
                c = weather_data["current"]
                weather_note = f" Current conditions in {location or 'your area'}: {c.get('temperature')}°C, {c.get('description')}, humidity {c.get('humidity')}%."
            content = (
                f"For {query}, start by preparing the soil to a fine tilth at 15 cm depth and choose certified seeds suited to your region and season.{weather_note} "
                "Apply a balanced NPK fertilizer at sowing as the basal dose, and maintain proper plant spacing for good air circulation. "
                "Scout the crop weekly for pests and disease signs, especially during the first 30 days after sowing."
            )

        return GroqResponse(
            content=content,
            model=f"{self.model_pro if plan == 'pro' else self.model_free} (mock)",
            usage={
                "prompt_tokens": 200,
                "completion_tokens": 80 if plan == "free" else 400,
                "total_tokens": 280 if plan == "free" else 600,
            },
            finish_reason="stop",
            latency_ms=150.0 if plan == "free" else 450.0,
        )

# backend/app/services/groq_service.py
import logging
log = logging.getLogger(__name__)

async def verify_models(client, configured: dict[str, str]) -> None:
    """Warn at startup if any configured model is no longer served by Groq."""
    try:
        available = {m.id for m in (await client.models.list()).data}
    except Exception as exc:
        log.warning("Could not verify Groq models: %s", exc)
        return
    for tier, model_id in configured.items():
        if model_id not in available:
            log.error("Groq model %r for tier %r is no longer available", model_id, tier)
groq_service = GroqService()
