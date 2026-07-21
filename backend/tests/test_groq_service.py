import pytest
from unittest.mock import MagicMock, patch
from app.services.groq_service import GroqService


@pytest.fixture
def groq_no_key():
    with patch("app.services.groq_service.settings") as mock_settings:
        mock_settings.GROQ_API_KEY = ""
        mock_settings.GROQ_MODEL_FREE = "llama-3.1-8b-instant"
        mock_settings.GROQ_MODEL_PRO = "llama-3.3-70b-versatile"
        mock_settings.GROQ_TEMPERATURE = 0.3
        yield GroqService()


@pytest.fixture
def groq_with_key():
    with patch("app.services.groq_service.settings") as mock_settings:
        mock_settings.GROQ_API_KEY = "test-key-123"
        mock_settings.GROQ_MODEL_FREE = "llama-3.1-8b-instant"
        mock_settings.GROQ_MODEL_PRO = "llama-3.3-70b-versatile"
        mock_settings.GROQ_TEMPERATURE = 0.3
        with patch("app.services.groq_service.Groq"):
            yield GroqService()


class TestGroqServiceInit:
    def test_client_is_none_without_api_key(self, groq_no_key):
        assert groq_no_key.client is None

    def test_client_is_set_with_api_key(self, groq_with_key):
        assert groq_with_key.client is not None


class TestWeatherAlreadyMentioned:
    def test_returns_false_for_empty_history(self, groq_no_key):
        assert groq_no_key._weather_already_mentioned([]) is False

    def test_returns_false_for_none_history(self, groq_no_key):
        assert groq_no_key._weather_already_mentioned(None) is False

    def test_returns_false_when_no_weather_keywords(self, groq_no_key):
        history = [
            {"role": "user", "content": "What fertilizer for wheat?"},
            {"role": "assistant", "content": "Apply urea at sowing."},
        ]
        assert groq_no_key._weather_already_mentioned(history) is False

    def test_returns_true_when_temperature_mentioned(self, groq_no_key):
        history = [
            {"role": "assistant", "content": "Current temperature is 28°C with high humidity."},
        ]
        assert groq_no_key._weather_already_mentioned(history) is True

    def test_returns_true_when_forecast_mentioned(self, groq_no_key):
        history = [
            {"role": "assistant", "content": "The 7-day forecast shows rainfall on Thursday."},
        ]
        assert groq_no_key._weather_already_mentioned(history) is True

    def test_only_checks_assistant_messages(self, groq_no_key):
        history = [
            {"role": "user", "content": "The temperature is really high today, 42°C!"},
        ]
        assert groq_no_key._weather_already_mentioned(history) is False


class TestMockResponse:
    @pytest.mark.asyncio
    async def test_returns_mock_when_no_client(self, groq_no_key):
        response = await groq_no_key.agricultural_query(
            query="What crops in Karnataka?",
            plan="free",
        )
        assert response.content
        assert response.model
        assert response.latency_ms >= 0
