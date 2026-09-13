"""
Interview Flow Manager and Strategy Configuration for Kramix V2.
Orchestrates round transitions, sequence policies, and global question budgeting.
Ensures Demo Mode adheres strictly to the 6-question invariant.
"""
from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, Field, ConfigDict

from schemas.interview_state import InterviewState, RoundType
from schemas.evaluation import AnswerVerdict
from rounds.base_strategy import BaseRoundStrategy, RoundConstraints, normalize_round_str
from rounds.technical import TechnicalRoundStrategy
from rounds.project import ProjectRoundStrategy
from rounds.behavioral import BehavioralRoundStrategy
from rounds.hr import HRRoundStrategy
from memory.candidate_context import CandidateContextMemory


class InterviewFlowConfig(BaseModel):
    """
    Configuration defining the interview flow: round sequence, question quotas, and limits.
    """
    model_config = ConfigDict(use_enum_values=True)

    round_sequence: List[RoundType] = Field(
        default_factory=lambda: [RoundType.TECHNICAL]
    )
    max_total_questions: int = 6  # Production Demo Mode invariant: exactly 6 questions
    round_question_limits: Dict[RoundType, int] = Field(default_factory=dict)
    allow_skipping: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RoundManager:
    """
    Manages active RoundStrategy instances according to an InterviewFlowConfig.
    Enforces transitions between rounds without replacing the State Machine or Decision Engine.
    """

    def __init__(
        self,
        config: Optional[InterviewFlowConfig] = None,
        candidate_context: Optional[CandidateContextMemory] = None,
        custom_strategies: Optional[Dict[RoundType, BaseRoundStrategy]] = None,
    ):
        self.config = config or InterviewFlowConfig()
        self.candidate_context = candidate_context

        # Register default strategies or custom overrides
        self._strategies: Dict[RoundType, BaseRoundStrategy] = {}
        defaults = self._create_default_strategies()
        for r_type, strat in defaults.items():
            self._strategies[r_type] = strat

        if custom_strategies:
            for r_type, strat in custom_strategies.items():
                self._strategies[r_type] = strat

    def _create_default_strategies(self) -> Dict[RoundType, BaseRoundStrategy]:
        # Compute default per-round limits based on total budget and sequence length
        seq_len = max(1, len(self.config.round_sequence))
        default_per_round = max(1, self.config.max_total_questions // seq_len)

        limits = self.config.round_question_limits
        allowed_topics = self.config.metadata.get("allowed_topics") if self.config.metadata else None

        return {
            RoundType.TECHNICAL: TechnicalRoundStrategy(
                max_questions=limits.get(RoundType.TECHNICAL, default_per_round),
                allowed_topics=allowed_topics,
            ),
            RoundType.PROJECT: ProjectRoundStrategy(
                max_questions=limits.get(RoundType.PROJECT, default_per_round),
                candidate_context=self.candidate_context,
            ),
            RoundType.BEHAVIORAL: BehavioralRoundStrategy(
                max_questions=limits.get(RoundType.BEHAVIORAL, default_per_round),
            ),
            RoundType.HR: HRRoundStrategy(
                max_questions=limits.get(RoundType.HR, default_per_round),
            ),
        }

    def get_strategy(self, round_type: RoundType | str) -> BaseRoundStrategy:
        """Retrieves the strategy governing the specified RoundType."""
        norm = RoundType(normalize_round_str(round_type))
        if norm not in self._strategies:
            # Fallback to generic technical strategy if missing
            self._strategies[norm] = TechnicalRoundStrategy()
        return self._strategies[norm]

    def get_current_strategy(self, state: InterviewState) -> BaseRoundStrategy:
        """Retrieves the strategy governing the current interview state round."""
        return self.get_strategy(state.round)

    def get_next_round(self, current_round: RoundType | str) -> Optional[RoundType]:
        """
        Determines the next round in the configured sequence.
        Returns None if the current round is the final round.
        """
        str_seq = [normalize_round_str(r) for r in self.config.round_sequence]
        cur_str = normalize_round_str(current_round)
        try:
            idx = str_seq.index(cur_str)
            if idx + 1 < len(str_seq):
                return RoundType(str_seq[idx + 1])
            return None
        except ValueError:
            return None

    def can_transition(self, current_round: RoundType | str, next_round: RoundType | str) -> bool:
        """Validates that a transition between the two rounds is permissible."""
        str_seq = [normalize_round_str(r) for r in self.config.round_sequence]
        cur_str = normalize_round_str(current_round)
        next_str = normalize_round_str(next_round)

        if cur_str not in str_seq or next_str not in str_seq:
            return False
        if not self.config.allow_skipping:
            return str_seq.index(next_str) == str_seq.index(cur_str) + 1
        return str_seq.index(next_str) > str_seq.index(cur_str)

    def check_round_transition(
        self,
        state: InterviewState,
        verdict: Optional[AnswerVerdict] = None,
    ) -> Tuple[bool, Optional[RoundType], str]:
        """
        Checks whether the current round has concluded and identifies the next round.
        Returns (is_round_complete, next_round, reason).
        """
        strat = self.get_current_strategy(state)
        is_complete, reason = strat.should_complete_round(state, turn_verdict=verdict)

        if not is_complete:
            return False, None, reason

        # Check total question budget constraint
        total_asked = len(state.question_history)
        if total_asked >= self.config.max_total_questions:
            return (
                True,
                None,
                f"{reason} (Global question limit reached: {total_asked}/{self.config.max_total_questions}).",
            )

        # Check next round in sequence
        next_round = self.get_next_round(state.round)
        if next_round:
            next_name = normalize_round_str(next_round)
            return (
                True,
                next_round,
                f"{reason} Transitioning to next configured round: {next_name}.",
            )

        return (
            True,
            None,
            f"{reason} All configured rounds in sequence have been completed.",
        )


