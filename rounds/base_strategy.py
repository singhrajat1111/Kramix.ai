"""
Base Round Strategy abstraction and RoundConstraints schema for Kramix V2.
Defines round objectives, constraints, progression policies, and completion criteria.

CRITICAL ARCHITECTURAL RULES:
1. NEVER directly evaluate candidate answers (Answer Engine is authoritative).
2. NEVER directly select arbitrary question IDs (Question Engine / QuestionGraph is authoritative).
3. NEVER directly make hiring decisions (Deferred to Report Engine / Hiring Committee).
4. NEVER override StateMachine or DecisionEngine.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional, Set, List, Dict, Any, Tuple
from pydantic import BaseModel, Field, ConfigDict

from schemas.interview_state import InterviewState, RoundType
from schemas.question import Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict


def normalize_round_str(r: Any) -> str:
    """Consistently normalizes any RoundType enum, string, or repr to lowercase string value."""
    if hasattr(r, "value"):
        return str(r.value).lower().strip()
    s = str(r).lower().strip()
    if s.startswith("roundtype."):
        return s.split(".", 1)[1]
    return s



class DifficultyProgression(BaseModel):

    """
    Recommended difficulty adjustment based on candidate performance metrics.
    Note: RoundStrategy recommends/constrains difficulty; QuestionGraph remains
    authoritative for selecting the actual concrete question.
    """
    model_config = ConfigDict(use_enum_values=True)

    preferred_difficulty: Difficulty
    allow_simplification: bool = True
    allow_deepening: bool = True
    rationale: str = Field(..., min_length=3)


class RoundConstraints(BaseModel):
    """
    Policy constraints supplied by a RoundStrategy to the Question Engine and Decision Engine.
    """
    model_config = ConfigDict(use_enum_values=True)

    round_type: RoundType
    round_objective: str
    allowed_topics: Optional[List[str]] = None
    preferred_question_types: List[QuestionType] = Field(default_factory=list)
    allowed_difficulties: List[Difficulty] = Field(default_factory=list)
    target_concepts: Set[str] = Field(default_factory=set)
    excluded_concepts: Set[str] = Field(default_factory=set)
    min_questions: int = 1
    max_questions: Optional[int] = None
    progression_policy: str = "adaptive"  # "adaptive" | "foundational_to_architectural" | "exploratory"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseRoundStrategy(ABC):
    """
    Generic Round Strategy interface.
    Governs round constraints, progression policy, and completion criteria.
    """

    @property
    @abstractmethod
    def round_type(self) -> RoundType:
        """The RoundType this strategy governs."""
        pass

    @property
    @abstractmethod
    def round_objective(self) -> str:
        """High-level objective of this round."""
        pass

    @abstractmethod
    def get_constraints(self, state: InterviewState) -> RoundConstraints:
        """
        Produces RoundConstraints reflecting round objective, pacing, and allowed questions.
        """
        pass

    @abstractmethod
    def evaluate_progression(
        self,
        state: InterviewState,
        verdict: Optional[AnswerVerdict] = None,
    ) -> DifficultyProgression:
        """
        Evaluates preferred difficulty progression based on candidate performance signals.
        """
        pass

    @abstractmethod
    def should_complete_round(
        self,
        state: InterviewState,
        turn_verdict: Optional[AnswerVerdict] = None,
    ) -> Tuple[bool, str]:
        """
        Determines if the round has met its completion criteria.
        Returns (is_complete, human_readable_reason).
        """
        pass
