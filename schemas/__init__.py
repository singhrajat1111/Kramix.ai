"""
Kramix V2 Schemas Package
Authoritative contracts for Question Engine, Answer Engine, Decision Engine, and Interview State.
"""
from schemas.question import Question, Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict
from schemas.interview_state import (
    InterviewState,
    InterviewPhase,
    RoundType,
    Decision,
    DecisionAction,
    AskedQuestion,
    Contradiction,
    RunningScores,
    SessionTurnResult,
)
from schemas.provider import Message, MessageRole, ProviderType

__all__ = [
    "Question",
    "Difficulty",
    "QuestionType",
    "AnswerVerdict",
    "InterviewState",
    "InterviewPhase",
    "RoundType",
    "Decision",
    "DecisionAction",
    "AskedQuestion",
    "Contradiction",
    "RunningScores",
    "SessionTurnResult",
    "Message",
    "MessageRole",
    "ProviderType",
]
