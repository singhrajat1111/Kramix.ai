"""
Data models and typed configurations for Voice (STT / TTS) I/O Layer in Kramix V2.

CRITICAL INVARIANTS:
1. Voice is an I/O transport layer, NEVER an answer evaluation or interview brain layer.
2. STT confidence is transport metadata, NEVER folded into candidate answer correctness.
3. No emotional or body language metrics: only articulated technical and conceptual responses are evaluated.
"""
from __future__ import annotations
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class VoiceInputMode(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    AUTO = "auto"


class STTResult(BaseModel):
    """Result of transcribing candidate speech into text."""
    model_config = ConfigDict(use_enum_values=True)

    transcript: str
    confidence: float = Field(ge=0.0, le=1.0)
    duration_seconds: float = Field(ge=0.0)
    language: str = "en-US"
    is_final: bool = True
    provider: str = "mock"


class TTSRequest(BaseModel):
    """Specification for synthesizing interviewer question speech."""
    model_config = ConfigDict(use_enum_values=True)

    text: str = Field(..., min_length=1)
    voice_id: Optional[str] = "en-US-Neural2-F"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    language: str = "en-US"


class TTSResult(BaseModel):
    """Synthesized speech output for question delivery."""
    model_config = ConfigDict(use_enum_values=True)

    audio_bytes: Optional[bytes] = None
    format: str = "wav"
    duration_seconds: float = Field(ge=0.0)
    character_count: int = Field(ge=0)
    provider: str = "mock"


class VoiceConfig(BaseModel):
    """Safe configuration for candidate and interviewer audio capabilities."""
    model_config = ConfigDict(use_enum_values=True)

    stt_enabled: bool = True
    tts_enabled: bool = True
    stt_provider: str = "browser"  # "browser" | "mock" | "whisper"
    tts_provider: str = "browser"  # "browser" | "mock" | "elevenlabs"
    confidence_threshold: float = Field(default=0.60, ge=0.0, le=1.0)
    language: str = "en-US"
    fallback_to_text: bool = True
