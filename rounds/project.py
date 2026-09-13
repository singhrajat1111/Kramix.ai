"""
Project Round Strategy for Kramix V2.
Explores candidate-specific projects, architecture, technology choices, trade-offs, and ownership.
Integrates with CandidateContextMemory while treating candidate claims as unverified.
"""
from __future__ import annotations
from typing import Optional, Tuple, Set, List, Dict, Any
from schemas.interview_state import InterviewState, RoundType
from schemas.question import Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict
from rounds.base_strategy import BaseRoundStrategy, RoundConstraints, DifficultyProgression, normalize_round_str

from memory.candidate_context import CandidateContextMemory, ClaimVerificationStatus


class ProjectRoundStrategy(BaseRoundStrategy):
    """
    Governs candidate project deep-dives.
    Consumes candidate context/claims without treating them as verified ground truth.
    """

    def __init__(
        self,
        min_questions: int = 2,
        max_questions: int = 3,
        candidate_context: Optional[CandidateContextMemory] = None,
        target_project_name: Optional[str] = None,
        allowed_topics: Optional[List[str]] = None,
    ):
        self._min_questions = min_questions
        self._max_questions = max_questions
        self._candidate_context = candidate_context
        self._target_project_name = target_project_name
        self._allowed_topics = allowed_topics

    @property
    def round_type(self) -> RoundType:
        return RoundType.PROJECT

    @property
    def round_objective(self) -> str:
        return (
            "Explore candidate's claimed project experience, architectural decisions, "
            "technology tradeoffs, debugging scenarios, and technical ownership."
        )

    def get_constraints(self, state: InterviewState) -> RoundConstraints:
        target_concepts: Set[str] = {"architecture", "tradeoffs", "ownership", "debugging", "scale"}
        metadata: Dict[str, Any] = {
            "has_candidate_context": self._candidate_context is not None,
            "claims_verified": False,  # Explicitly unverified (Rule #13)
        }

        # Extract claimed technologies or project domains from candidate context memory
        if self._candidate_context:
            claims = self._candidate_context.get_all_claims()
            claimed_technologies = [
                c.value for c in claims.values()
                if c.status == ClaimVerificationStatus.CANDIDATE_CLAIM
            ]
            if claimed_technologies:
                metadata["claimed_technologies"] = claimed_technologies
                # Augment target concepts with candidate's claimed stack
                target_concepts.update(tech.lower().strip() for tech in claimed_technologies)

            if self._target_project_name:
                metadata["target_project"] = self._target_project_name

        return RoundConstraints(
            round_type=self.round_type,
            round_objective=self.round_objective,
            allowed_topics=self._allowed_topics,
            preferred_question_types=[
                QuestionType.PROJECT,
                QuestionType.USE_CASE,
                QuestionType.SYSTEM_DESIGN,
                QuestionType.TECHNICAL,
                QuestionType.CONCEPTUAL,
            ],
            allowed_difficulties=[
                Difficulty.FOUNDATIONAL,
                Difficulty.APPLIED,
                Difficulty.ARCHITECTURAL,
            ],
            target_concepts=target_concepts,
            min_questions=self._min_questions,
            max_questions=self._max_questions,
            progression_policy="exploratory",
            metadata=metadata,
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
                rationale="Opening project round: probing applied architectural and implementation choices.",
            )

        if verdict.is_dont_know or verdict.correctness < 0.45:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.FOUNDATIONAL,
                allow_simplification=True,
                allow_deepening=False,
                rationale=(
                    f"Candidate struggled on claimed project detail (correctness={verdict.correctness:.2f}); "
                    "stepping back to clarify foundational requirements and core design decisions."
                ),
            )

        if verdict.correctness >= 0.75 and verdict.depth >= 0.60:
            return DifficultyProgression(
                preferred_difficulty=Difficulty.ARCHITECTURAL,
                allow_simplification=False,
                allow_deepening=True,
                rationale=(
                    f"Candidate demonstrated deep ownership ({verdict.correctness:.2f}); "
                    "escalating to complex tradeoffs, failure recovery, and architectural scale."
                ),
            )

        return DifficultyProgression(
            preferred_difficulty=Difficulty.APPLIED,
            allow_simplification=True,
            allow_deepening=True,
            rationale="Candidate demonstrated clear applied knowledge; continuing project exploration.",
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
                f"Project round completed: reached configured limit of {self._max_questions} questions "
                "probing project architecture, decisions, and ownership.",
            )

        return (
            False,
            f"Project round in progress ({round_turns}/{self._max_questions} questions completed).",
        )

