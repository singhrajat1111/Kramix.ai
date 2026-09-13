"""
Unit and Integration Tests for Kramix V2 Round Strategies & Interview Flow (Phase 10).
Validates:
- Base strategy abstraction and RoundConstraints contracts.
- Technical, Project, Behavioral, and HR concrete round strategies.
- Domain-neutral metadata-driven operation (Rule #8).
- Separation of concerns: Strategy provides policy; QuestionGraph selects questions;
  AnswerEngine evaluates answers; DecisionEngine decides actions; StateMachine enforces lifecycle.
- Multi-round transitions, skipping, and configurable sequences.
- Strict 6-question Demo Mode invariant across single and multi-round configurations.
- Observability tracing of round lifecycle events with articulate reasons (Rule #7).
"""
import pytest
from pathlib import Path
from schemas.interview_state import InterviewState, RoundType, InterviewPhase, DecisionAction
from schemas.question import Question, Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict
from question_engine.loader import load_question_bank_from_json
from orchestrator.state_machine import InterviewOrchestrator
from orchestrator.session_runner import InterviewSession
from observability.trace import TraceLogger, TraceEventType
from memory.candidate_context import CandidateContextMemory, ClaimVerificationStatus
from rounds.base_strategy import BaseRoundStrategy, RoundConstraints, DifficultyProgression
from rounds.technical import TechnicalRoundStrategy
from rounds.project import ProjectRoundStrategy
from rounds.behavioral import BehavioralRoundStrategy
from rounds.hr import HRRoundStrategy
from rounds.manager import InterviewFlowConfig, RoundManager


@pytest.fixture
def question_graph():
    seed_path = Path("src/lib/demo/question-bank-data.json")
    return load_question_bank_from_json(seed_path)


@pytest.fixture
def clean_state():
    return InterviewState(
        session_id="test_strat_session_001",
        mode="demo",
        round=RoundType.TECHNICAL,
        current_topic="core java",
    )


# ---------------------------------------------------------------------------
# 1. Base Strategy Contract & Typings
# ---------------------------------------------------------------------------
class TestBaseStrategyContract:
    def test_strategy_constraints_are_typed_and_non_empty(self, clean_state):
        strat = TechnicalRoundStrategy()
        constraints = strat.get_constraints(clean_state)

        assert isinstance(constraints, RoundConstraints)
        assert constraints.round_type == RoundType.TECHNICAL
        assert len(constraints.round_objective) > 10
        assert len(constraints.preferred_question_types) > 0
        assert len(constraints.allowed_difficulties) > 0
        assert constraints.min_questions >= 1

    def test_strategy_does_not_directly_select_question_ids(self, clean_state):
        strat = TechnicalRoundStrategy()
        constraints = strat.get_constraints(clean_state)
        # Constraints must contain metadata and types, NOT hardcoded question IDs
        assert not hasattr(constraints, "question_id")
        assert not hasattr(constraints, "next_question_id")


# ---------------------------------------------------------------------------
# 2. Technical Round Strategy
# ---------------------------------------------------------------------------
class TestTechnicalRoundStrategy:
    def test_difficulty_progression_adapts_to_candidate_signals(self, clean_state):
        strat = TechnicalRoundStrategy()

        # 1. Initial turn (no verdict yet) -> Foundational baseline
        init_prog = strat.evaluate_progression(clean_state, verdict=None)
        assert init_prog.preferred_difficulty == Difficulty.FOUNDATIONAL
        assert "establishing baseline" in init_prog.rationale.lower()

        # 2. Struggling candidate (low correctness or don't know) -> De-escalate to foundational
        weak_verdict = AnswerVerdict(
            question_id="q1",
            raw_answer="I don't know anything about this topic.",
            covered_concepts=[],
            missing_concepts=["concurrency", "thread pool"],
            correctness_score=0.20,
            depth_score=0.15,
            is_dont_know=True,
            explanation="Candidate has no knowledge of thread pools.",
        )
        prog_weak = strat.evaluate_progression(clean_state, weak_verdict)
        assert prog_weak.preferred_difficulty == Difficulty.FOUNDATIONAL
        assert prog_weak.allow_simplification is True
        assert prog_weak.allow_deepening is False

        # 3. High mastery candidate -> Escalate to architectural
        strong_verdict = AnswerVerdict(
            question_id="q1",
            raw_answer="Raft consensus with Paxos, quorum reads, and distributed leader election.",
            covered_concepts=["raft", "paxos", "quorum"],
            missing_concepts=[],
            correctness=0.92,
            depth=0.85,
            is_dont_know=False,
            explanation="Candidate demonstrated comprehensive consensus algorithm mastery.",
        )

        prog_strong = strat.evaluate_progression(clean_state, strong_verdict)
        assert prog_strong.preferred_difficulty == Difficulty.ARCHITECTURAL
        assert prog_strong.allow_deepening is True

    def test_completion_criteria_explainable(self, clean_state):
        strat = TechnicalRoundStrategy(min_questions=2, max_questions=3)

        # Before reaching quota
        is_done, reason = strat.should_complete_round(clean_state)
        assert is_done is False
        assert "in progress" in reason.lower()

        # Simulate 3 questions asked in state
        clean_state.question_history.extend([
            {"question_id": "q1", "question_text": "text1", "asked_at_turn": 1},
            {"question_id": "q2", "question_text": "text2", "asked_at_turn": 2},
            {"question_id": "q3", "question_text": "text3", "asked_at_turn": 3},
        ])
        is_done, reason = strat.should_complete_round(clean_state)
        assert is_done is True
        assert "limit (3)" in reason


# ---------------------------------------------------------------------------
# 3. Project Round Strategy & Candidate Claims
# ---------------------------------------------------------------------------
class TestProjectRoundStrategy:
    def test_candidate_claims_influence_constraints_without_verified_status(self, clean_state):
        memory = CandidateContextMemory(candidate_id="test_candidate")
        memory.record_claim(
            slot="database",
            value="PostgreSQL",
            source="resume.pdf",
        )
        memory.record_claim(
            slot="caching",
            value="Redis",
            source="resume.pdf",
        )

        strat = ProjectRoundStrategy(candidate_context=memory)

        constraints = strat.get_constraints(clean_state)

        # Constraints must include candidate's claimed technologies
        assert "postgresql" in constraints.target_concepts or "redis" in constraints.target_concepts
        assert constraints.metadata["claims_verified"] is False
        assert constraints.round_type == RoundType.PROJECT

        # Verify claims remain CANDIDATE_CLAIM in memory
        claim = memory.get_latest_claim("database")
        assert claim.status == ClaimVerificationStatus.CANDIDATE_CLAIM


    def test_project_strategy_graceful_without_candidate_context(self, clean_state):
        # Even with zero candidate context / RAG unavailable, project round functions
        strat = ProjectRoundStrategy(candidate_context=None)
        constraints = strat.get_constraints(clean_state)
        assert constraints.round_type == RoundType.PROJECT
        assert "architecture" in constraints.target_concepts
        assert constraints.metadata["has_candidate_context"] is False


# ---------------------------------------------------------------------------
# 4. Behavioral & HR Round Strategies
# ---------------------------------------------------------------------------
class TestBehavioralAndHRRoundStrategies:
    def test_behavioral_strategy_targets_star_competencies(self, clean_state):
        strat = BehavioralRoundStrategy(min_questions=2, max_questions=3)
        constraints = strat.get_constraints(clean_state)

        assert constraints.round_type == RoundType.BEHAVIORAL
        assert "situation" in constraints.target_concepts
        assert "action" in constraints.target_concepts
        assert "outcome" in constraints.target_concepts
        assert QuestionType.BEHAVIORAL in constraints.preferred_question_types

    def test_hr_strategy_does_not_make_hiring_decisions(self, clean_state):
        strat = HRRoundStrategy(max_questions=2)
        constraints = strat.get_constraints(clean_state)

        assert constraints.round_type == RoundType.HR
        assert constraints.metadata["hiring_decision_authority"] is False
        assert "motivation" in constraints.target_concepts
        assert "career_goals" in constraints.target_concepts


# ---------------------------------------------------------------------------
# 5. Round Manager & Transition Sequencing
# ---------------------------------------------------------------------------
class TestRoundManagerAndTransitions:
    def test_sequential_round_flow(self):
        flow = InterviewFlowConfig(
            round_sequence=[
                RoundType.TECHNICAL,
                RoundType.PROJECT,
                RoundType.BEHAVIORAL,
                RoundType.HR,
            ],
            max_total_questions=8,
            round_question_limits={
                RoundType.TECHNICAL: 2,
                RoundType.PROJECT: 2,
                RoundType.BEHAVIORAL: 2,
                RoundType.HR: 2,
            },
        )
        mgr = RoundManager(config=flow)

        assert mgr.get_next_round(RoundType.TECHNICAL) == RoundType.PROJECT
        assert mgr.get_next_round(RoundType.PROJECT) == RoundType.BEHAVIORAL
        assert mgr.get_next_round(RoundType.BEHAVIORAL) == RoundType.HR
        assert mgr.get_next_round(RoundType.HR) is None

        # Verify transition validation
        assert mgr.can_transition(RoundType.TECHNICAL, RoundType.PROJECT) is True
        assert mgr.can_transition(RoundType.TECHNICAL, RoundType.BEHAVIORAL) is True  # skipping allowed
        assert mgr.can_transition(RoundType.HR, RoundType.TECHNICAL) is False  # backwards forbidden

    def test_skipping_round_configuration(self):
        flow = InterviewFlowConfig(
            round_sequence=[RoundType.TECHNICAL, RoundType.BEHAVIORAL],
            max_total_questions=4,
        )
        mgr = RoundManager(config=flow)
        assert mgr.get_next_round(RoundType.TECHNICAL) == RoundType.BEHAVIORAL
        assert mgr.get_next_round(RoundType.BEHAVIORAL) is None


# ---------------------------------------------------------------------------
# 6. Multi-Round Integration & State Machine
# ---------------------------------------------------------------------------
class TestMultiRoundInterviewSession:
    def test_two_round_interview_transitions_smoothly(self, question_graph):
        tracer = TraceLogger()
        flow = InterviewFlowConfig(
            round_sequence=[RoundType.TECHNICAL, RoundType.PROJECT],
            max_total_questions=4,
            round_question_limits={
                RoundType.TECHNICAL: 2,
                RoundType.PROJECT: 2,
            },
        )

        session = InterviewSession(
            session_id="test_multi_round_001",
            round_type=RoundType.TECHNICAL,
            question_graph=question_graph,
            topic="core java",
            max_turns=4,
            flow_config=flow,
            tracer=tracer,
        )

        # 1. Start session -> TECHNICAL round
        q1 = session.start()
        assert q1 is not None
        assert session.state.round == RoundType.TECHNICAL
        assert session.current_phase == InterviewPhase.LISTENING

        # 2. Turn 1 (Technical)
        ans1 = "Java garbage collection uses generational memory with Eden, Survivor spaces, and Tenured generation."
        res1 = session.submit_answer(ans1)
        assert not res1.is_complete
        assert session.state.round == RoundType.TECHNICAL

        # 3. Turn 2 (Technical concludes -> transitions to Project)
        ans2 = "The G1 garbage collector divides memory into regions and prioritizes regions with the most garbage."
        res2 = session.submit_answer(ans2)
        assert not res2.is_complete
        # State machine should have transitioned to PROJECT round!
        assert session.state.round == RoundType.PROJECT
        assert session.current_phase == InterviewPhase.LISTENING

        # Verify trace events for round transition
        events = tracer.get_trace("test_multi_round_001").events
        round_transitions = [e for e in events if e.event_type == "round_transition"]
        assert len(round_transitions) >= 1
        assert round_transitions[0].metadata["from_round"] == "technical"
        assert round_transitions[0].metadata["to_round"] == "project"

        # 4. Turn 3 (Project round)
        ans3 = "In our project we partitioned MongoDB across 3 shards and used Redis for session token caching."
        res3 = session.submit_answer(ans3)
        assert not res3.is_complete
        assert session.state.round == RoundType.PROJECT

        # 5. Turn 4 (Final question in budget -> interview completes)
        ans4 = "We monitored p99 query latency with Prometheus and Grafana alerts."
        res4 = session.submit_answer(ans4)
        assert res4.is_complete is True
        assert session.is_complete is True
        assert session.current_phase == InterviewPhase.ROUND_COMPLETE
        assert session.state.current_turn == 4


# ---------------------------------------------------------------------------
# 7. Demo Mode Invariant: Exactly 6 Questions Guaranteed
# ---------------------------------------------------------------------------
class TestDemoModeExactSixQuestionsInvariant:
    def test_multi_round_demo_strictly_caps_at_six_questions(self, question_graph):
        """
        Guarantees that multiple rounds (e.g. Technical + Project + Behavioral)
        never exceed exactly 6 answered questions total in Demo Mode.
        """
        tracer = TraceLogger()
        flow = InterviewFlowConfig(
            round_sequence=[RoundType.TECHNICAL, RoundType.PROJECT, RoundType.BEHAVIORAL],
            max_total_questions=6,  # Strict production invariant
            round_question_limits={
                RoundType.TECHNICAL: 2,
                RoundType.PROJECT: 2,
                RoundType.BEHAVIORAL: 2,
            },
        )

        session = InterviewSession(
            session_id="test_demo_six_exact",
            round_type=RoundType.TECHNICAL,
            question_graph=question_graph,
            topic="core java",
            max_turns=6,
            flow_config=flow,
            tracer=tracer,
        )

        session.start()

        generic_answer = "This is a detailed technical engineering response explaining systems and architecture."
        turn_count = 0

        while not session.is_complete:
            turn_count += 1
            res = session.submit_answer(generic_answer)
            if res.is_complete:
                break

        # Verification of production guarantee
        assert turn_count == 6
        assert session.state.current_turn == 6
        assert len(session.state.question_history) == 6
        assert session.is_complete is True
        assert session.current_phase == InterviewPhase.ROUND_COMPLETE


# ---------------------------------------------------------------------------
# 8. Observability Lifecycle Verification
# ---------------------------------------------------------------------------
class TestObservabilityRoundLifecycle:
    def test_all_round_lifecycle_events_recorded_with_articulate_reasons(self, question_graph):
        tracer = TraceLogger()
        flow = InterviewFlowConfig(
            round_sequence=[RoundType.TECHNICAL, RoundType.PROJECT],
            max_total_questions=2,
            round_question_limits={
                RoundType.TECHNICAL: 1,
                RoundType.PROJECT: 1,
            },
        )

        session = InterviewSession(
            session_id="test_obs_rounds",
            round_type=RoundType.TECHNICAL,
            question_graph=question_graph,
            topic="core java",
            max_turns=2,
            flow_config=flow,
            tracer=tracer,
        )

        session.start()
        session.submit_answer("First answer for technical round.")
        session.submit_answer("Second answer for project round.")

        trace = tracer.get_trace("test_obs_rounds")
        event_types = [e.event_type for e in trace.events]

        assert "round_started" in event_types
        assert "round_constraints_applied" in event_types
        assert "round_completed" in event_types
        assert "round_transition" in event_types

        # Non-negotiable rule #7: Every event must have a meaningful reason string (len >= 3)
        for e in trace.events:
            assert len(e.reason) >= 3, f"Event {e.event_type} has inadequate reason: '{e.reason}'"
