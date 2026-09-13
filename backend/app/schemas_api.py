"""
Strongly typed schemas for REST API and WebSocket protocols in Kramix V2.
Guarantees clean contract separation:
1. REST session creation, retrieval, and report access.
2. Typed WebSocket client <-> server messaging.
3. Safe UI projection models: NEVER leak expected concepts, similarity scores, or internal engine prompts.
"""
from __future__ import annotations
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator
from schemas.interview_state import RoundType, InterviewPhase


# ===========================================================================
# 1. REST Request & Response Schemas
# ===========================================================================

class CreateSessionRequest(BaseModel):
    """Payload for creating a new interview session."""
    model_config = ConfigDict(use_enum_values=True)

    mode: str = Field(default="demo")  # "demo" | "api"
    role: Optional[str] = Field(default="Database Internals")
    round_sequence: Optional[List[RoundType]] = None
    max_turns: int = Field(default=6, ge=1, le=20)  # Default: 6 questions in total
    candidate_name: Optional[str] = None

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if v_clean not in {"demo", "api"}:
            raise ValueError("Session mode must be either 'demo' or 'api'.")
        return v_clean


class CreateSessionResponse(BaseModel):
    """Response returned upon session creation."""
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    mode: str
    role: Optional[str] = None
    status: str = "initialized"
    ws_url: str
    max_turns: int
    created_at: float


class SessionStateResponse(BaseModel):
    """Presentation-safe session status snapshot."""
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    mode: str
    round: str
    current_turn: int
    phase: str
    current_topic: Optional[str] = None
    is_complete: bool = False
    total_questions_asked: int = 0


# ===========================================================================
# 2. Presentation-Safe Question & Turn Projections
# ===========================================================================

class ClientQuestion(BaseModel):
    """Safe question projection sent to candidate UI without internal concepts or edges."""
    model_config = ConfigDict(use_enum_values=True)

    question_id: str
    question_text: str
    turn: int
    round: str
    topic: Optional[str] = None
    difficulty: Optional[str] = None


class ClientTurnResult(BaseModel):
    """Presentation-safe turn acknowledgement."""
    model_config = ConfigDict(use_enum_values=True)

    turn: int
    phase: str
    status: str = "processed"
    round: str


class CandidateSafeReport(BaseModel):
    """Candidate-safe report projection hiding internal deliberative notes."""
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    role: Optional[str] = None
    duration_seconds: Optional[float] = None
    overall_score: float = Field(ge=0.0, le=100.0)
    feedback_summary: str
    key_strengths: List[str] = Field(default_factory=list)
    growth_areas: List[str] = Field(default_factory=list)


class APIErrorResponse(BaseModel):
    """Standardized production API error response model."""
    model_config = ConfigDict(use_enum_values=True)

    error_code: str
    message: str
    detail: Optional[str] = None
    request_id: Optional[str] = None


# ===========================================================================
# 3. WebSocket Message Contracts
# ===========================================================================

class ClientMessageType(str, Enum):
    SESSION_START = "session_start"
    ANSWER_SUBMIT = "answer_submit"
    HEARTBEAT = "heartbeat"
    SESSION_END = "session_end"


class ServerMessageType(str, Enum):
    SESSION_READY = "session_ready"
    QUESTION = "question"
    PROCESSING = "processing"
    TURN_RESULT = "turn_result"
    ROUND_TRANSITION = "round_transition"
    INTERVIEW_COMPLETE = "interview_complete"
    ERROR = "error"


class ClientWSMessage(BaseModel):
    """Envelope for all incoming messages from client WebSocket."""
    model_config = ConfigDict(use_enum_values=True)

    type: ClientMessageType
    session_id: str
    turn: Optional[int] = None
    answer: Optional[str] = None
    idempotency_key: Optional[str] = None
    input_mode: str = "text"  # "text" | "voice"
    stt_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    audio_duration_seconds: Optional[float] = Field(default=None, ge=0.0)
    transcription_status: Optional[str] = "final"

    @field_validator("answer")
    @classmethod
    def validate_answer_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 8000:
            raise ValueError("Candidate answer exceeds maximum permitted length (8000 characters).")
        return v


class ServerWSMessage(BaseModel):
    """Envelope for all outgoing messages to client WebSocket."""
    model_config = ConfigDict(use_enum_values=True)

    type: ServerMessageType
    session_id: str
    turn: Optional[int] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
