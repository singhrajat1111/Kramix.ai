"""
Core interview state schema. Single source of truth that Orchestrator,
Question Engine, Answer Engine, and Decision Engine all read and write against.
"""
from __future__ import annotations
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class InterviewPhase(str, Enum):
    INTRO = "INTRO"
    QUESTION = "QUESTION"
    ASKING = "ASKING"
    LISTENING = "LISTENING"
    PROCESSING = "PROCESSING"
    RESPONDING = "RESPONDING"
    FOLLOW_UP = "FOLLOW_UP"
    TRANSITIONING = "TRANSITIONING"
    ROUND_COMPLETE = "ROUND_COMPLETE"


class RoundType(str, Enum):
    TECHNICAL = "technical"
    PROJECT = "project"
    BEHAVIORAL = "behavioral"
    HR = "hr"


class AskedQuestion(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    question_id: str
    question_text: str
    asked_at_turn: int
    round: Optional[RoundType | str] = None



class Contradiction(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    slot: str  # e.g. "database_used"
    earlier_value: str
    later_value: str
    earlier_turn: int
    later_turn: int


class RunningScores(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    correctness_avg: float = Field(default=0.0, ge=0.0, le=1.0)
    depth_avg: float = Field(default=0.0, ge=0.0, le=1.0)
    relevance_avg: float = Field(default=0.0, ge=0.0, le=1.0)
    completeness_avg: float = Field(default=0.0, ge=0.0, le=1.0)
    clarity_avg: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence_avg: float | None = Field(default=None, ge=0.0, le=1.0)


class DecisionAction(str, Enum):
    DEEPEN = "deepen"
    CLARIFY = "clarify"
    MOVE_ON = "move_on"
    SIMPLIFY = "simplify"
    TRANSITION_TOPIC = "transition_topic"


class Decision(BaseModel):
    """
    Output of the Decision Engine.
    Non-negotiable rule #7: Every non-trivial decision must be logged with a
    human-readable reason string. If you cannot articulate why, the logic is incomplete.
    """
    model_config = ConfigDict(use_enum_values=True)

    action: DecisionAction
    reason: str = Field(..., min_length=3)  # Required non-empty string explaining the decision
    target_question_id: str | None = None

    @field_validator("reason")
    @classmethod
    def validate_reason_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Decision reason must be a non-empty human-readable explanation.")
        return v.strip()


class InterviewState(BaseModel):
    """
    Complete state of an ongoing interview session.
    """
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    mode: str = "demo"  # "demo" | "api"
    round: RoundType
    current_state: InterviewPhase = InterviewPhase.INTRO
    current_turn: int = 0

    current_question_id: str | None = None
    question_history: list[AskedQuestion] = Field(default_factory=list)

    current_topic: str | None = None
    covered_concepts: set[str] = Field(default_factory=set)
    weak_concepts: set[str] = Field(default_factory=set)
    missing_concepts: set[str] = Field(default_factory=set)
    strong_concepts: set[str] = Field(default_factory=set)

    scores: RunningScores = Field(default_factory=RunningScores)
    previous_decisions: list[Decision] = Field(default_factory=list)
    contradiction_flags: list[Contradiction] = Field(default_factory=list)

    # Opportunistically extracted candidate facts for contradiction detection
    fact_slots: dict[str, str] = Field(default_factory=dict)


class SessionTurnResult(BaseModel):
    """
    Result returned at the conclusion of an interview turn.
    Packaged for observability and client communication.
    """
    model_config = ConfigDict(use_enum_values=True)

    turn: int
    phase: InterviewPhase
    verdict: Optional[Any] = None  # AnswerVerdict
    decision: Optional[Decision] = None
    next_question: Optional[Any] = None  # Question
    is_complete: bool = False
    state: InterviewState
