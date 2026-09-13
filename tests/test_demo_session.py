"""
End-to-End Integration Tests for Kramix V2 Demo Mode Session (Phase 6).
Simulates multi-turn offline interviews with varied candidate answers:
high mastery, partial answer, knowledge gap, and contradiction detection.
"""
from pathlib import Path
import pytest
from schemas.interview_state import RoundType, InterviewPhase, DecisionAction
from question_engine.loader import load_question_bank_from_json
from orchestrator.session_runner import InterviewSession
from orchestrator.exceptions import InvalidStateTransitionError, InterviewCompletedError
from observability.trace import TraceLogger


@pytest.fixture
def question_graph():
    seed_path = Path("src/lib/demo/question-bank-data.json")
    return load_question_bank_from_json(seed_path)


class TestDemoSessionRunner:
    def test_full_multi_turn_interview_lifecycle(self, question_graph):
        tracer = TraceLogger()
        session = InterviewSession(
            session_id="test_demo_session_001",
            round_type=RoundType.TECHNICAL,
            question_graph=question_graph,
            topic="core java",
            max_turns=3,
            tracer=tracer,
        )

        assert session.current_phase == InterviewPhase.INTRO
        assert not session.is_complete

        # 1. Start session
        initial_q = session.start()
        assert initial_q is not None
        assert session.current_phase == InterviewPhase.LISTENING
        assert session.state.current_turn == 1
        assert len(session.state.question_history) == 1

        # 2. Turn 1: Candidate submits a strong answer
        strong_ans = (
            "The system uses partition tolerance with consensus algorithms like Raft and Paxos, "
            "handling network partitions with quorum mechanisms, leader election, and log replication."
        )
        res1 = session.submit_answer(strong_ans, fact_slot_claims={"cache_tier": "Redis"})
        assert res1.verdict is not None
        assert res1.decision is not None
        assert res1.turn == 2  # next turn queued
        assert not res1.is_complete
        assert session.current_phase == InterviewPhase.LISTENING
        assert session.state.fact_slots["cache_tier"] == "Redis"

        # 3. Turn 2: Candidate indicates a knowledge gap ("I don't know")
        res2 = session.submit_answer("I don't know the answer to this specific detail, haven't used it.")
        assert res2.verdict.is_dont_know is True
        assert res2.decision.action == DecisionAction.SIMPLIFY
        assert not res2.is_complete
        assert res2.turn == 3

        # 4. Turn 3: Candidate submits answer on final turn (max_turns=3 reached)
        res3 = session.submit_answer("We maintain consistency by replicating data across multiple nodes.")
        assert res3.is_complete is True
        assert res3.next_question is None
        assert res3.phase == InterviewPhase.ROUND_COMPLETE
        assert session.is_complete is True

        # 5. Verify that submitting an answer after completion raises InterviewCompletedError
        with pytest.raises(InterviewCompletedError):
            session.submit_answer("Another answer after round complete")

        # 6. Verify observability trace integrity (Rule #7)
        events = tracer.get_events(session_id="test_demo_session_001")
        assert len(events) >= 10, f"Expected at least 10 logged trace events, got {len(events)}"
        for event in events:
            assert event.reason and len(event.reason) >= 3, f"Event {event} missing human-readable reason"

    def test_contradiction_detection_across_turns(self, question_graph):
        session = InterviewSession(
            session_id="test_contradiction_sess",
            round_type=RoundType.TECHNICAL,
            question_graph=question_graph,
            topic="core java",
            max_turns=3,
        )
        session.start()

        # Turn 1: asserts PostgreSQL
        session.submit_answer("We use PostgreSQL as our primary database.", fact_slot_claims={"database": "PostgreSQL"})
        assert session.state.fact_slots["database"] == "PostgreSQL"
        assert len(session.state.contradiction_flags) == 0

        # Turn 2: asserts MongoDB for the same slot
        session.submit_answer("Our primary database is MongoDB.", fact_slot_claims={"database": "MongoDB"})
        assert len(session.state.contradiction_flags) == 1
        contra = session.state.contradiction_flags[0]
        assert contra.slot == "database"
        assert contra.earlier_value == "PostgreSQL"
        assert contra.later_value == "MongoDB"

    def test_premature_answer_submission_fails(self, question_graph):
        session = InterviewSession(
            session_id="test_premature_sess",
            round_type=RoundType.TECHNICAL,
            question_graph=question_graph,
        )
        # Session in INTRO; submit_answer should fail because it is not LISTENING
        with pytest.raises(InvalidStateTransitionError):
            session.submit_answer("Premature answer")
