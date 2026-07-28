import os
from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "AgriIntel API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Comma-separated list of allowed origins; set in .env for production
    CORS_ORIGINS_STR: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS_STR.split(",") if o.strip()]
    
    GROQ_API_KEY: str = ""
    GROQ_MODEL_FREE: str = "llama-3.1-8b-instant"
    GROQ_MODEL_PRO: str = "llama-3.3-70b-versatile"
    GROQ_MODEL_FASAL: str = "llama-3.3-70b-versatile"
    GROQ_MODEL_VRIDDHI: str = "openai/gpt-oss-120b"
    GROQ_MODEL_SAMRIDDHI: str = "qwen/qwen3.6-27b"
    GROQ_MAX_TOKENS: int = 4096
    GROQ_TEMPERATURE: float = 0.3
    
    WEATHER_API_KEY: str = ""
    WEATHER_BASE_URL: str = "https://api.openweathermap.org/data/2.5"
    
    RAG_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    RAG_INDEX_PATH: str = "./data/faiss_index"
    RAG_CHUNKS_PATH: str = "./data/chunks.csv"
    RAG_METADATA_PATH: str = "./data/metadata.json"
    RAG_TOP_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    
    DATABASE_URL: Optional[str] = None

    # Supabase — used to verify user plan server-side
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Legacy email allowlist (only used as fallback when Supabase is unconfigured)
    PRO_USER_EMAILS: str = "farmer@pro.com,pro@agriintel.com"

    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # silently drop unknown env vars (e.g. old CORS_ORIGINS key)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()