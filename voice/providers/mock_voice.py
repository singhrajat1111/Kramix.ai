"""
Deterministic Mock Speech-to-Text and Text-to-Speech Providers for Kramix V2.
Enables 100% offline Demo Mode and automated testing without requiring live microphone,
audio device hardware, or cloud billing secrets.
"""
from __future__ import annotations
import asyncio
from typing import Optional
from voice.abstraction import BaseSTTProvider, BaseTTSProvider
from voice.models import STTResult, TTSRequest, TTSResult


class MockSTTProvider(BaseSTTProvider):
    """
    Deterministic STT provider.
    Transcribes simulated audio into text with predictable confidence and duration.
    Supports controlled error injection and low-confidence simulation.
    """
    def __init__(
        self,
        default_transcript: str = "This is a recognized candidate voice response explaining architecture.",
        default_confidence: float = 0.95,
        simulate_failure: bool = False,
    ):
        self._default_transcript = default_transcript
        self._default_confidence = default_confidence
        self.simulate_failure = simulate_failure

    @property
    def provider_name(self) -> str:
        return "mock_stt"

    async def transcribe_audio(
        self,
        audio_data: bytes,
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> STTResult:
        if self.simulate_failure:
            raise RuntimeError("Simulated STT transcription failure.")

        # Simulate brief audio duration based on payload size
        duration = max(0.5, round(len(audio_data) / 16000.0, 2)) if audio_data else 1.0

        # If audio_data has text-like content (for testing hooks), use it
        try:
            decoded = audio_data.decode("utf-8")
            transcript = decoded if decoded.strip() else self._default_transcript
        except Exception:
            transcript = self._default_transcript

        return STTResult(
            transcript=transcript,
            confidence=self._default_confidence,
            duration_seconds=duration,
            language=language,
            is_final=True,
            provider=self.provider_name,
        )


class MockTTSProvider(BaseTTSProvider):
    """
    Deterministic TTS provider.
    Synthesizes question text into mock audio headers with exact character counts and durations.
    """
    def __init__(self, simulate_failure: bool = False):
        self.simulate_failure = simulate_failure

    @property
    def provider_name(self) -> str:
        return "mock_tts"

    async def synthesize_speech(
        self,
        request: TTSRequest,
    ) -> TTSResult:
        if self.simulate_failure:
            raise RuntimeError("Simulated TTS audio synthesis failure.")

        # Duration estimate: ~15 characters per second at 1.0x speed
        char_count = len(request.text)
        duration = max(1.0, round((char_count / 15.0) / request.speed, 2))

        # Generate lightweight mock RIFF/WAV header (44 bytes)
        mock_wav_header = b"RIFF\x2c\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x08\x00\x00\x00\x00\x00\x00\x00"

        return TTSResult(
            audio_bytes=mock_wav_header,
            format="wav",
            duration_seconds=duration,
            character_count=char_count,
            provider=self.provider_name,
        )
