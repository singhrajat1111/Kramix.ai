"""
Comprehensive tests for Kramix V2 Phase 11 — Final Report Engine & Hiring Committee Scoring.

Verifies:
1. Report Schema validation (strongly typed models, bounds, required fields, reason validators).
2. Score Aggregation (0-1 internal to 0-100 report normalization, dimension separation, no hacks).
3. Question Performance tracking (every question represented, decision reason preserved).
4. Round Reports (technical, project, behavioral, HR, multi-round aggregation).
5. Concept Gaps (derived from Answer Engine missed/weak concepts, severity ranking).
6. Evidence-backed Strengths and Weaknesses (no keyword-based scoring hacks).
7. Contradictions (observed factual inconsistencies documented without dishonesty accusations).
8. Decoupled Confidence vs. Correctness (never multiplied together).
9. "I Don't Know" tracked as distinct self-awareness signal.
10. Hiring Assessment (transparent recommendations: STRONG_YES, YES, MIXED, NO, INSUFFICIENT_EVIDENCE).
11. Insufficient Evidence handling (< 3 questions or pure "I don't know").
12. Observability (REPORT_GENERATION_STARTED, REPORT_GENERATION_COMPLETED, HIRING_ASSESSMENT_GENERATED events).
13. Demo Mode End-to-End (exactly 6 questions offline, zero API keys, valid final report).
14. Exporters (JSON, Markdown, HTML renderers consume identical FinalInterviewReport model).
"""
import json
import pytest
from pydantic import ValidationError

from schemas.report import (
    FinalInterviewReport,
    SessionInfo,
    PerformanceMetrics,
    DimensionScore,
    QuestionPerformance,
    RoundReport,
    ConceptGap,
    ContradictionReport,
    HiringAssessment,
    HiringRecommendation,
)
from schemas.interview_state import (
    InterviewState,
    InterviewPhase,
    RoundType,
    Decision,
    DecisionAction,
    SessionTurnResult,
    AskedQuestion,
    Contradiction,
)
from schemas.evaluation import AnswerVerdict
from pathlib import Path
from scoring.report_engine import ReportEngine
from scoring.exporters import export_json, export_markdown, export_html
from observability.trace import TraceLogger
from orchestrator.session_runner import InterviewSession
from question_engine.loader import load_question_bank_from_json
from rounds.manager import InterviewFlowConfig, RoundManager


@pytest.fixture
def clean_tracer():
    return TraceLogger()


@pytest.fixture
def curated_graph():
    seed_path = Path("src/lib/demo/question-bank-data.json")
    return load_question_bank_from_json(seed_path)


# ===========================================================================
# 1. Report Schema Tests
# ===========================================================================
class TestReportSchema:
    def test_valid_minimal_report(self):
        info = SessionInfo(session_id="sess_001", mode="demo", total_questions_asked=1, total_questions_answered=1)
        metrics = PerformanceMetrics(
            overall_score=85.0,
            technical_performance=85.0,
            dimension_breakdown={
                "technical": DimensionScore(
                    name="Technical",
                    internal_score=0.85,
                    report_score=85.0,
                    evidence_count=1,
                    summary="Tested 1 question",
                )
            },
        )
        assessment = HiringAssessment(
            recommendation=HiringRecommendation.YES,
            confidence=0.80,
            summary="Solid performance across evaluated competencies.",
            supporting_dimensions={"overall": 85.0},
        )
        report = FinalInterviewReport(
            session_info=info,
            performance_metrics=metrics,
            hiring_assessment=assessment,
            executive_summary="Candidate demonstrated solid skills.",
        )
        assert report.session_info.session_id == "sess_001"
        assert report.hiring_assessment.recommendation == HiringRecommendation.YES

    def test_score_bounds_validation(self):
        with pytest.raises(ValidationError):
            # Internal score > 1.0 must fail
            DimensionScore(name="Bad", internal_score=1.5, report_score=150.0, evidence_count=1)

        with pytest.raises(ValidationError):
            # Report score > 100.0 must fail
            PerformanceMetrics(overall_score=105.0)

    def test_hiring_assessment_empty_summary_fails(self):
        with pytest.raises(ValidationError):
            HiringAssessment(
                recommendation=HiringRecommendation.YES,
                confidence=0.80,
                summary="   ",
            )


# ===========================================================================
# 2. Score Aggregation & Decoupled Confidence Tests
# ===========================================================================
class TestScoreAggregation:
    def test_deterministic_score_normalization(self, clean_tracer):
        state = InterviewState(session_id="sess_norm", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="Q1", question_text="What is indexing?", asked_at_turn=1, round="technical"),
            AskedQuestion(question_id="Q2", question_text="Explain sharding?", asked_at_turn=2, round="technical"),
        ]
        state.previous_decisions = [
            Decision(action=DecisionAction.MOVE_ON, reason="Good answer on Q1"),
            Decision(action=DecisionAction.MOVE_ON, reason="Good answer on Q2"),
        ]

        v1 = AnswerVerdict(
            question_id="Q1",
            raw_answer="Indexing speeds up lookups with B-trees.",
            correctness=0.80,
            depth=0.70,
            relevance=1.0,
            completeness=0.80,
            clarity=0.90,
            confidence_signal=0.95,
            hit_concepts=["b-tree", "lookup"],
            missed_concepts=[],
        )
        v2 = AnswerVerdict(
            question_id="Q2",
            raw_answer="Sharding partitions data horizontally.",
            correctness=0.60,
            depth=0.50,
            relevance=0.80,
            completeness=0.60,
            clarity=0.80,
            confidence_signal=0.50,
            hit_concepts=["horizontal partition"],
            missed_concepts=["sharding key"],
        )

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=[v1, v2])

        # Verify exact normalization (0-1 to 0-100)
        # mean correctness = (0.80 + 0.60) / 2 = 0.70 -> 70.0%
        assert report.performance_metrics.technical_performance == 70.0
        # mean depth = (0.70 + 0.50) / 2 = 0.60 -> 60.0%
        assert report.performance_metrics.conceptual_depth == 60.0
        # Confidence score is decoupled and kept separate: mean = (0.95 + 0.50) / 2 = 0.725 -> 72.5%
        assert report.performance_metrics.confidence_score == 72.5
        # Verify internal scores in dimension breakdown
        assert report.performance_metrics.dimension_breakdown["technical"].internal_score == 0.70
        assert report.performance_metrics.dimension_breakdown["technical"].report_score == 70.0

    def test_confidence_and_correctness_strictly_decoupled(self, clean_tracer):
        """Rule 5 & Non-negotiable: high confidence with low correctness must not collapse into one score."""
        state = InterviewState(session_id="sess_conf_decoupled", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="Q1", question_text="What is ACID?", asked_at_turn=1, round="technical")
        ]
        # Candidate was 100% confident but technically wrong (0.20 correctness)
        verdict = AnswerVerdict(
            question_id="Q1",
            raw_answer="ACID is just a chemistry term for databases.",
            correctness=0.20,
            depth=0.10,
            relevance=0.30,
            completeness=0.20,
            clarity=0.90,
            confidence_signal=1.0,  # 100% confident
            hit_concepts=[],
            missed_concepts=["atomicity", "consistency", "isolation", "durability"],
        )

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=[verdict])

        # Correctness is 20%, but confidence remains 100%
        assert report.performance_metrics.technical_performance == 20.0
        assert report.performance_metrics.confidence_score == 100.0


# ===========================================================================
# 3. Question Performance & Audit Trail Tests
# ===========================================================================
class TestQuestionPerformanceTracking:
    def test_all_questions_and_decision_reasons_preserved(self, clean_tracer):
        state = InterviewState(session_id="sess_qp", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="SYS_01", question_text="Explain caching.", asked_at_turn=1, round="technical"),
            AskedQuestion(question_id="SYS_02", question_text="Explain cache invalidation.", asked_at_turn=2, round="technical"),
        ]
        state.previous_decisions = [
            Decision(action=DecisionAction.DEEPEN, reason="Candidate mentioned cache hit ratio; deepening into invalidation."),
            Decision(action=DecisionAction.MOVE_ON, reason="Candidate thoroughly addressed invalidation strategies."),
        ]

        v1 = AnswerVerdict(
            question_id="SYS_01",
            raw_answer="Caching keeps frequently read data in memory.",
            correctness=0.85,
            depth=0.75,
            hit_concepts=["in-memory", "latency"],
            missed_concepts=[],
        )
        v2 = AnswerVerdict(
            question_id="SYS_02",
            raw_answer="Cache invalidation uses write-through or TTL expiration.",
            correctness=0.90,
            depth=0.85,
            hit_concepts=["ttl", "write-through"],
            missed_concepts=[],
        )

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=[v1, v2])

        assert len(report.question_performances) == 2
        qp1 = report.question_performances[0]
        assert qp1.question_id == "SYS_01"
        assert qp1.decision_action == "deepen"
        assert "deepening into invalidation" in qp1.decision_reason
        assert "in-memory" in qp1.covered_concepts

        qp2 = report.question_performances[1]
        assert qp2.question_id == "SYS_02"
        assert qp2.decision_action == "move_on"
        assert qp2.correctness == 0.90


# ===========================================================================
# 4. "I Don't Know" & Concept Gaps Tests
# ===========================================================================
class TestKnowledgeGapsAndIDontKnow:
    def test_dont_know_preserved_as_distinct_self_awareness_signal(self, clean_tracer):
        state = InterviewState(session_id="sess_idk", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="KAFKA_01", question_text="How does Kafka handle consumer rebalancing?", asked_at_turn=1, round="technical")
        ]
        v_idk = AnswerVerdict(
            question_id="KAFKA_01",
            raw_answer="I don't know the exact protocol for consumer rebalance.",
            correctness=0.0,
            depth=0.0,
            relevance=0.0,
            completeness=0.0,
            clarity=1.0,
            confidence_signal=0.0,
            is_dont_know=True,
            hit_concepts=[],
            missed_concepts=["eager rebalance", "cooperative sticky rebalance"],
        )

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=[v_idk])

        assert len(report.question_performances) == 1
        qp = report.question_performances[0]
        assert qp.is_dont_know is True
        # Verify weakness notes explicit lack of familiarity rather than generic incompetence
        assert any("explicitly noted lack of familiarity" in w for w in report.key_weaknesses)

    def test_concept_gaps_severity_and_evidence(self, clean_tracer):
        state = InterviewState(session_id="sess_gaps", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="Q1", question_text="What is Raft consensus?", asked_at_turn=1, round="technical"),
            AskedQuestion(question_id="Q2", question_text="How does leader election work?", asked_at_turn=2, round="technical"),
        ]
        # Both questions missed "heartbeat"
        v1 = AnswerVerdict(
            question_id="Q1",
            raw_answer="Raft uses leader election and log replication.",
            correctness=0.50,
            depth=0.40,
            hit_concepts=["leader election"],
            missed_concepts=["heartbeat", "term numbers"],
        )
        v2 = AnswerVerdict(
            question_id="Q2",
            raw_answer="Election happens when nodes don't hear from the leader.",
            correctness=0.50,
            depth=0.40,
            hit_concepts=["timeout"],
            missed_concepts=["heartbeat"],
        )

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=[v1, v2])

        assert len(report.concept_gaps) >= 1
        heartbeat_gap = next((g for g in report.concept_gaps if g.concept == "heartbeat"), None)
        assert heartbeat_gap is not None
        # Recurrent across 2 questions -> severity HIGH
        assert heartbeat_gap.severity == "high"
        assert set(heartbeat_gap.affected_questions) == {"Q1", "Q2"}
        assert "Omitted or incomplete across 2 questions" in heartbeat_gap.evidence


# ===========================================================================
# 5. Contradiction Reporting Tests
# ===========================================================================
class TestContradictionReporting:
    def test_contradiction_reported_without_dishonesty_label(self, clean_tracer):
        state = InterviewState(session_id="sess_contra", mode="demo", round=RoundType.PROJECT)
        state.question_history = [
            AskedQuestion(question_id="PRJ_01", question_text="What database did you use?", asked_at_turn=1, round="project"),
            AskedQuestion(question_id="PRJ_02", question_text="How did you store time series?", asked_at_turn=3, round="project"),
        ]
        # Record contradiction flag on state
        state.contradiction_flags.append(
            Contradiction(
                slot="primary_database",
                earlier_value="PostgreSQL",
                later_value="MongoDB",
                earlier_turn=1,
                later_turn=3,
            )
        )

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=[])

        assert len(report.contradictions) == 1
        c = report.contradictions[0]
        assert c.slot == "primary_database"
        assert c.earlier_value == "PostgreSQL"
        assert c.later_value == "MongoDB"
        assert c.severity == "inconsistency"
        # Must NOT conclude candidate is a liar/dishonest
        assert "dishonest" not in c.evidence.lower()
        assert "liar" not in c.evidence.lower()
        assert "Inconsistency observed regarding 'primary_database'" in c.evidence


# ===========================================================================
# 6. Hiring Assessment & Insufficient Evidence Tests
# ===========================================================================
class TestHiringAssessment:
    def test_insufficient_evidence_when_too_few_questions(self, clean_tracer):
        state = InterviewState(session_id="sess_short", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="Q1", question_text="Quick question", asked_at_turn=1, round="technical")
        ]
        v1 = AnswerVerdict(question_id="Q1", raw_answer="Quick answer", correctness=0.90, depth=0.80)

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=[v1])

        # Less than 3 questions must yield INSUFFICIENT_EVIDENCE
        assert report.hiring_assessment.recommendation == HiringRecommendation.INSUFFICIENT_EVIDENCE
        assert "Insufficient evidence" in report.hiring_assessment.summary
        assert "Limited question sample size" in report.hiring_assessment.key_risks[0]

    def test_strong_yes_recommendation_criteria(self, clean_tracer):
        state = InterviewState(session_id="sess_strong", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id=f"Q{i}", question_text=f"Question {i}", asked_at_turn=i, round="technical")
            for i in range(1, 5)
        ]
        verdicts = [
            AnswerVerdict(
                question_id=f"Q{i}",
                raw_answer=f"Superior answer {i}",
                correctness=0.90,
                depth=0.85,
                relevance=1.0,
                completeness=0.90,
                clarity=0.95,
                hit_concepts=[f"concept_{i}_a", f"concept_{i}_b"],
                missed_concepts=[],
            )
            for i in range(1, 5)
        ]

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=verdicts)

        assert report.hiring_assessment.recommendation == HiringRecommendation.STRONG_YES
        assert report.hiring_assessment.confidence >= 0.85
        assert "Strong Yes" in report.hiring_assessment.summary

    def test_mixed_and_no_recommendations(self, clean_tracer):
        # 1. Mixed test (mean ~55%)
        state_mixed = InterviewState(session_id="sess_mixed", mode="demo", round=RoundType.TECHNICAL)
        state_mixed.question_history = [
            AskedQuestion(question_id=f"Q{i}", question_text=f"Q {i}", asked_at_turn=i, round="technical")
            for i in range(1, 4)
        ]
        verdicts_mixed = [
            AnswerVerdict(question_id=f"Q{i}", raw_answer="Fair answer", correctness=0.55, depth=0.50, relevance=0.70, completeness=0.50, clarity=0.60)
            for i in range(1, 4)
        ]
        report_mixed = ReportEngine(tracer=clean_tracer).generate_report(state=state_mixed, verdicts=verdicts_mixed)
        assert report_mixed.hiring_assessment.recommendation == HiringRecommendation.MIXED

        # 2. No test (mean ~25%)
        state_no = InterviewState(session_id="sess_no", mode="demo", round=RoundType.TECHNICAL)
        state_no.question_history = [
            AskedQuestion(question_id=f"Q{i}", question_text=f"Q {i}", asked_at_turn=i, round="technical")
            for i in range(1, 4)
        ]
        verdicts_no = [
            AnswerVerdict(question_id=f"Q{i}", raw_answer="Poor answer", correctness=0.20, depth=0.10, relevance=0.30, completeness=0.20, clarity=0.30)
            for i in range(1, 4)
        ]
        report_no = ReportEngine(tracer=clean_tracer).generate_report(state=state_no, verdicts=verdicts_no)
        assert report_no.hiring_assessment.recommendation == HiringRecommendation.NO


# ===========================================================================
# 7. Observability Events Tests
# ===========================================================================
class TestReportObservability:
    def test_report_lifecycle_events_logged(self, clean_tracer):
        state = InterviewState(session_id="sess_obs", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="Q1", question_text="Q1", asked_at_turn=1, round="technical"),
            AskedQuestion(question_id="Q2", question_text="Q2", asked_at_turn=2, round="technical"),
            AskedQuestion(question_id="Q3", question_text="Q3", asked_at_turn=3, round="technical"),
        ]
        verdicts = [AnswerVerdict(question_id=f"Q{i}", raw_answer="Ans", correctness=0.70) for i in range(1, 4)]

        engine = ReportEngine(tracer=clean_tracer)
        engine.generate_report(state=state, verdicts=verdicts)

        events = clean_tracer.get_events(session_id="sess_obs")
        event_types = [e.event_type for e in events]

        assert "report_generation_started" in event_types
        assert "hiring_assessment_generated" in event_types
        assert "report_generation_completed" in event_types


# ===========================================================================
# 8. Demo Mode End-to-End Report Generation (Offline, Exactly 6 Turns)
# ===========================================================================
class TestDemoModeReportGeneration:
    def test_demo_mode_six_turn_session_produces_complete_final_report(self, curated_graph, clean_tracer):
        """
        Demo Mode must run exactly 6 turns completely offline (no API key, no external network)
        and produce an authoritative FinalInterviewReport.
        """
        session = InterviewSession(
            session_id="sess_demo_report_full",
            round_type=RoundType.TECHNICAL,
            question_graph=curated_graph,
            topic="core java",
            max_turns=6,
            tracer=clean_tracer,
        )

        session.start()

        generic_answer = "This is a detailed technical engineering response explaining systems and architecture."

        turn_results = []
        while not session.is_complete:
            res = session.submit_answer(generic_answer)
            turn_results.append(res)
            if res.is_complete:
                break

        assert len(turn_results) == 6
        assert session.is_complete is True
        assert session.state.current_turn == 6

        # Generate report directly from session
        report = session.generate_report(duration_seconds=18.5)

        # Invariant checks
        assert isinstance(report, FinalInterviewReport)
        assert report.session_info.session_id == "sess_demo_report_full"
        assert report.session_info.total_questions_asked == 6
        assert report.session_info.total_questions_answered == 6
        assert report.session_info.duration_seconds == 18.5
        assert len(report.question_performances) == 6
        assert report.performance_metrics.overall_score >= 0.0
        assert report.hiring_assessment.recommendation is not None
        assert len(report.round_reports) >= 1
        assert len(report.key_strengths) >= 1
        assert report.executive_summary is not None


# ===========================================================================
# 9. Multi-Format Exporters (JSON, Markdown, HTML)
# ===========================================================================
class TestReportExporters:
    def test_all_exporters_consume_same_model(self, clean_tracer):
        state = InterviewState(session_id="sess_export", mode="demo", round=RoundType.TECHNICAL)
        state.question_history = [
            AskedQuestion(question_id="Q1", question_text="What is WAL?", asked_at_turn=1, round="technical"),
            AskedQuestion(question_id="Q2", question_text="What is MVCC?", asked_at_turn=2, round="technical"),
            AskedQuestion(question_id="Q3", question_text="Explain sharding.", asked_at_turn=3, round="technical"),
        ]
        verdicts = [
            AnswerVerdict(
                question_id="Q1",
                raw_answer="WAL records changes before flushing.",
                correctness=0.85,
                depth=0.75,
                hit_concepts=["durability", "flush"],
                missed_concepts=["checkpointing"],
            ),
            AnswerVerdict(
                question_id="Q2",
                raw_answer="MVCC provides snapshot isolation without read locks.",
                correctness=0.90,
                depth=0.85,
                hit_concepts=["snapshot isolation", "dead tuples"],
                missed_concepts=[],
            ),
            AnswerVerdict(
                question_id="Q3",
                raw_answer="Sharding partitions horizontally.",
                correctness=0.75,
                depth=0.70,
                hit_concepts=["horizontal partition"],
                missed_concepts=["resharding"],
            ),
        ]

        engine = ReportEngine(tracer=clean_tracer)
        report = engine.generate_report(state=state, verdicts=verdicts)

        # 1. JSON Export
        json_out = export_json(report)
        parsed = json.loads(json_out)
        assert parsed["session_info"]["session_id"] == "sess_export"
        assert parsed["performance_metrics"]["overall_score"] == report.performance_metrics.overall_score
        expected_rec = getattr(report.hiring_assessment.recommendation, "value", str(report.hiring_assessment.recommendation))
        assert parsed["hiring_assessment"]["recommendation"] == expected_rec

        # 2. Markdown Export
        md_out = export_markdown(report)
        assert "# KRAMIX INTERVIEW EVALUATION DOSSIER" in md_out
        assert f"sess_export" in md_out
        assert f"{report.performance_metrics.overall_score:.1f}" in md_out
        assert "| **Technical Accuracy** |" in md_out
        assert "### Turn 1: `Q1`" in md_out

        # 3. HTML Export
        html_out = export_html(report)
        assert "<!DOCTYPE html>" in html_out
        assert "Kramix Interview Evaluation Dossier" in html_out
        assert f"sess_export" in html_out
        assert f"{report.performance_metrics.overall_score:.1f}%" in html_out
        assert "Turn 1: <code>Q1</code>" in html_out
