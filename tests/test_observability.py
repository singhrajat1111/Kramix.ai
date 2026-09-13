"""
Unit and integration tests for Kramix V2 Observability & Trace Engine (Phase 7).
Verifies structured event logging, mandatory reason validation, session traces, and export formats.
"""
from pathlib import Path
import json
import pytest
from pydantic import ValidationError

from schemas.interview_state import RoundType
from question_engine.loader import load_question_bank_from_json
from orchestrator.session_runner import InterviewSession
from observability.trace import (
    TraceEvent,
    TraceEventType,
    SessionTrace,
    TraceLogger,
)
from observability.exporter import format_markdown_audit, format_json_trace


class TestTraceEventValidation:
    def test_trace_event_creation_valid(self):
        e = TraceEvent(
            session_id="sess_100",
            turn=1,
            event_type=TraceEventType.DECISION_MADE,
            reason="Escalating difficulty because candidate achieved 90% concept coverage with high depth.",
            metadata={"action": "deepen"},
        )
        assert e.session_id == "sess_100"
        assert e.turn == 1
        assert "Escalating difficulty" in e.reason

    def test_trace_event_empty_reason_fails(self):
        """Rule 7: Decisions and transitions must have articulate reasons."""
        with pytest.raises(ValidationError):
            TraceEvent(
                session_id="sess_101",
                turn=1,
                event_type=TraceEventType.DECISION_MADE,
                reason="",
            )

        with pytest.raises(ValidationError):
            TraceEvent(
                session_id="sess_101",
                turn=1,
                event_type=TraceEventType.DECISION_MADE,
                reason="   ",
            )


class TestSessionTraceAndFiltering:
    def test_session_trace_categorization(self):
        trace = SessionTrace("sess_200")
        trace.add_event(
            TraceEvent(
                session_id="sess_200",
                turn=1,
                event_type=TraceEventType.QUESTION_ASKED,
                reason="Posed foundational question on memory management.",
            )
        )
        trace.add_event(
            TraceEvent(
                session_id="sess_200",
                turn=1,
                event_type=TraceEventType.DECISION_MADE,
                reason="Candidate answered strongly; deepening.",
                metadata={"action": "deepen"},
            )
        )
        trace.add_event(
            TraceEvent(
                session_id="sess_200",
                turn=2,
                event_type=TraceEventType.CONTRADICTION_FLAGGED,
                reason="Contradiction on database choice.",
                metadata={"slot": "database"},
            )
        )

        assert len(trace.get_timeline()) == 3
        assert len(trace.get_questions()) == 1
        assert len(trace.get_decisions()) == 1
        assert len(trace.get_contradictions()) == 1


class TestExporters:
    def test_format_markdown_audit(self):
        trace = SessionTrace("sess_300")
        trace.add_event(
            TraceEvent(
                session_id="sess_300",
                turn=1,
                event_type=TraceEventType.QUESTION_ASKED,
                reason="Selected initial question on Java concurrency.",
            )
        )
        trace.add_event(
            TraceEvent(
                session_id="sess_300",
                turn=1,
                event_type=TraceEventType.DECISION_MADE,
                reason="Partial coverage; clarifying missing synchronized lock concept.",
                metadata={"action": "clarify"},
            )
        )

        md = format_markdown_audit(trace)
        assert "# Interview Decision & Observability Audit: `sess_300`" in md
        assert "Turn 1" in md
        assert "Action: `CLARIFY`" in md
        assert "Partial coverage" in md

    def test_format_json_trace(self):
        trace = SessionTrace("sess_301")
        trace.add_event(
            TraceEvent(
                session_id="sess_301",
                turn=1,
                event_type=TraceEventType.PHASE_TRANSITION,
                reason="Transitioned from INTRO to ASKING.",
            )
        )
        json_str = format_json_trace(trace)
        data = json.loads(json_str)
        assert data["session_id"] == "sess_301"
        assert data["total_events"] == 1
        assert data["events"][0]["reason"] == "Transitioned from INTRO to ASKING."


class TestProductionSixQuestionSessionTrace:
    def test_production_default_six_turn_session_observability(self):
        """Simulates full 6-question interview session to verify end-to-end trace audit."""
        seed_path = Path("src/lib/demo/question-bank-data.json")
        graph = load_question_bank_from_json(seed_path)
        tracer = TraceLogger()

        # Notice: max_turns defaults to 6 for production standard
        session = InterviewSession(
            session_id="sess_prod_6q",
            round_type=RoundType.TECHNICAL,
            question_graph=graph,
            topic="core java",
            tracer=tracer,
        )
        assert session.max_turns == 6

        session.start()
        # Answer turns 1 to 6
        for turn_idx in range(1, 7):
            res = session.submit_answer(
                f"Turn {turn_idx}: Standard Java explanation of concurrency, garbage collection, and collections."
            )
            if turn_idx < 6:
                assert not res.is_complete
            else:
                assert res.is_complete is True

        assert session.is_complete is True
        assert session.state.current_turn == 6

        trace = tracer.get_session_trace("sess_prod_6q")
        assert len(trace.get_questions()) == 6
        assert len(trace.get_decisions()) == 6

        # Verify audit generation
        audit_md = format_markdown_audit(trace)
        assert "Total Questions Posed**: 6" in audit_md
        assert "Total Engine Decisions**: 6" in audit_md
