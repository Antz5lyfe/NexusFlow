"""Application configuration via pydantic-settings."""

from __future__ import annotations

import json
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Reads values from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",   # silently drop unrecognised .env keys (e.g. from earlier modules)
    )

    # ── Core ──────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-to-a-random-secret"

    # ── Database ──────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:nexusflow@localhost:5432/nexusflow"
    )

    # ── CORS ──────────────────────────────────────────────────────────
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    # ── LLM Provider API Keys ─────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GITHUB_MODELS_TOKEN: str = ""
    HF_API_KEY: str = ""

    # ── Databank Storage ──────────────────────────────────────────────
    #: Directory for uploaded databank documents. Relative paths resolve
    #: against the project root. Swap for an S3 bucket later.
    DATABANK_STORAGE_DIR: str = "storage/databank"
    #: Reject uploads larger than this (bytes). Default 10 MB.
    DATABANK_MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse the JSON-encoded CORS_ORIGINS string into a list."""
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Cached singleton so env is read once per process."""
    return Settings()
