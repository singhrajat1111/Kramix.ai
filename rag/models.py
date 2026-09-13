"""
Data models for Kramix V2 RAG and Context Memory Engine.
Separates candidate context chunks, claims, and retrieval results from interview decision state.
"""
from __future__ import annotations
from enum import Enum
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class ContextSourceType(str, Enum):
    RESUME = "resume"
    PROJECT = "project"
    EXPERIENCE = "experience"
    EDUCATION = "education"
    SKILL = "skill"
    CANDIDATE_CLAIM = "candidate_claim"


class ClaimVerificationStatus(str, Enum):
    """
    Non-negotiable requirement #13:
    Candidate claims from resumes/interviews are NOT automatically treated as verified facts.
    """
    CANDIDATE_CLAIM = "candidate_claim"        # Stated in resume or portfolio (unverified)
    INTERVIEW_CLAIM = "interview_claim"        # Spoken during interview turn (unverified)
    VERIFIED_FACT = "verified_fact"            # Externally proven or demonstrated
    SYSTEM_OBSERVATION = "system_observation"  # Directly scored or observed by the engine


class CandidateContext(BaseModel):
    """
    Top-level contextual record for a candidate.
    """
    model_config = ConfigDict(use_enum_values=True)

    candidate_id: str
    session_id: Optional[str] = None
    source_type: ContextSourceType
    source_id: str
    title: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: float = Field(default_factory=time.time)


class ContextChunk(BaseModel):
    """
    Discrete, retrieval-friendly unit of candidate context.
    """
    model_config = ConfigDict(use_enum_values=True)

    chunk_id: str
    source_id: str
    candidate_id: str
    source_type: ContextSourceType
    section: str = "general"
    title: str
    chunk_index: int
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: float = Field(default_factory=time.time)


class RetrievalResult(BaseModel):
    """
    Structured outcome of a context retrieval operation.
    Requirement #9: Retrieval must be transparent and explain WHY it was retrieved.
    """
    model_config = ConfigDict(use_enum_values=True)

    chunk_id: str
    source_id: str
    title: str
    section: str
    content: str
    similarity_score: float = Field(default=0.0, ge=0.0, le=1.0)
    retrieval_reason: str = Field(..., min_length=3)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ParsedDocument(BaseModel):
    """
    Structured representation of a parsed candidate document.
    """
    model_config = ConfigDict(use_enum_values=True)

    filename: str
    format: str  # "pdf" | "docx" | "txt"
    raw_text: str
    sections: Dict[str, str] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    parsed_at: float = Field(default_factory=time.time)
