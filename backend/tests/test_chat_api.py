import pytest
from unittest.mock import AsyncMock, patch
from pydantic import ValidationError

from app.api.chat import ChatRequest


# ─── ChatRequest validation ───────────────────────────────────────────────────

class TestChatRequestValidation:
    def test_accepts_valid_request(self):
        r = ChatRequest(query="What crops grow in Maharashtra?", plan="free")
        assert r.query == "What crops grow in Maharashtra?"
        assert r.plan == "free"
        assert r.language == "en"

    def test_rejects_empty_query(self):
        with pytest.raises(ValidationError):
            ChatRequest(query="")

    def test_rejects_query_over_2000_chars(self):
        with pytest.raises(ValidationError):
            ChatRequest(query="x" * 2001)

    def test_accepts_max_length_query(self):
        r = ChatRequest(query="x" * 2000)
        assert len(r.query) == 2000

    def test_default_language_is_en(self):
        r = ChatRequest(query="hello")
        assert r.language == "en"

    def test_default_plan_is_free(self):
        r = ChatRequest(query="hello")
        assert r.plan == "free"

    def test_user_token_optional(self):
        r = ChatRequest(query="hello")
        assert r.user_token is None

    def test_conversation_history_optional(self):
        r = ChatRequest(query="hello")
        assert r.conversation_history is None

    def test_accepts_conversation_history(self):
        history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
        r = ChatRequest(query="follow up", conversation_history=history)
        assert len(r.conversation_history) == 2


# ─── Pro verification ─────────────────────────────────────────────────────────

class TestProVerification:
    @pytest.mark.asyncio
    async def test_verify_pro_returns_false_when_supabase_unconfigured(self):
        from app.api.chat import _verify_pro_via_supabase
        result = await _verify_pro_via_supabase("some-token")
        assert result is False

    @pytest.mark.asyncio
    async def test_verify_pro_returns_false_for_empty_token(self):
        from app.api.chat import _verify_pro_via_supabase
        result = await _verify_pro_via_supabase("")
        assert result is False

    @pytest.mark.asyncio
    async def test_verify_pro_returns_false_on_http_error(self):
        from app.api.chat import _verify_pro_via_supabase
        import httpx
        from unittest.mock import patch, AsyncMock

        mock_response = AsyncMock()
        mock_response.status_code = 401

        with patch("app.api.chat.settings") as mock_settings:
            mock_settings.SUPABASE_URL = "https://test.supabase.co"
            mock_settings.SUPABASE_SERVICE_ROLE_KEY = "test-key"

            with patch("httpx.AsyncClient") as mock_client_class:
                mock_client = AsyncMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=None)
                mock_client.get = AsyncMock(return_value=mock_response)
                mock_client_class.return_value = mock_client

                result = await _verify_pro_via_supabase("bad-token")
                assert result is False


# ─── /api/chat endpoint (integration) ────────────────────────────────────────

class TestChatEndpoint:
    def test_free_chat_returns_200(self, client):
        resp = client.post("/api/chat/", json={
            "query": "What fertilizer for wheat?",
            "plan": "free",
            "language": "en",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "answer" in data
        assert "confidence" in data
        assert data["processing_mode"] == "free_basic"

    def test_missing_query_returns_422(self, client):
        resp = client.post("/api/chat/", json={"plan": "free"})
        assert resp.status_code == 422

    def test_empty_query_returns_422(self, client):
        resp = client.post("/api/chat/", json={"query": "", "plan": "free"})
        assert resp.status_code == 422

    def test_response_has_required_fields(self, client):
        resp = client.post("/api/chat/", json={"query": "Best crop for Punjab?", "plan": "free"})
        assert resp.status_code == 200
        data = resp.json()
        for field in ["answer", "confidence", "generation_time", "model", "processing_mode"]:
            assert field in data, f"Missing field: {field}"

    def test_confidence_in_valid_range(self, client):
        resp = client.post("/api/chat/", json={"query": "Tomato care in Pune?", "plan": "free", "location": "Pune"})
        assert resp.status_code == 200
        confidence = resp.json()["confidence"]
        assert 0.0 <= confidence <= 1.0

    def test_health_endpoint(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
