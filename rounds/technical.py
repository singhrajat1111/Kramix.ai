"""
Technical Round Strategy for Kramix V2.
Evaluates foundational understanding, applied problem solving, and architectural reasoning.
Zero domain-specific hardcoding (non-negotiable rule #8).
"""
from __future__ import annotations
from typing import Optional, Tuple, Set, List
from schemas.interview_state import InterviewState, RoundType
from schemas.question import Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict
from rounds.base_strategy import BaseRoundStrategy, RoundConstraints, DifficultyProgression, normalize_round_str



class TechnicalRoundStrategy(BaseRoundStrategy):
    """
    Governs technical assessment rounds with adaptive progression:
    Foundational -> Applied -> Architectural.
    """

    def __init__(
        self,
        min_questions: int = 2,
        max_questions: int = 4,
        target_concepts: Optional[Set[str]] = None,
        allowed_topics: Optional[List[str]] = None,
    ):
        self._min_questions = min_questions
        self._max_questions = max_questions
        self._target_concepts = target_concepts or set()
        self._allowed_topics = allowed_topics

    @property
    def round_type(self) -> RoundType:
        return RoundType.TECHNICAL

    @property
    def round_objective(self) -> str:
        return (
            "Assess candidate's core technical comprehension across foundational concepts, "
            "applied problem-solving capabilities, and architectural reasoning."
        )

    def get_constraints(self, state: InterviewState) -> RoundConstraints:
        return RoundConstraints(
            round_type=self.round_type,
            round_objective=self.round_objective,
            allowed_topics=self._allowed_topics,
            preferred_question_types=[
                QuestionType.CONCEPTUAL,
                QuestionType.USE_CASE,
                QuestionType.CLARIFICATION,
                QuestionType.TECHNICAL,
                QuestionType.SYSTEM_DESIGN,
                QuestionType.CODING,
            ],
            allowed_difficulties=[
                Difficulty.FOUNDATIONAL,
                Difficulty.APPLIED,
                Difficulty.ARCHITECTURAL,
            ],
            target_concepts=self._target_concepts,
            min_questions=self._min_questions,
            max_questions=self._max_questions,
            progression_policy="foundational_to_architectural",
            metadata={"domain_neutral": True},
        )

    def evaluate_progression(
        self,
        state: InterviewState,
        verdict: Optional[AnswerVerdict] = None,
    ) -> DifficultyProgression:
        """
        Recommends difficulty adjustment based on candidate evaluation signals.
        Does NOT select questions or decide actions directly.
        """
        if verdict is None:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.FOUNDATIONAL,
                allow_simplification=False,
                allow_deepening=True,
                rationale="Initial turn of Technical round: establishing baseline with foundational question.",
            )

        # Knowledge gap or struggling performance -> de-escalate/simplify
        if verdict.is_dont_know or verdict.correctness < 0.45:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.FOUNDATIONAL,
                allow_simplification=True,
                allow_deepening=False,
                rationale=(
                    f"Candidate expressed knowledge gap (is_dont_know={verdict.is_dont_know}) "
                    f"or low correctness ({verdict.correctness:.2f}); de-escalating to foundational concepts."
                ),
            )

        # High correctness and depth -> escalate to architectural
        if verdict.correctness >= 0.75 and verdict.depth >= 0.60:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.ARCHITECTURAL,
                allow_simplification=False,
                allow_deepening=True,
                rationale=(
                    f"Candidate demonstrated high correctness ({verdict.correctness:.2f}) "
                    f"and strong depth ({verdict.depth:.2f}); escalating to architectural difficulty."
                ),
            )

        # Moderate performance -> maintain applied
        return DifficultyProgression(
            preferred_difficulty=Difficulty.APPLIED,
            allow_simplification=True,
            allow_deepening=True,
            rationale=(
                f"Candidate demonstrated solid applied understanding ({verdict.correctness:.2f}); "
                "maintaining applied difficulty."
            ),
        )

    def should_complete_round(
        self,
        state: InterviewState,
        turn_verdict: Optional[AnswerVerdict] = None,
    ) -> Tuple[bool, str]:
        """
        Evaluates whether technical round objectives have been satisfied.
        """
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

                f"Technical round reached configured maximum question limit ({self._max_questions}); "
                "round objective satisfied.",
            )

        # Check if target concepts were specified and sufficient coverage achieved
        if self._target_concepts and self._target_concepts.issubset(state.covered_concepts):
            if round_turns >= self._min_questions:
                return (
                    True,
                    f"Technical round satisfied all target concept requirements ({len(self._target_concepts)} concepts) "
                    f"after {round_turns} questions.",
                )

        return (
            False,
            f"Technical round in progress ({round_turns}/{self._max_questions} questions asked; "
            "objective not yet fully met).",
        )
