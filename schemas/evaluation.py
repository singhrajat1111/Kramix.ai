from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict, field_validator


class AnswerVerdict(BaseModel):
    """
    Output of the Answer Engine.
    This is deliberately NOT a single score — the Decision Engine requires
    individual granular signals to decide the next step (non-negotiable rule #2).
    Never collapse this into a single float before reaching the Decision Engine.
    """
    model_config = ConfigDict(use_enum_values=True)

    question_id: str
    raw_answer: str

    # Granular concept coverage breakdown
    concept_coverage: dict[str, bool] = Field(default_factory=dict)   # expected_concept -> found?
    hit_concepts: list[str] = Field(default_factory=list)
    missed_concepts: list[str] = Field(default_factory=list)

    # Core scores (0.0 to 1.0)
    # Non-negotiable rule #4: Correctness is derived from concept coverage, NEVER semantic_similarity alone
    correctness: float = Field(default=0.0, ge=0.0, le=1.0)
    semantic_similarity: float = Field(default=0.0, ge=0.0, le=1.0)
    relevance: float = Field(default=0.0, ge=0.0, le=1.0)
    completeness: float = Field(default=0.0, ge=0.0, le=1.0)
    depth: float = Field(default=0.0, ge=0.0, le=1.0)
    clarity: float = Field(default=0.0, ge=0.0, le=1.0)

    # Non-negotiable rule #5: Confidence/certainty and correctness are strictly separate dimensions.
    # Never fold hedging language into the correctness score directly.
    confidence_signal: float | None = Field(default=None, ge=0.0, le=1.0)
    hedge_phrases_found: list[str] = Field(default_factory=list)

    # Non-negotiable rule #6: "I don't know" is a distinct routing signal for the Decision Engine,
    # not an automatic low score.
    is_dont_know: bool = False

    # Security: Instruction-override / prompt injection attempts
    injection_detected: bool = False
