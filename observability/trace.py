"""
Observability and Trace Logging module.
Ensures every state transition, decision, and evaluation is recorded with an articulate human-readable reason string.
Non-negotiable rule #7: If you can't articulate why in one sentence, the decision logic is not done yet.
"""
from __future__ import annotations
from enum import Enum
import logging
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

logger = logging.getLogger("kramix.observability")


class TraceEventType(str, Enum):
    QUESTION_ASKED = "question_asked"
    ANSWER_EVALUATED = "answer_evaluated"
    DECISION_MADE = "decision"
    PHASE_TRANSITION = "transition"
    SCORE_UPDATED = "score_update"
    CONTRADICTION_FLAGGED = "contradiction"
    # Round Strategy & Lifecycle Events (Phase 10)
    ROUND_STARTED = "round_started"
    ROUND_COMPLETED = "round_completed"
    ROUND_TRANSITION = "round_transition"
    ROUND_CONSTRAINTS_APPLIED = "round_constraints_applied"
    ROUND_COMPLETION_REASON = "round_completion_reason"
    # Final Report & Hiring Committee Events (Phase 11)
    REPORT_GENERATION_STARTED = "report_generation_started"
    REPORT_GENERATION_COMPLETED = "report_generation_completed"
    REPORT_GENERATION_FAILED = "report_generation_failed"
    HIRING_ASSESSMENT_GENERATED = "hiring_assessment_generated"
    # Transport & Runtime Events (Phase 12)
    SESSION_CREATED = "session_created"
    WEBSOCKET_CONNECTED = "websocket_connected"
    WEBSOCKET_DISCONNECTED = "websocket_disconnected"
    ANSWER_RECEIVED = "answer_received"
    TURN_COMPLETED = "turn_completed"
    SESSION_COMPLETED = "session_completed"
    API_ERROR = "api_error"
    # Voice / STT / TTS Events (Phase 13)
    VOICE_INPUT_STARTED = "voice_input_started"
    VOICE_INPUT_COMPLETED = "voice_input_completed"
    STT_REQUESTED = "stt_requested"
    STT_COMPLETED = "stt_completed"
    STT_FAILED = "stt_failed"
    TTS_REQUESTED = "tts_requested"
    TTS_COMPLETED = "tts_completed"
    TTS_FAILED = "tts_failed"
    VOICE_FALLBACK = "voice_fallback"
    # Persistence & Production Hardening Events (Phase 14)
    DATABASE_CONNECTED = "database_connected"
    DATABASE_ERROR = "database_error"
    SESSION_PERSISTED = "session_persisted"
    SESSION_RESTORED = "session_restored"
    SESSION_PERSISTENCE_FAILED = "session_persistence_failed"
    REPORT_PERSISTED = "report_persisted"
    SESSION_RECOVERY_FAILED = "session_recovery_failed"
    IDEMPOTENT_HIT = "idempotent_hit"




class TraceEvent(BaseModel):
    """
    Structured trace record of an individual event within an interview session.
    """
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    turn: int
    event_type: TraceEventType | str
    reason: str = Field(..., min_length=3)
    actor: str = "system"  # "interviewer" | "candidate" | "engine" | "system"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Trace event reason must be a non-empty human-readable explanation.")
        return v.strip()


class SessionTrace:
    """
    In-memory trace container for a single interview session.
    Provides filtering, audit retrieval, and timeline views.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._events: List[TraceEvent] = []

    def add_event(self, event: TraceEvent) -> None:
        if event.session_id != self.session_id:
            raise ValueError(f"Event session_id '{event.session_id}' does not match trace '{self.session_id}'")
        self._events.append(event)

    def get_timeline(self) -> List[TraceEvent]:
        return list(self._events)

    def get_events_by_type(self, event_type: TraceEventType | str) -> List[TraceEvent]:
        target = str(event_type.value if isinstance(event_type, TraceEventType) else event_type)
        return [e for e in self._events if str(e.event_type) == target]

    def get_decisions(self) -> List[TraceEvent]:
        return self.get_events_by_type(TraceEventType.DECISION_MADE)

    def get_questions(self) -> List[TraceEvent]:
        return self.get_events_by_type(TraceEventType.QUESTION_ASKED)

    def get_contradictions(self) -> List[TraceEvent]:
        return self.get_events_by_type(TraceEventType.CONTRADICTION_FLAGGED)

    @property
    def events(self) -> List[TraceEvent]:
        return list(self._events)

    def to_dict_list(self) -> List[Dict[str, Any]]:
        return [e.model_dump() for e in self._events]


class TraceLogger:
    """
    Central logging hub for interview events and traces.
    """

    def __init__(self):
        self._events: List[TraceEvent] = []
        self._session_traces: Dict[str, SessionTrace] = {}

    def record(self, event: TraceEvent) -> None:
        self._events.append(event)
        if event.session_id not in self._session_traces:
            self._session_traces[event.session_id] = SessionTrace(event.session_id)
        self._session_traces[event.session_id].add_event(event)

        logger.info(
            "[%s] turn=%d %s: %s | meta=%s",
            event.session_id,
            event.turn,
            str(event.event_type).upper(),
            event.reason,
            event.metadata,
        )

    def get_session_trace(self, session_id: str) -> SessionTrace:
        if session_id not in self._session_traces:
            self._session_traces[session_id] = SessionTrace(session_id)
        return self._session_traces[session_id]

    def get_trace(self, session_id: str) -> SessionTrace:
        """Convenience alias for get_session_trace."""
        return self.get_session_trace(session_id)


    def get_events(
        self,
        session_id: Optional[str] = None,
        event_type: Optional[str | TraceEventType] = None,
    ) -> List[TraceEvent]:
        results = self._events
        if session_id is not None:
            results = [e for e in results if e.session_id == session_id]
        if event_type is not None:
            type_val = str(event_type.value if isinstance(event_type, TraceEventType) else event_type)
            results = [e for e in results if str(e.event_type) == type_val]
        return list(results)

    def clear(self) -> None:
        self._events.clear()
        self._session_traces.clear()


# Global shared tracer instance
global_tracer = TraceLogger()
