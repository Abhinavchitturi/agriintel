from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    services: Dict[str, str]


@router.get("/health", response_model=HealthResponse)
async def health_check():
    from app.main import app

    services = {}

    try:
        if hasattr(app.state, 'groq_service'):
            services["groq"] = "healthy"
        else:
            services["groq"] = "not_initialized"
    except Exception:
        services["groq"] = "error"

    try:
        if hasattr(app.state, 'weather_service'):
            services["weather"] = "healthy"
        else:
            services["weather"] = "not_initialized"
    except Exception:
        services["weather"] = "error"

    try:
        if hasattr(app.state, 'rag_service') and app.state.rag_service.initialized:
            services["rag"] = "healthy"
        else:
            services["rag"] = "not_initialized"
    except Exception:
        services["rag"] = "error"

    all_healthy = all(s == "healthy" for s in services.values())

    return HealthResponse(
        status="healthy" if all_healthy else "degraded",
        timestamp=datetime.now().isoformat(),
        version="1.0.0",
        services=services,
    )


@router.get("/info")
async def app_info():
    from app.config import settings
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "model_free": settings.GROQ_MODEL_FREE,
        "model_pro": settings.GROQ_MODEL_PRO,
        "environment": settings.ENVIRONMENT,
    }