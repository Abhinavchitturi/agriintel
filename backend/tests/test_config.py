import pytest
from app.config import Settings


def test_debug_defaults_to_false():
    s = Settings()
    assert s.DEBUG is False, "DEBUG must default to False in production"


def test_environment_defaults_to_production():
    s = Settings()
    assert s.ENVIRONMENT == "production"


def test_cors_origins_parses_csv():
    s = Settings(CORS_ORIGINS_STR="http://localhost:3000,https://myapp.com")
    origins = s.CORS_ORIGINS
    assert "http://localhost:3000" in origins
    assert "https://myapp.com" in origins
    assert len(origins) == 2


def test_cors_origins_strips_whitespace():
    s = Settings(CORS_ORIGINS_STR=" https://myapp.com , http://localhost:3000 ")
    assert all(not o.startswith(" ") for o in s.CORS_ORIGINS)


def test_groq_free_model():
    s = Settings()
    assert s.GROQ_MODEL_FREE == "llama-3.1-8b-instant"


def test_groq_pro_model():
    s = Settings()
    assert s.GROQ_MODEL_PRO == "llama-3.3-70b-versatile"


def test_secret_key_is_not_placeholder():
    """SECRET_KEY must not be the well-known placeholder value."""
    s = Settings()
    insecure_placeholders = {"", "your-secret-key-change-in-production", "your-super-secret-key-change-in-production"}
    assert s.SECRET_KEY not in insecure_placeholders, (
        "SECRET_KEY is using an insecure placeholder. Set a real random value in .env"
    )


def test_rate_limit_defaults():
    s = Settings()
    assert s.RATE_LIMIT_REQUESTS == 100
    assert s.RATE_LIMIT_WINDOW == 60


def test_supabase_url_not_a_known_placeholder():
    """SUPABASE_URL must not be the placeholder value shipped in .env.example."""
    s = Settings()
    # Empty string is fine (Supabase optional in dev); a real URL is fine.
    # Only reject the known placeholder that means "not configured yet".
    assert "your-project-ref" not in s.SUPABASE_URL, (
        "SUPABASE_URL is still the placeholder. Set your real Supabase project URL."
    )
