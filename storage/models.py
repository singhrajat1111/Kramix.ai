"""
Storage record models for Kramix V2 database layer.
Strongly typed data representations bridging database rows and memory models.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SessionRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    mode: str = "demo"
    role: Optional[str] = "Database Internals"
    status: str = "initialized"  # "initialized" | "active" | "completed" | "terminated"
    current_phase: str = "INTRO"
    current_round: str = "technical"
    current_turn: int = 0
    max_turns: int = 6
    created_at: float
    updated_at: float
    completed_at: Optional[float] = None
    version: int = 1


class TurnRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    turn: int
    round: str
    question_id: str
    question_text: str
    answer_text: str
    input_mode: str = "text"
    stt_confidence: Optional[float] = None
    audio_duration_seconds: Optional[float] = None
    decision_action: str
    decision_reason: str
    correctness: float
    verdict_json: str
    created_at: float


class StateRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    current_turn: int
    current_phase: str
    state_json: str  # Full serialized InterviewState
    updated_at: float


class ReportRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    report_json: str  # Full serialized FinalInterviewReport
    candidate_summary: str
    hiring_decision: str
    overall_score: float
    created_at: float


class IdempotencyRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    key: str
    session_id: str
    turn: int
    created_at: float
