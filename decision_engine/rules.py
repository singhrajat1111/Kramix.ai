"""
Decision Engine Core (deterministic no-LLM rule table).
Answers 'what should happen next' based on the AnswerVerdict and optional InterviewState.
Zero answer evaluation or question selection logic lives here.
"""
from __future__ import annotations
from typing import Optional
from schemas.evaluation import AnswerVerdict
from schemas.interview_state import Decision, DecisionAction, InterviewState


def decide_next_step(
    verdict: AnswerVerdict,
    state: Optional[InterviewState] = None,
    max_followups_per_question: int = 2,
) -> Decision:
    """
    Rule-table Decision Engine (deterministic / demo-mode path).
    Non-negotiable rule #7: Every decision must set an articulate human-readable `reason`.
    Non-negotiable rule #2: Solely determines next action, never evaluates answers or picks concrete questions.
    """
    # 1. Security defense: instruction override attempt
    if verdict.injection_detected:
        return Decision(
            action=DecisionAction.MOVE_ON,
            reason="Answer contained an instruction-override attempt; security defense triggered, moving to next question.",
        )

    # 2. Candidate knowledge gap signal ("I don't know")
    # Non-negotiable rule #6: Distinct routing signal to simplify, not an automatic penalty
    if verdict.is_dont_know:
        return Decision(
            action=DecisionAction.SIMPLIFY,
            reason="Candidate indicated a knowledge gap; routing to a simpler foundational concept rather than penalizing.",
        )

    # Check if consecutive follow-ups on this question have hit the allowed limit
    if state and len(state.previous_decisions) >= max_followups_per_question:
        recent_actions = [d.action for d in state.previous_decisions[-max_followups_per_question:]]
        if all(a in {DecisionAction.CLARIFY, DecisionAction.DEEPEN} for a in recent_actions):
            return Decision(
                action=DecisionAction.MOVE_ON,
                reason=f"Reached follow-up limit ({max_followups_per_question}) on this question; advancing to next question.",
            )

    # 3. High mastery: high correctness + high depth
    if verdict.correctness >= 0.75 and verdict.depth >= 0.65:
        return Decision(
            action=DecisionAction.DEEPEN,
            reason=(
                f"Strong concept coverage ({verdict.correctness:.0%}) with high depth ({verdict.depth:.0%}); "
                "escalating to an architectural or advanced follow-up."
            ),
        )

    # 4. Partial answer: moderate coverage (missing some concepts)
    if 0.40 <= verdict.correctness < 0.75:
        missing_str = ", ".join(verdict.missed_concepts[:2]) if verdict.missed_concepts else "key concepts"
        return Decision(
            action=DecisionAction.CLARIFY,
            reason=(
                f"Partial answer with {verdict.correctness:.0%} concept coverage (missing: {missing_str}). "
                "Asking a clarification follow-up before moving on."
            ),
        )

    # 5. Low coverage
    if verdict.correctness < 0.40:
        # If candidate attempted with reasonable length, probe for missing concept
        if len(verdict.raw_answer.split()) >= 6:
            missing_str = ", ".join(verdict.missed_concepts[:2]) if verdict.missed_concepts else "expected concepts"
            return Decision(
                action=DecisionAction.CLARIFY,
                reason=(
                    f"Low concept coverage ({verdict.correctness:.0%}); candidate attempted answer but missed {missing_str}. "
                    "Probing before simplifying or moving on."
                ),
            )
        # Extremely brief or off-topic answer -> route to simplify
        return Decision(
            action=DecisionAction.SIMPLIFY,
            reason=(
                f"Very low concept coverage ({verdict.correctness:.0%}) on current difficulty; "
                "routing to a simpler foundational concept."
            ),
        )

    # 6. Default standard progression
    return Decision(
        action=DecisionAction.MOVE_ON,
        reason="Answer satisfied the core evaluation criteria for this question; proceeding to next planned question.",
    )
