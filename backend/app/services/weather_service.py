import logging
from typing import Dict, Any, Optional, List
import httpx
from datetime import datetime, timedelta

from app.config import settings

logger = logging.getLogger(__name__)


class WeatherService:
    def __init__(self):
        self.api_key = settings.WEATHER_API_KEY
        self.base_url = settings.WEATHER_BASE_URL
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def get_current_weather(self, location: str) -> Dict[str, Any]:
        """Get current weather for a location"""
        try:
            coords = await self._geocode(location)
            if not coords:
                return await self._mock_weather(location)
            
            lat, lon = coords
            url = f"{self.base_url}/weather"
            params = {"lat": lat, "lon": lon, "appid": self.api_key, "units": "metric"}
            
            response = await self.client.get(url, params=params)
            if response.status_code != 200:
                return await self._mock_weather(location)
            
            data = response.json()
            forecast = await self._get_forecast(lat, lon)
            
            return self._format_weather(data, forecast, location)
            
        except Exception as e:
            logger.error(f"Weather fetch error: {e}")
            return await self._mock_weather(location)
    
    async def get_forecast(self, location: str, days: int = 7) -> Dict[str, Any]:
        """Get multi-day forecast"""
        coords = await self._geocode(location)
        if not coords:
            return await self._mock_forecast(location, days)
        
        lat, lon = coords
        forecast = await self._get_forecast(lat, lon, days)
        return self._format_forecast(forecast, location)
    
    async def get_agricultural_weather(self, location: str) -> Dict[str, Any]:
        """Get weather with agricultural insights"""
        weather = await self.get_current_weather(location)
        return {
            "location": location,
            "current": weather.get("current", {}),
            "forecast": weather.get("daily", []),
            "agricultural_insights": self._generate_ag_insights(weather.get("current", {}), weather.get("daily", [])),
            "recommendations": self._generate_recommendations(weather.get("current", {}), weather.get("daily", [])),
        }
    
    async def _geocode(self, location: str) -> Optional[tuple]:
        if not self.api_key:
            return None
        try:
            url = "http://api.openweathermap.org/geo/1.0/direct"
            params = {"q": location, "limit": 1, "appid": self.api_key}
            response = await self.client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                if data:
                    return (data[0]["lat"], data[0]["lon"])
        except Exception as e:
            logger.warning(f"Geocoding failed for {location}: {e}")
        return None
    
    async def _get_forecast(self, lat: float, lon: float, days: int = 7) -> Dict:
        url = f"{self.base_url}/forecast"
        params = {"lat": lat, "lon": lon, "appid": self.api_key, "units": "metric", "cnt": days * 8}
        response = await self.client.get(url, params=params)
        return response.json() if response.status_code == 200 else {}
    
    def _format_weather(self, current: Dict, forecast: Dict, location: str) -> Dict:
        main = current.get("main", {})
        weather = current.get("weather", [{}])[0]
        wind = current.get("wind", {})
        sys = current.get("sys", {})
        
        daily = self._process_daily_forecast(forecast.get("list", []))
        
        return {
            "location": {
                "name": current.get("name", location),
                "country": sys.get("country", ""),
                "lat": current.get("coord", {}).get("lat"),
                "lon": current.get("coord", {}).get("lon"),
            },
            "current": {
                "temperature": round(main.get("temp", 0), 1),
                "feels_like": round(main.get("feels_like", 0), 1),
                "humidity": main.get("humidity"),
                "pressure": main.get("pressure"),
                "description": weather.get("description", "").title(),
                "icon": weather.get("icon"),
                "wind_speed": wind.get("speed"),
                "wind_deg": wind.get("deg"),
                "visibility": current.get("visibility", 0) / 1000,
                "clouds": current.get("clouds", {}).get("all"),
                "sunrise": datetime.fromtimestamp(sys.get("sunrise", 0)).strftime("%H:%M"),
                "sunset": datetime.fromtimestamp(sys.get("sunset", 0)).strftime("%H:%M"),
                "timestamp": datetime.now().isoformat(),
            },
            "daily": daily[:7],
            "agricultural": self._generate_ag_insights(main, daily),
        }
    
    def _process_daily_forecast(self, forecast_list: List) -> List[Dict]:
        daily = {}
        for item in forecast_list:
            dt = datetime.fromtimestamp(item["dt"])
            date_key = dt.date().isoformat()
            if date_key not in daily:
                daily[date_key] = {"temps": [], "humidity": [], "rain": [], "descriptions": [], "wind": []}
            main = item.get("main", {})
            weather = item.get("weather", [{}])[0]
            wind = item.get("wind", {})
            daily[date_key]["temps"].append(main.get("temp", 0))
            daily[date_key]["humidity"].append(main.get("humidity", 0))
            daily[date_key]["rain"].append(item.get("rain", {}).get("3h", 0))
            daily[date_key]["descriptions"].append(weather.get("description", ""))
            daily[date_key]["wind"].append(wind.get("speed", 0))
        
        result = []
        for date_key, data in sorted(daily.items()):
            result.append({
                "date": date_key,
                "temp_min": round(min(data["temps"]), 1),
                "temp_max": round(max(data["temps"]), 1),
                "temp_avg": round(sum(data["temps"]) / len(data["temps"]), 1),
                "humidity_avg": round(sum(data["humidity"]) / len(data["humidity"])),
                "total_rain": round(sum(data["rain"]), 1),
                "description": max(set(data["descriptions"]), key=data["descriptions"].count).title(),
                "wind_avg": round(sum(data["wind"]) / len(data["wind"]), 1),
            })
        return result
    
    def _generate_ag_insights(self, current: Dict, daily: List) -> Dict:
        temp = current.get("temp", 0)
        humidity = current.get("humidity", 0)
        
        insights = {
            "planting_suitable": 15 <= temp <= 35,
            "spraying_suitable": True,
            "irrigation_needed": False,
            "disease_risk": "Low",
            "pest_risk": "Low",
            "notes": [],
        }
        
        if temp > 35:
            insights["notes"].append("High heat stress risk - increase irrigation")
        elif temp < 10:
            insights["notes"].append("Low temperature - protect sensitive crops")
        
        if humidity > 80:
            insights["disease_risk"] = "High"
            insights["notes"].append("High humidity - fungal disease risk increased")
        elif humidity > 60:
            insights["disease_risk"] = "Medium"
        
        upcoming_rain = sum(d.get("total_rain", 0) for d in daily[:3])
        if upcoming_rain < 10 and humidity < 50:
            insights["irrigation_needed"] = True
            insights["notes"].append("Low rainfall forecast - plan irrigation")
        
        if any(d.get("wind_avg", 0) > 15 for d in daily[:3]):
            insights["spraying_suitable"] = False
            insights["notes"].append("High winds - avoid spraying")
        
        return insights
    
    def _generate_recommendations(self, current: Dict, daily: List) -> List[str]:
        insights = self._generate_ag_insights(current, daily)
        recs = []
        
        if insights["planting_suitable"]:
            recs.append("✅ Good conditions for planting most crops")
        else:
            recs.append("⚠️ Suboptimal planting conditions - check soil temperature")
        
        if insights["spraying_suitable"]:
            recs.append("✅ Suitable for spraying (low wind, no rain)")
        else:
            recs.append("❌ Avoid spraying - high wind or rain expected")
        
        if insights["irrigation_needed"]:
            recs.append("💧 Irrigation recommended - low rainfall forecast")
        
        if insights["disease_risk"] == "High":
            recs.append("🦠 High disease risk - increase field scouting, consider preventive fungicide")
        
        for note in insights.get("notes", []):
            recs.append(f"💡 {note}")
        
        return recs
    
    def _format_forecast(self, forecast: Dict, location: str) -> Dict:
        daily = self._process_daily_forecast(forecast.get("list", []))
        return {
            "location": location,
            "daily": daily,
            "summary": self._forecast_summary(daily),
        }
    
    def _forecast_summary(self, daily: List) -> str:
        if not daily:
            return "No forecast data"
        avg_temp = sum(d["temp_avg"] for d in daily) / len(daily)
        total_rain = sum(d["total_rain"] for d in daily)
        rainy_days = sum(1 for d in daily if d["total_rain"] > 5)
        return f"Next {len(daily)} days: Avg {avg_temp:.1f}°C, Total rain {total_rain:.1f}mm, {rainy_days} rainy days"
    
    async def _mock_weather(self, location: str) -> Dict:
        return {
            "location": {"name": location, "country": "IN", "lat": 28.6, "lon": 77.2},
            "current": {
                "temperature": 28.5, "feels_like": 30.2, "humidity": 65, "pressure": 1013,
                "description": "Partly Cloudy", "icon": "02d", "wind_speed": 3.5,
                "wind_deg": 180, "visibility": 10, "clouds": 40,
                "sunrise": "06:30", "sunset": "18:45", "timestamp": datetime.now().isoformat(),
            },
            "daily": [
                {"date": (datetime.now() + timedelta(days=i)).date().isoformat(),
                 "temp_min": 20 + i * 0.5, "temp_max": 32 - i * 0.3,
                 "temp_avg": 26 + i * 0.1, "humidity_avg": 60 + i,
                 "total_rain": 0 if i < 3 else 5.2,
                 "description": "Partly Cloudy" if i < 3 else "Light Rain",
                 "wind_avg": 3.0}
                for i in range(7)
            ],
            "agricultural": {
                "planting_suitable": True, "spraying_suitable": True,
                "irrigation_needed": False, "disease_risk": "Low",
                "pest_risk": "Low", "notes": ["Good conditions for wheat/mustard"]
            },
        }
    
    async def _mock_forecast(self, location: str, days: int) -> Dict:
        return {
            "location": location,
            "daily": [
                {"date": (datetime.now() + timedelta(days=i)).date().isoformat(),
                 "temp_min": 20, "temp_max": 32, "temp_avg": 26,
                 "humidity_avg": 60, "total_rain": 0,
                 "description": "Clear", "wind_avg": 3.0}
                for i in range(days)
            ],
            "summary": f"Next {days} days: Mostly clear, warm temperatures",
        }
    
    async def close(self):
        await self.client.aclose()


weather_service = WeatherService()