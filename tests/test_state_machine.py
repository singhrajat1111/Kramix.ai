"""
Unit tests for Kramix V2 State Machine / Orchestrator Core (Phase 2).
Verifies lifecycle phase transitions, turn tracking, running scores, and contradiction detection.
"""
import pytest
from schemas.interview_state import (
    InterviewState,
    InterviewPhase,
    RoundType,
    Decision,
    DecisionAction,
)
from schemas.evaluation import AnswerVerdict
from orchestrator.state_machine import InterviewOrchestrator
from orchestrator.exceptions import InvalidStateTransitionError, InterviewCompletedError
from observability.trace import TraceLogger


@pytest.fixture
def clean_state():
    return InterviewState(
        session_id="test_sess_001",
        mode="demo",
        round=RoundType.TECHNICAL,
    )


@pytest.fixture
def tracer():
    return TraceLogger()


class TestStateTransitions:
    def test_complete_valid_lifecycle(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        assert orch.current_phase == InterviewPhase.INTRO

        # INTRO -> ASKING
        orch.transition_to(InterviewPhase.ASKING, reason="Starting first question")
        assert orch.current_phase == InterviewPhase.ASKING

        # ASKING -> LISTENING
        orch.transition_to(InterviewPhase.LISTENING, reason="Interviewer finished question audio")
        assert orch.current_phase == InterviewPhase.LISTENING

        # LISTENING -> PROCESSING
        orch.transition_to(InterviewPhase.PROCESSING, reason="Candidate finished speaking")
        assert orch.current_phase == InterviewPhase.PROCESSING

        # PROCESSING -> RESPONDING
        orch.transition_to(InterviewPhase.RESPONDING, reason="Answer evaluation and decision ready")
        assert orch.current_phase == InterviewPhase.RESPONDING

        # RESPONDING -> FOLLOW_UP
        orch.transition_to(InterviewPhase.FOLLOW_UP, reason="Posing follow-up probe")
        assert orch.current_phase == InterviewPhase.FOLLOW_UP

        # FOLLOW_UP -> LISTENING
        orch.transition_to(InterviewPhase.LISTENING, reason="Listening to candidate follow-up response")
        assert orch.current_phase == InterviewPhase.LISTENING

        # LISTENING -> PROCESSING -> RESPONDING
        orch.transition_to(InterviewPhase.PROCESSING, reason="Processing candidate follow-up")
        orch.transition_to(InterviewPhase.RESPONDING, reason="Ready with topic transition feedback")

        # RESPONDING -> TRANSITIONING
        orch.transition_to(InterviewPhase.TRANSITIONING, reason="Transitioning to system design topic")
        assert orch.current_phase == InterviewPhase.TRANSITIONING

        # TRANSITIONING -> ASKING
        orch.transition_to(InterviewPhase.ASKING, reason="Asking system design question")
        assert orch.current_phase == InterviewPhase.ASKING

        # ASKING -> LISTENING -> PROCESSING -> RESPONDING -> ROUND_COMPLETE
        orch.transition_to(InterviewPhase.LISTENING, reason="Candidate listening")
        orch.transition_to(InterviewPhase.PROCESSING, reason="Evaluating final answer")
        orch.transition_to(InterviewPhase.RESPONDING, reason="Delivering wrap up summary")
        orch.transition_to(InterviewPhase.ROUND_COMPLETE, reason="All allocated turns finished")

        assert orch.current_phase == InterviewPhase.ROUND_COMPLETE
        assert orch.is_terminal() is True

    def test_invalid_transition_rejected(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        assert orch.current_phase == InterviewPhase.INTRO

        # INTRO cannot transition directly to PROCESSING
        with pytest.raises(InvalidStateTransitionError) as exc_info:
            orch.transition_to(InterviewPhase.PROCESSING, reason="Illegal jump to processing")
        assert "INTRO to PROCESSING" in str(exc_info.value)

    def test_terminal_state_rejects_further_transitions(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        orch.transition_to(InterviewPhase.ASKING, reason="start")
        orch.transition_to(InterviewPhase.LISTENING, reason="mic active")
        orch.transition_to(InterviewPhase.PROCESSING, reason="processing")
        orch.transition_to(InterviewPhase.RESPONDING, reason="responding")
        orch.transition_to(InterviewPhase.ROUND_COMPLETE, reason="completed")

        with pytest.raises(InterviewCompletedError):
            orch.transition_to(InterviewPhase.ASKING, reason="Attempt after complete")

    def test_empty_transition_reason_rejected(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        with pytest.raises(ValueError):
            orch.transition_to(InterviewPhase.ASKING, reason="")
        with pytest.raises(ValueError):
            orch.transition_to(InterviewPhase.ASKING, reason="   ")


class TestTurnAndQuestionTracking:
    def test_record_asked_question(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        assert clean_state.current_turn == 0

        orch.record_asked_question(
            question_id="q_concurrency_01",
            question_text="Explain thread safety in Java.",
        )
        assert clean_state.current_turn == 1
        assert clean_state.current_question_id == "q_concurrency_01"
        assert len(clean_state.question_history) == 1
        assert clean_state.question_history[0].asked_at_turn == 1

        orch.record_asked_question(
            question_id="q_concurrency_02",
            question_text="How does synchronized differ from ReentrantLock?",
        )
        assert clean_state.current_turn == 2
        assert clean_state.current_question_id == "q_concurrency_02"
        assert len(clean_state.question_history) == 2


class TestDecisionApplication:
    def test_apply_decision_records_and_traces(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        decision = Decision(
            action=DecisionAction.DEEPEN,
            reason="Strong coverage demonstrated; escalating to advanced lock-free primitives.",
            target_question_id="q_lockfree_01",
        )
        orch.apply_decision(decision)

        assert len(clean_state.previous_decisions) == 1
        assert clean_state.previous_decisions[0].action == DecisionAction.DEEPEN
        assert clean_state.previous_decisions[0].target_question_id == "q_lockfree_01"

        events = tracer.get_events(session_id=clean_state.session_id)
        decision_events = [e for e in events if e.event_type == "decision"]
        assert len(decision_events) == 1
        assert decision_events[0].reason == decision.reason


class TestScoreAggregation:
    def test_running_scores_calculation(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        orch.record_asked_question("q1", "Question 1")

        # Turn 1 verdict: correctness=0.8, depth=0.7
        v1 = AnswerVerdict(
            question_id="q1",
            raw_answer="Answer 1",
            correctness=0.8,
            depth=0.7,
            relevance=1.0,
            completeness=0.8,
            clarity=0.9,
            confidence_signal=0.85,
            hit_concepts=["immutability", "volatile"],
            missed_concepts=["memory barrier"],
        )
        orch.update_scores(v1)

        scores = clean_state.scores
        assert scores.correctness_avg == 0.8
        assert scores.depth_avg == 0.7
        assert "immutability" in clean_state.covered_concepts
        assert "immutability" in clean_state.strong_concepts
        assert "memory barrier" in clean_state.missing_concepts

        # Turn 2 verdict: correctness=0.4, depth=0.5
        orch.record_asked_question("q2", "Question 2")
        v2 = AnswerVerdict(
            question_id="q2",
            raw_answer="Answer 2",
            correctness=0.4,
            depth=0.5,
            relevance=0.8,
            completeness=0.6,
            clarity=0.7,
            confidence_signal=0.55,
            hit_concepts=["cas operation"],
            missed_concepts=["aba problem"],
        )
        orch.update_scores(v2)

        # Average: (0.8 + 0.4) / 2 = 0.6
        assert scores.correctness_avg == 0.6
        # Depth average: (0.7 + 0.5) / 2 = 0.6
        assert scores.depth_avg == 0.6
        # Missed concept with correctness < 0.5 flagged in weak concepts
        assert "aba problem" in clean_state.weak_concepts


class TestFactSlotsAndContradictions:
    def test_consistent_facts_stored(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        res = orch.record_fact("primary_database", "PostgreSQL")
        assert res is None
        assert clean_state.fact_slots["primary_database"] == "PostgreSQL"
        assert len(clean_state.contradiction_flags) == 0

    def test_conflicting_fact_triggers_contradiction(self, clean_state, tracer):
        orch = InterviewOrchestrator(clean_state, tracer=tracer)
        clean_state.current_turn = 1
        orch.record_fact("database", "PostgreSQL")

        clean_state.current_turn = 3
        contradiction = orch.record_fact("database", "MongoDB")

        assert contradiction is not None
        assert contradiction.slot == "database"
        assert contradiction.earlier_value == "PostgreSQL"
        assert contradiction.later_value == "MongoDB"
        assert contradiction.later_turn == 3
        assert len(clean_state.contradiction_flags) == 1

        events = tracer.get_events(session_id=clean_state.session_id)
        contra_events = [e for e in events if e.event_type == "contradiction"]
        assert len(contra_events) == 1
        assert "Contradiction detected" in contra_events[0].reason
