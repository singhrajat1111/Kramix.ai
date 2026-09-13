"""
Abstract Provider Interfaces for Speech-to-Text (STT) and Text-to-Speech (TTS).
Ensures speech implementations remain modular, isolated, and easily swappable
without contaminating core Interview Intelligence.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional
from voice.models import STTResult, TTSRequest, TTSResult


class BaseSTTProvider(ABC):
    """
    Abstract interface for transcribing spoken audio into candidate text.
    """
    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def transcribe_audio(
        self,
        audio_data: bytes,
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> STTResult:
        """
        Transcribes raw audio bytes into text with recognition confidence.
        """
        pass


class BaseTTSProvider(ABC):
    """
    Abstract interface for synthesizing interviewer text questions into audio.
    """
    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def synthesize_speech(
        self,
        request: TTSRequest,
    ) -> TTSResult:
        """
        Synthesizes question text into audio bytes.
        """
        pass
