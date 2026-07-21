import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def mock_groq_service():
    svc = MagicMock()
    svc.client = MagicMock()  # mark as configured
    response = MagicMock()
    response.content = "Apply 60 kg/ha urea at sowing."
    response.model = "llama-3.3-70b-versatile"
    response.latency_ms = 420.0
    svc.agricultural_query = AsyncMock(return_value=response)
    return svc


@pytest.fixture
def mock_weather_service():
    svc = MagicMock()
    svc.get_agricultural_weather = AsyncMock(return_value=None)
    return svc


@pytest.fixture
def mock_rag_service():
    svc = MagicMock()
    svc.search_chunks = AsyncMock(return_value=("", [], 0))
    svc.initialize = AsyncMock()
    return svc


@pytest.fixture
def app(mock_groq_service, mock_weather_service, mock_rag_service):
    from app.main import app as fastapi_app
    fastapi_app.state.groq_service = mock_groq_service
    fastapi_app.state.weather_service = mock_weather_service
    fastapi_app.state.rag_service = mock_rag_service
    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app)
