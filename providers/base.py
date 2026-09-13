"""
Kramix V2 Provider Abstraction.
Defines strongly-typed, provider-agnostic interfaces and models for LLM integrations.
The LLM is a component plugged into Kramix, never the interviewer brain (non-negotiable rule #1).
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
from schemas.question import Difficulty, QuestionType
from schemas.provider import Message


class QuestionProposal(BaseModel):
    """
    Structured question proposal emitted by an LLM provider.
    Must be validated through QuestionValidator before entering the QuestionGraph or interview.
    """
    model_config = ConfigDict(use_enum_values=True)

    topic: str
    subtopic: Optional[str] = None
    difficulty: Difficulty
    question_type: QuestionType
    question_text: str = Field(..., min_length=10)
    expected_concepts: List[str] = Field(..., min_length=1)
    concept_descriptions: Dict[str, str] = Field(default_factory=dict)
    rationale: str = Field(default="Candidate context follow-up")

    @field_validator("question_text", "topic")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be empty or whitespace.")
        return v.strip()


class EvaluationAssistResult(BaseModel):
    """
    Structured advisory evaluation assistance from an LLM provider.
    Used by the Answer Engine as an auxiliary nuance signal; never replaces deterministic scoring.
    """
    model_config = ConfigDict(use_enum_values=True)

    concept_alignment: Dict[str, bool] = Field(default_factory=dict)
    nuanced_observations: List[str] = Field(default_factory=list)
    suggested_depth: float = Field(default=0.5, ge=0.0, le=1.0)
    hedge_signals: List[str] = Field(default_factory=list)
    raw_explanation: str = ""


class ProviderError(Exception):
    """Base exception for provider failures."""
    pass


class ProviderTimeoutError(ProviderError):
    """Raised when an external provider call exceeds the configured timeout."""
    pass


class ProviderRateLimitError(ProviderError):
    """Raised when provider rate limits or quotas are exceeded."""
    pass


class ProviderAuthenticationError(ProviderError):
    """Raised when provider authentication/API key fails. NEVER exposes the raw key."""
    pass


class ProviderResponseError(ProviderError):
    """Raised when provider returns an unparseable or malformed response."""
    pass


class BaseLLMProvider(ABC):
    """
    Provider-agnostic interface for external or demo LLM implementations.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier, e.g. 'demo', 'openai', 'gemini', 'anthropic'."""
        pass

    @abstractmethod
    async def generate_text(self, messages: List[Message], temperature: float = 0.7) -> str:
        """Generates raw text response."""
        pass

    @abstractmethod
    async def propose_question(
        self,
        topic: str,
        difficulty: Difficulty,
        context_summary: str,
        target_concepts: Optional[List[str]] = None,
    ) -> QuestionProposal:
        """Proposes a question based on current interview context."""
        pass

    @abstractmethod
    async def assist_evaluation(
        self,
        question_text: str,
        expected_concepts: List[str],
        answer_text: str,
    ) -> EvaluationAssistResult:
        """Advisory second-pass evaluation assisting the Answer Engine."""
        pass
