from __future__ import annotations

from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["dev", "staging", "prod"] = "dev"
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://orvex:orvex@localhost:5432/orvex"
    db_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 5

    secret_key: str = Field(
        default="dev-secret-change-me-please-32chars-min",
        min_length=32,
    )
    jwt_algorithm: str = "HS256"
    jwt_audience: Optional[str] = None
    jwt_expires_minutes: int = 60 * 24 * 7

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    pipeline_attempts: int = 2
    pipeline_timeout_s: float = 60.0

    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None

    finnhub_api_key: Optional[str] = None
    polygon_api_key: Optional[str] = None
    alpha_vantage_api_key: Optional[str] = None
    fmp_api_key: Optional[str] = None

    oauth_google_client_id: Optional[str] = None
    oauth_google_client_secret: Optional[str] = None
    oauth_github_client_id: Optional[str] = None
    oauth_github_client_secret: Optional[str] = None

    oauth_redirect_uri: str = "http://localhost:3000/auth/callback"
    frontend_url: str = "http://localhost:3000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
