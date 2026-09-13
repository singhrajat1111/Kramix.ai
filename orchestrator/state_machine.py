"""
Kramix V2 State Machine / Orchestrator Core.
Strictly responsible for session lifecycle, phase transitions, and state mutations.
Zero answer evaluation, question selection, or decision choosing logic lives here.
"""
from __future__ import annotations
from typing import Set, Dict
from schemas.interview_state import (
    InterviewState,
    InterviewPhase,
    Decision,
    AskedQuestion,
    Contradiction,
    RunningScores,
)
from schemas.evaluation import AnswerVerdict
from orchestrator.exceptions import (
    InvalidStateTransitionError,
    InterviewCompletedError,
)
from observability.trace import TraceLogger, TraceEvent, global_tracer

# Canonical lifecycle transition rules
VALID_TRANSITIONS: Dict[InterviewPhase, Set[InterviewPhase]] = {
    InterviewPhase.INTRO: {
        InterviewPhase.ASKING,
    },
    InterviewPhase.ASKING: {
        InterviewPhase.LISTENING,
        InterviewPhase.ROUND_COMPLETE,
    },
    InterviewPhase.LISTENING: {
        InterviewPhase.PROCESSING,
    },
    InterviewPhase.PROCESSING: {
        InterviewPhase.RESPONDING,
    },
    InterviewPhase.RESPONDING: {
        InterviewPhase.ASKING,
        InterviewPhase.FOLLOW_UP,
        InterviewPhase.TRANSITIONING,
        InterviewPhase.ROUND_COMPLETE,
    },
    InterviewPhase.FOLLOW_UP: {
        InterviewPhase.LISTENING,
    },
    InterviewPhase.TRANSITIONING: {
        InterviewPhase.ASKING,
        InterviewPhase.ROUND_COMPLETE,
    },
    InterviewPhase.ROUND_COMPLETE: set(),  # Terminal state
}


class InterviewOrchestrator:
    """
    Drives the interview session state machine.
    Enforces valid phase transitions, records turn history, and updates running scores.
    """

    def __init__(self, state: InterviewState, tracer: TraceLogger | None = None):
        self.state = state
        self.tracer = tracer or global_tracer

    @property
    def current_phase(self) -> InterviewPhase:
        return InterviewPhase(self.state.current_state)

    def is_terminal(self) -> bool:
        return self.current_phase == InterviewPhase.ROUND_COMPLETE

    def transition_to(self, target_phase: InterviewPhase, reason: str) -> None:
        """
        Transitions the interview session to a target lifecycle phase.
        Raises InvalidStateTransitionError if the transition violates lifecycle rules.
        Raises InterviewCompletedError if attempting to transition out of terminal state.
        """
        if not reason or not reason.strip():
            raise ValueError("State transitions must have a non-empty human-readable reason string.")

        current = self.current_phase
        if current == InterviewPhase.ROUND_COMPLETE:
            raise InterviewCompletedError(
                f"Cannot transition from terminal state {current} to {target_phase}"
            )

        allowed_targets = VALID_TRANSITIONS.get(current, set())
        if target_phase not in allowed_targets:
            raise InvalidStateTransitionError(
                current_phase=current.value,
                target_phase=target_phase.value,
                reason=f"Valid transitions from {current.value} are {[p.value for p in allowed_targets]}",
            )

        self.state.current_state = target_phase
        self.tracer.record(
            TraceEvent(
                session_id=self.state.session_id,
                turn=self.state.current_turn,
                event_type="transition",
                reason=reason.strip(),
                metadata={"from_phase": current.value, "to_phase": target_phase.value},
            )
        )

    def transition_round(self, new_round: RoundType | str, reason: str) -> None:
        """
        Transitions the interview session to a new round (e.g., TECHNICAL -> PROJECT).
        Validates non-empty reason and updates state.round.
        Records round_transition trace event.
        """
        if not reason or not reason.strip():
            raise ValueError("Round transitions must have a non-empty human-readable reason string.")

        old_round = str(self.state.round.value if hasattr(self.state.round, "value") else self.state.round).lower().replace("roundtype.", "")
        norm_round = str(new_round.value if hasattr(new_round, "value") else new_round).lower().replace("roundtype.", "")
        self.state.round = norm_round

        self.tracer.record(
            TraceEvent(
                session_id=self.state.session_id,
                turn=self.state.current_turn,
                event_type="round_transition",
                reason=reason.strip(),
                metadata={"from_round": old_round, "to_round": norm_round},
            )
        )

    def record_asked_question(self, question_id: str, question_text: str) -> None:
        """
        Records that a concrete question was asked, increments turn count,
        and sets current_question_id.
        """
        if self.is_terminal():
            raise InterviewCompletedError("Cannot ask questions in a completed interview.")

        self.state.current_turn += 1
        r_val = str(self.state.round.value if hasattr(self.state.round, "value") else self.state.round).lower().replace("roundtype.", "")
        asked = AskedQuestion(
            question_id=question_id,
            question_text=question_text,
            asked_at_turn=self.state.current_turn,
            round=r_val,
        )


        self.state.question_history.append(asked)
        self.state.current_question_id = question_id

        self.tracer.record(
            TraceEvent(
                session_id=self.state.session_id,
                turn=self.state.current_turn,
                event_type="question_asked",
                reason=f"Posed question {question_id} to candidate at turn {self.state.current_turn}",
                metadata={"question_id": question_id, "question_text": question_text},
            )
        )

    def apply_decision(self, decision: Decision) -> None:
        """
        Logs and appends an external Decision made by the Decision Engine.
        """
        if self.is_terminal():
            raise InterviewCompletedError("Cannot apply decisions to a completed interview.")

        self.state.previous_decisions.append(decision)
        self.tracer.record(
            TraceEvent(
                session_id=self.state.session_id,
                turn=self.state.current_turn,
                event_type="decision",
                reason=decision.reason,
                metadata={
                    "action": str(decision.action),
                    "target_question_id": decision.target_question_id,
                },
            )
        )

    def update_scores(self, verdict: AnswerVerdict) -> None:
        """
        Updates session concept sets and running score averages with a new AnswerVerdict.
        """
        if self.is_terminal():
            raise InterviewCompletedError("Cannot update scores on a completed interview.")

        # Update concept sets
        for c in verdict.hit_concepts:
            self.state.covered_concepts.add(c)
            if verdict.correctness >= 0.7:
                self.state.strong_concepts.add(c)

        for c in verdict.missed_concepts:
            self.state.missing_concepts.add(c)
            if verdict.correctness < 0.5:
                self.state.weak_concepts.add(c)

        # Update running score averages
        n = len([q for q in self.state.question_history])
        if n == 0:
            n = 1

        scores = self.state.scores

        def _calc_running_avg(old_avg: float, new_val: float) -> float:
            return round(((old_avg * (n - 1)) + new_val) / n, 4)

        scores.correctness_avg = _calc_running_avg(scores.correctness_avg, verdict.correctness)
        scores.depth_avg = _calc_running_avg(scores.depth_avg, verdict.depth)
        scores.relevance_avg = _calc_running_avg(scores.relevance_avg, verdict.relevance)
        scores.completeness_avg = _calc_running_avg(scores.completeness_avg, verdict.completeness)
        scores.clarity_avg = _calc_running_avg(scores.clarity_avg, verdict.clarity)

        if verdict.confidence_signal is not None:
            old_conf = scores.confidence_avg if scores.confidence_avg is not None else verdict.confidence_signal
            scores.confidence_avg = _calc_running_avg(old_conf, verdict.confidence_signal)

        self.tracer.record(
            TraceEvent(
                session_id=self.state.session_id,
                turn=self.state.current_turn,
                event_type="score_update",
                reason=f"Updated running scores for turn {self.state.current_turn}: correctness={scores.correctness_avg:.2f}",
                metadata={
                    "correctness": verdict.correctness,
                    "running_correctness": scores.correctness_avg,
                    "hit_concepts": verdict.hit_concepts,
                    "missed_concepts": verdict.missed_concepts,
                },
            )
        )

    def record_fact(self, slot: str, value: str) -> Contradiction | None:
        """
        Records an extracted candidate claim/fact in fact_slots.
        Detects and logs a Contradiction if a previously asserted slot has a differing value.
        """
        if not slot or not value:
            return None

        slot_clean = slot.strip().lower()
        value_clean = value.strip()

        if slot_clean in self.state.fact_slots:
            earlier_val = self.state.fact_slots[slot_clean]
            if earlier_val.lower() != value_clean.lower():
                # Find turn when earlier fact was asserted or default to 1
                contradiction = Contradiction(
                    slot=slot_clean,
                    earlier_value=earlier_val,
                    later_value=value_clean,
                    earlier_turn=1,
                    later_turn=self.state.current_turn,
                )
                self.state.contradiction_flags.append(contradiction)
                self.tracer.record(
                    TraceEvent(
                        session_id=self.state.session_id,
                        turn=self.state.current_turn,
                        event_type="contradiction",
                        reason=f"Contradiction detected on slot '{slot_clean}': earlier='{earlier_val}' vs later='{value_clean}'",
                        metadata={"slot": slot_clean, "earlier": earlier_val, "later": value_clean},
                    )
                )
                return contradiction

        self.state.fact_slots[slot_clean] = value_clean
        return None
