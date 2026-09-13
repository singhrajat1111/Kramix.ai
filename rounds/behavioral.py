"""
Behavioral Round Strategy for Kramix V2.
Evaluates collaboration, conflict resolution, communication, leadership, and resilience.
Zero keyword-only scoring (Answer Engine performs rigorous deterministic concept coverage).
"""
from __future__ import annotations
from typing import Optional, Tuple, Set, List
from schemas.interview_state import InterviewState, RoundType
from schemas.question import Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict
from rounds.base_strategy import BaseRoundStrategy, RoundConstraints, DifficultyProgression, normalize_round_str



class BehavioralRoundStrategy(BaseRoundStrategy):
    """
    Governs behavioral assessment rounds exploring teamwork, communication, and leadership.
    """

    def __init__(
        self,
        min_questions: int = 2,
        max_questions: int = 3,
        target_concepts: Optional[Set[str]] = None,
        allowed_topics: Optional[List[str]] = None,
    ):
        self._min_questions = min_questions
        self._max_questions = max_questions
        self._target_concepts = target_concepts or {
            "situation", "action", "reasoning", "outcome", "learning",
            "teamwork", "conflict_resolution", "ownership", "communication",
        }
        self._allowed_topics = allowed_topics

    @property
    def round_type(self) -> RoundType:
        return RoundType.BEHAVIORAL

    @property
    def round_objective(self) -> str:
        return (
            "Evaluate candidate's interpersonal collaboration, communication skills, "
            "conflict handling, adaptability under pressure, and lessons learned from past failures."
        )

    def get_constraints(self, state: InterviewState) -> RoundConstraints:
        return RoundConstraints(
            round_type=self.round_type,
            round_objective=self.round_objective,
            allowed_topics=self._allowed_topics or ["shared behavioral", "behavioral", "general"],
            preferred_question_types=[
                QuestionType.BEHAVIORAL,
                QuestionType.USE_CASE,
                QuestionType.CONCEPTUAL,
            ],
            allowed_difficulties=[
                Difficulty.FOUNDATIONAL,
                Difficulty.APPLIED,
                Difficulty.ARCHITECTURAL,
            ],
            target_concepts=self._target_concepts,
            min_questions=self._min_questions,
            max_questions=self._max_questions,
            progression_policy="adaptive",
            metadata={"evaluation_model": "STAR_informed"},
        )

    def evaluate_progression(
        self,
        state: InterviewState,
        verdict: Optional[AnswerVerdict] = None,
    ) -> DifficultyProgression:
        if verdict is None:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.APPLIED,
                allow_simplification=True,
                allow_deepening=True,
                rationale="Initial behavioral question: establishing situation/action baseline.",
            )

        # If answer was thin or evasive, clarify and keep applied
        if verdict.is_dont_know or verdict.depth < 0.40:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.FOUNDATIONAL,
                allow_simplification=True,
                allow_deepening=False,
                rationale=(
                    f"Candidate response lacked depth ({verdict.depth:.2f}); "
                    "seeking clear situation-action-result structure with foundational follow-up."
                ),
            )

        # If strong STAR reasoning and clear ownership, probe complex conflicts or leadership
        if verdict.correctness >= 0.70 and verdict.depth >= 0.60:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.ARCHITECTURAL,
                allow_simplification=False,
                allow_deepening=True,
                rationale=(
                    f"Candidate articulated compelling action and outcome ({verdict.correctness:.2f}); "
                    "escalating to high-stakes conflict resolution and organizational leadership."
                ),
            )

        return DifficultyProgression(
            preferred_difficulty=Difficulty.APPLIED,
            allow_simplification=True,
            allow_deepening=True,
            rationale="Candidate demonstrated standard behavioral competencies; maintaining applied difficulty.",
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
                f"Behavioral round reached configured maximum of {self._max_questions} questions; "
                "sufficient behavioral signals gathered.",
            )

        return (
            False,
            f"Behavioral round in progress ({round_turns}/{self._max_questions} questions completed).",
        )

