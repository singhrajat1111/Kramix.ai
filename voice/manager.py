"""
Voice Manager coordinating STT / TTS provider execution, confidence gating,
observability logging, and graceful fallback to text mode.

NON-NEGOTIABLE ARCHITECTURAL INVARIANTS:
1. Pure I/O layer: output always flows into existing InterviewSession.submit_answer().
2. Failed or low-confidence transcription triggers retry or text fallback; NEVER consumes a question turn.
3. Raw audio is never logged or dumped into trace events.
"""
from __future__ import annotations
import logging
from typing import Optional, Dict, Any
from voice.abstraction import BaseSTTProvider, BaseTTSProvider
from voice.models import STTResult, TTSRequest, TTSResult, VoiceConfig
from voice.providers.mock_voice import MockSTTProvider, MockTTSProvider
from observability.trace import TraceLogger, TraceEvent, global_tracer

logger = logging.getLogger("kramix.voice")


class VoiceManager:
    """
    Central dispatcher and lifecycle manager for voice operations.
    """
    def __init__(
        self,
        config: Optional[VoiceConfig] = None,
        stt_provider: Optional[BaseSTTProvider] = None,
        tts_provider: Optional[BaseTTSProvider] = None,
        tracer: Optional[TraceLogger] = None,
    ):
        self.config = config or VoiceConfig()
        self.stt_provider = stt_provider or MockSTTProvider()
        self.tts_provider = tts_provider or MockTTSProvider()
        self.tracer = tracer or global_tracer

    async def transcribe(
        self,
        session_id: str,
        turn: int,
        audio_data: bytes,
        mime_type: str = "audio/wav",
    ) -> STTResult:
        """
        Transcribes audio with error isolation, trace logging, and confidence gating.
        """
        self.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=turn,
                event_type="stt_requested",
                reason=f"Requested speech transcription via {self.stt_provider.provider_name}.",
                metadata={"provider": self.stt_provider.provider_name, "byte_count": len(audio_data)},
            )
        )

        try:
            result = await self.stt_provider.transcribe_audio(
                audio_data=audio_data,
                mime_type=mime_type,
                language=self.config.language,
            )

            # Check confidence threshold
            if result.confidence < self.config.confidence_threshold:
                self.tracer.record(
                    TraceEvent(
                        session_id=session_id,
                        turn=turn,
                        event_type="voice_fallback",
                        reason=f"STT confidence ({result.confidence:.2f}) below threshold ({self.config.confidence_threshold:.2f}); candidate encouraged to retry or type.",
                        metadata={"confidence": result.confidence, "threshold": self.config.confidence_threshold},
                    )
                )

            self.tracer.record(
                TraceEvent(
                    session_id=session_id,
                    turn=turn,
                    event_type="stt_completed",
                    reason=f"Completed speech transcription with confidence {result.confidence:.2f}.",
                    metadata={
                        "confidence": result.confidence,
                        "duration": result.duration_seconds,
                        "char_count": len(result.transcript),
                    },
                )
            )
            return result

        except Exception as exc:
            self.tracer.record(
                TraceEvent(
                    session_id=session_id,
                    turn=turn,
                    event_type="stt_failed",
                    reason=f"STT transcription failed: {str(exc)}; falling back to text mode.",
                    metadata={"error": str(exc), "provider": self.stt_provider.provider_name},
                )
            )
            raise

    async def synthesize(
        self,
        session_id: str,
        turn: int,
        text: str,
        voice_id: Optional[str] = None,
    ) -> TTSResult:
        """
        Synthesizes interviewer question text into audio with error isolation.
        """
        self.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=turn,
                event_type="tts_requested",
                reason=f"Requested speech synthesis for question text ({len(text)} chars) via {self.tts_provider.provider_name}.",
                metadata={"provider": self.tts_provider.provider_name, "char_count": len(text)},
            )
        )

        try:
            req = TTSRequest(text=text, voice_id=voice_id, language=self.config.language)
            result = await self.tts_provider.synthesize_speech(req)

            self.tracer.record(
                TraceEvent(
                    session_id=session_id,
                    turn=turn,
                    event_type="tts_completed",
                    reason=f"Speech synthesis completed ({result.duration_seconds}s audio generated).",
                    metadata={"duration": result.duration_seconds, "format": result.format},
                )
            )
            return result

        except Exception as exc:
            self.tracer.record(
                TraceEvent(
                    session_id=session_id,
                    turn=turn,
                    event_type="tts_failed",
                    reason=f"TTS synthesis failed: {str(exc)}; question remains visible as text on screen.",
                    metadata={"error": str(exc), "provider": self.tts_provider.provider_name},
                )
            )
            raise
