"""
Production configuration management for Kramix V2 Interview Intelligence Platform.
Utilizes pydantic-settings with environment variable loading and validation.
"""
from __future__ import annotations
import os
from functools import lru_cache
from typing import List, Union, Optional
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Strongly typed application configuration.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Primary Database URL (PostgreSQL in production, SQLite in dev/testing)
    DATABASE_URL: str = Field(
        default="sqlite:///./kramix_dev.db",
        description="Database connection string (postgresql+asyncpg://... or sqlite+aiosqlite:///...)",
    )

    # Supabase Configuration
    SUPABASE_URL: Optional[str] = Field(
        default=None,
        description="Supabase project URL (e.g., https://your-project-ref.supabase.co)",
    )

    SUPABASE_KEY: Optional[str] = Field(
        default=None,
        description="Supabase public anon key",
    )

    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = Field(
        default=None,
        description="Supabase service role secret API key (server-side only)",
    )

    ENVIRONMENT: str = Field(
        default="development",
        description="Runtime environment ('development', 'testing', 'production')",
    )

    ALLOWED_ORIGINS: Union[List[str], str] = Field(
        default=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
        description="List of allowed CORS origins. Wildcard '*' forbidden in production.",
    )

    SECRET_KEY: str = Field(
        default="kramix-dev-secret-key-change-in-production",
        description="Cryptographic secret key for session signatures.",
    )

    MAX_ANSWER_LENGTH: int = Field(
        default=8000,
        ge=100,
        le=50000,
        description="Maximum permitted characters per candidate answer.",
    )

    MAX_REQUEST_BODY_BYTES: int = Field(
        default=1_048_576,  # 1 MB
        description="Maximum request payload body size in bytes.",
    )

    CONFIDENCE_THRESHOLD: float = Field(
        default=0.60,
        ge=0.0,
        le=1.0,
        description="Threshold below which voice STT prompts candidate retry.",
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_production_hardening(self) -> Settings:
        env = self.ENVIRONMENT.strip().lower()
        if env == "production":
            origins = self.ALLOWED_ORIGINS if isinstance(self.ALLOWED_ORIGINS, list) else [self.ALLOWED_ORIGINS]
            if "*" in origins:
                raise ValueError(
                    "Production security violation: Wildcard '*' is strictly prohibited in ALLOWED_ORIGINS."
                )
            if self.SECRET_KEY == "kramix-dev-secret-key-change-in-production":
                raise ValueError(
                    "Production security violation: Default dev SECRET_KEY cannot be used in production."
                )
        return self

    def get_cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, list):
            return self.ALLOWED_ORIGINS
        return [self.ALLOWED_ORIGINS]

    def __repr__(self) -> str:
        # Safe repr masking secrets
        return (
            f"<Settings environment={self.ENVIRONMENT!r} "
            f"database_url={self.DATABASE_URL.split('@')[-1] if '@' in self.DATABASE_URL else self.DATABASE_URL!r} "
            f"supabase_url={self.SUPABASE_URL!r} "
            f"supabase_key={'[MASKED]' if self.SUPABASE_KEY else None!r} "
            f"allowed_origins={self.ALLOWED_ORIGINS!r} "
            f"secret_key='[MASKED]'>"
        )


@lru_cache()
def get_settings() -> Settings:
    """Returns singleton cached application settings instance."""
    return Settings()
