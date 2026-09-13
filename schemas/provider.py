"""
Provider abstraction schemas and data models.
Supports swapping between API LLMs and deterministic offline Demo providers.
"""
from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    role: MessageRole | str
    content: str


class ProviderType(str, Enum):
    DEMO = "demo"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    GROQ = "groq"
    OPENROUTER = "openrouter"


class ProviderManagerConfig(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    max_retries: int = 1
    timeout_seconds: float = 8.0
    backoff_factor: float = 0.5


class ProviderExecutionMetadata(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    provider_name: str
    fallback_fired: bool = False
    duration_ms: float = 0.0
