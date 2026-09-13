"""
Voice package for Kramix V2 Interview Intelligence Platform.
Provides STT/TTS abstractions, deterministic mock providers, and voice runtime management.
"""
from voice.models import VoiceInputMode, STTResult, TTSRequest, TTSResult, VoiceConfig
from voice.abstraction import BaseSTTProvider, BaseTTSProvider
from voice.providers.mock_voice import MockSTTProvider, MockTTSProvider
from voice.manager import VoiceManager

__all__ = [
    "VoiceInputMode",
    "STTResult",
    "TTSRequest",
    "TTSResult",
    "VoiceConfig",
    "BaseSTTProvider",
    "BaseTTSProvider",
    "MockSTTProvider",
    "MockTTSProvider",
    "VoiceManager",
]
