from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class Difficulty(str, Enum):
    FOUNDATIONAL = "foundational"
    APPLIED = "applied"
    ARCHITECTURAL = "architectural"


class QuestionType(str, Enum):
    CONCEPTUAL = "conceptual"
    MATHEMATICAL = "mathematical"
    USE_CASE = "use_case"
    CLARIFICATION = "clarification"
    TECHNICAL = "technical"
    PROJECT = "project"
    BEHAVIORAL = "behavioral"
    HR = "hr"
    CODING = "coding"
    SYSTEM_DESIGN = "system_design"



class Question(BaseModel):
    """
    Authoritative representation of an interview question in the Question Graph.
    Contains explicit expected concepts to enable deterministic evaluation without an LLM.
    """
    model_config = ConfigDict(use_enum_values=True)

    id: str
    topic: str
    subtopic: str | None = None
    difficulty: Difficulty
    question_type: QuestionType
    question_text: str

    # Required for deterministic evaluation without an LLM (non-negotiable rule #1)
    expected_concepts: list[str]
    concept_descriptions: dict[str, str] = Field(default_factory=dict)  # concept -> canonical description

    related_concepts: list[str] = Field(default_factory=list)
    prerequisite_concepts: list[str] = Field(default_factory=list)

    # Question Graph edges
    possible_followups: list[str] = Field(default_factory=list)
    related_questions: list[str] = Field(default_factory=list)
