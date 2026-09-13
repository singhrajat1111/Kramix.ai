"""
Strongly typed schema definitions for Kramix V2 Final Interview Report & Hiring Committee Dossier.
Single source of truth for reporting, dossier rendering, and multi-format exports.

CRITICAL ARCHITECTURAL RULES:
1. Report Engine is an aggregation and synthesis layer, NOT a second evaluation brain.
2. Confidence and Correctness remain separate dimensions; never multiplied together.
3. "I don't know" is tracked as a self-awareness knowledge gap, not an automatic penalty.
4. Contradictions are documented as inconsistencies, never as definitive proof of dishonesty.
5. Missing evidence produces INSUFFICIENT_EVIDENCE instead of an opaque guess.
"""
from __future__ import annotations
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class HiringRecommendation(str, Enum):
    STRONG_YES = "strong_yes"
    YES = "yes"
    MIXED = "mixed"
    NO = "no"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class SessionInfo(BaseModel):
    """Metadata regarding the executed interview session."""
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    mode: str = "demo"  # "demo" | "api"
    role: Optional[str] = None
    completion_status: str = "completed"  # "completed" | "terminated_early" | "in_progress"
    total_questions_asked: int = Field(default=0, ge=0)
    total_questions_answered: int = Field(default=0, ge=0)
    duration_seconds: Optional[float] = Field(default=None, ge=0.0)


class DimensionScore(BaseModel):
    """Score for a specific evaluated competency dimension with internal (0-1) and report (0-100) scales."""
    model_config = ConfigDict(use_enum_values=True)

    name: str
    internal_score: float = Field(ge=0.0, le=1.0)
    report_score: float = Field(ge=0.0, le=100.0)
    evidence_count: int = Field(default=0, ge=0)
    summary: str = ""


class PerformanceMetrics(BaseModel):
    """
    Normalized multi-dimensional performance scores on 0-100 scale.
    Correctness and confidence are strictly decoupled.
    """
    model_config = ConfigDict(use_enum_values=True)

    overall_score: float = Field(ge=0.0, le=100.0)
    technical_performance: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    conceptual_depth: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    relevance: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    completeness: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    communication: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    problem_solving: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    project_knowledge: Optional[float] = Field(default=None, ge=0.0, le=100.0)

    # Non-negotiable Rule #5: Confidence is strictly separated from correctness
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    dimension_breakdown: Dict[str, DimensionScore] = Field(default_factory=dict)


class QuestionPerformance(BaseModel):
    """Granular audit record of a single question and candidate response."""
    model_config = ConfigDict(use_enum_values=True)

    turn: int
    question_id: str
    question_text: str
    round: str
    topic: str
    difficulty: str
    question_type: str
    candidate_answer: str

    # Answer Engine scores (0.0 to 1.0)
    correctness: float = Field(ge=0.0, le=1.0)
    depth: float = Field(ge=0.0, le=1.0)
    relevance: float = Field(ge=0.0, le=1.0)
    completeness: float = Field(ge=0.0, le=1.0)
    clarity: float = Field(ge=0.0, le=1.0)
    confidence_signal: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    is_dont_know: bool = False
    injection_detected: bool = False

    covered_concepts: List[str] = Field(default_factory=list)
    missing_concepts: List[str] = Field(default_factory=list)

    decision_action: Optional[str] = None
    decision_reason: Optional[str] = None
    explanation: Optional[str] = None


class RoundReport(BaseModel):
    """Aggregated performance metrics and qualitative synthesis for an individual interview round."""
    model_config = ConfigDict(use_enum_values=True)

    round: str
    questions_answered: int = Field(ge=0)
    round_score: float = Field(ge=0.0, le=100.0)
    concepts_covered: List[str] = Field(default_factory=list)
    concepts_missing: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    completion_reason: str
    notable_evidence: List[str] = Field(default_factory=list)


class ConceptGap(BaseModel):
    """Structured knowledge gap derived directly from Answer Engine missed and weak concepts."""
    model_config = ConfigDict(use_enum_values=True)

    concept: str
    affected_questions: List[str] = Field(default_factory=list)
    severity: str = "medium"  # "high" | "medium" | "low"
    evidence: str
    recommended_learning_direction: str


class ContradictionReport(BaseModel):
    """Detailed report on observed factual contradictions across turns."""
    model_config = ConfigDict(use_enum_values=True)

    slot: str
    earlier_value: str
    later_value: str
    earlier_turn: int
    later_turn: int
    severity: str = "inconsistency"
    evidence: str


class HiringAssessment(BaseModel):
    """
    Transparent, evidence-based recommendation for hiring committee review.
    Replaces opaque numeric thresholds with defensible dimensional synthesis.
    """
    model_config = ConfigDict(use_enum_values=True)

    recommendation: HiringRecommendation
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    supporting_dimensions: Dict[str, float] = Field(default_factory=dict)
    key_strengths: List[str] = Field(default_factory=list)
    key_risks: List[str] = Field(default_factory=list)
    evidence_citations: List[str] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)

    @field_validator("summary")
    @classmethod
    def validate_summary_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("HiringAssessment summary must be non-empty.")
        return v.strip()


class FinalInterviewReport(BaseModel):
    """
    Complete, authoritative dossier summarizing an interview session.
    Feeds multi-format exporters (JSON, Markdown, HTML, PDF).
    """
    model_config = ConfigDict(use_enum_values=True)

    session_info: SessionInfo
    performance_metrics: PerformanceMetrics
    hiring_assessment: HiringAssessment
    round_reports: List[RoundReport] = Field(default_factory=list)
    question_performances: List[QuestionPerformance] = Field(default_factory=list)
    concept_gaps: List[ConceptGap] = Field(default_factory=list)
    key_strengths: List[str] = Field(default_factory=list)
    key_weaknesses: List[str] = Field(default_factory=list)
    contradictions: List[ContradictionReport] = Field(default_factory=list)
    executive_summary: str
