"""
HR Round Strategy for Kramix V2.
Assesses candidate motivation, career goals, role expectations, and professional alignment.
Zero hiring decisions or arbitrary rejection rules live here (non-negotiable rule #1).
"""
from __future__ import annotations
from typing import Optional, Tuple, Set, List
from schemas.interview_state import InterviewState, RoundType
from schemas.question import Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict
from rounds.base_strategy import BaseRoundStrategy, RoundConstraints, DifficultyProgression, normalize_round_str



class HRRoundStrategy(BaseRoundStrategy):
    """
    Governs HR and culture alignment inquiry.
    Maintains professional conversational pacing without making hiring decisions.
    """

    def __init__(
        self,
        min_questions: int = 1,
        max_questions: int = 2,
        target_concepts: Optional[Set[str]] = None,
        allowed_topics: Optional[List[str]] = None,
    ):
        self._min_questions = min_questions
        self._max_questions = max_questions
        self._target_concepts = target_concepts or {
            "motivation", "career_goals", "role_expectations",
            "work_preferences", "communication", "availability",
        }
        self._allowed_topics = allowed_topics

    @property
    def round_type(self) -> RoundType:
        return RoundType.HR

    @property
    def round_objective(self) -> str:
        return (
            "Assess candidate's career goals, role expectations, work preferences, "
            "motivation for the position, and general professional alignment."
        )

    def get_constraints(self, state: InterviewState) -> RoundConstraints:
        return RoundConstraints(
            round_type=self.round_type,
            round_objective=self.round_objective,
            allowed_topics=self._allowed_topics or ["shared behavioral", "hr", "general"],
            preferred_question_types=[
                QuestionType.HR,
                QuestionType.BEHAVIORAL,
                QuestionType.USE_CASE,
                QuestionType.CONCEPTUAL,
            ],
            allowed_difficulties=[
                Difficulty.FOUNDATIONAL,
                Difficulty.APPLIED,
            ],
            target_concepts=self._target_concepts,
            min_questions=self._min_questions,
            max_questions=self._max_questions,
            progression_policy="conversational",
            metadata={"hiring_decision_authority": False},
        )

    def evaluate_progression(
        self,
        state: InterviewState,
        verdict: Optional[AnswerVerdict] = None,
    ) -> DifficultyProgression:
        # HR rounds maintain steady foundational/applied pacing without artificial difficulty spikes
        return DifficultyProgression(
            preferred_difficulty=Difficulty.FOUNDATIONAL,
            allow_simplification=False,
            allow_deepening=True,
            rationale="HR round maintains accessible, foundational alignment dialogue.",
        )

    def should_complete_round(
        self,
        state: InterviewState,
        turn_verdict: Optional[AnswerVerdict] = None,
    ) -> Tuple[bool, str]:
        cur_round = normalize_round_str(self.round_type)
        matching = [q for q in state.question_history if normalize_round_str(getattr(q, "round", "") or "") == cur_round]
        if not matching and any(getattr(q, "round", None) for q in state.question_history):
            round_turns = 0
        elif not matching:
            round_turns = len(state.question_history)
        else:
            round_turns = len(matching)


        if round_turns >= self._max_questions:
            return (
                True,
                f"HR round concluded after {self._max_questions} questions; alignment data collected.",
            )

        return (
            False,
            f"HR round in progress ({round_turns}/{self._max_questions} questions completed).",
        )

