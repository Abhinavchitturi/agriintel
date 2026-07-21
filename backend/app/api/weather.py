from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class WeatherResponse(BaseModel):
    location: Dict[str, Any]
    current: Dict[str, Any]
    daily: List[Dict[str, Any]]
    agricultural: Dict[str, Any]


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    location: str = Query(..., description="City, region, or coordinates"),
    http_request: Request = None,
):
    try:
        weather_service = http_request.app.state.weather_service
        weather = await weather_service.get_current_weather(location)
        return weather
    except Exception as e:
        logger.error(f"Weather error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast")
async def get_forecast(
    location: str = Query(..., description="City, region, or coordinates"),
    days: int = Query(7, ge=1, le=14, description="Number of forecast days"),
    http_request: Request = None,
):
    try:
        weather_service = http_request.app.state.weather_service
        forecast = await weather_service.get_forecast(location, days)
        return forecast
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agricultural")
async def get_agricultural_weather(
    location: str = Query(..., description="City, region, or coordinates"),
    http_request: Request = None,
):
    try:
        weather_service = http_request.app.state.weather_service
        ag_weather = await weather_service.get_agricultural_weather(location)
        return ag_weather
    except Exception as e:
        logger.error(f"Agricultural weather error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/crop-suitability")
async def check_crop_suitability(
    crop: str = Query(..., description="Crop name (e.g., paddy, wheat, cotton)"),
    location: str = Query(..., description="Location for weather data"),
    http_request: Request = None,
):
    try:
        weather_service = http_request.app.state.weather_service
        groq_service = http_request.app.state.groq_service

        weather = await weather_service.get_agricultural_weather(location)

        response = await groq_service.agricultural_query(
            query=f"Is this the right time to grow {crop} in {location}? Analyze the weather forecast for the next {120 if crop.lower() in ['paddy', 'rice', 'cotton', 'sugarcane'] else 90} days and give a clear recommendation.",
            location=location,
            weather_data=weather,
            language="en",
        )

        return {
            "crop": crop,
            "location": location,
            "weather": weather,
            "recommendation": response.content,
            "confidence": 0.85,
        }

    except Exception as e:
        logger.error(f"Crop suitability error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
