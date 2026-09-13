"""
Unit tests for Kramix V2 Schemas (Phase 1).
Validates schema integrity, Pydantic contracts, bounds, and architectural rules.
"""
import pytest
from pydantic import ValidationError

from schemas.question import Question, Difficulty, QuestionType
from schemas.evaluation import AnswerVerdict
from schemas.interview_state import (
    InterviewState,
    InterviewPhase,
    RoundType,
    Decision,
    AskedQuestion,
    Contradiction,
    RunningScores,
)
from schemas.provider import Message, MessageRole, ProviderType, ProviderManagerConfig


class TestQuestionSchema:
    def test_question_creation_valid(self):
        q = Question(
            id="q_concurrency_01",
            topic="concurrency",
            subtopic="locks",
            difficulty=Difficulty.APPLIED,
            question_type=QuestionType.CONCEPTUAL,
            question_text="Explain the difference between optimistic and pessimistic locking.",
            expected_concepts=["optimistic locking", "pessimistic locking", "version checks / conflicts"],
            concept_descriptions={
                "optimistic locking": "Validates version or timestamp at commit time without blocking concurrent reads.",
                "pessimistic locking": "Acquires exclusive locks up front to prevent concurrent modifications.",
            },
            possible_followups=["q_concurrency_02"],
        )
        assert q.id == "q_concurrency_01"
        assert q.difficulty == Difficulty.APPLIED.value
        assert len(q.expected_concepts) == 3
        assert len(q.possible_followups) == 1
        assert q.related_questions == []

    def test_question_missing_required_expected_concepts(self):
        with pytest.raises(ValidationError):
            Question(
                id="q_invalid",
                topic="db",
                difficulty=Difficulty.FOUNDATIONAL,
                question_type=QuestionType.CONCEPTUAL,
                question_text="What is an index?",
                # expected_concepts omitted
            )

    def test_question_invalid_enum(self):
        with pytest.raises(ValidationError):
            Question(
                id="q_bad_diff",
                topic="db",
                difficulty="impossible_difficulty",  # type: ignore
                question_type=QuestionType.CONCEPTUAL,
                question_text="Question text",
                expected_concepts=["concept"],
            )


class TestEvaluationSchema:
    def test_verdict_rule_4_similarity_separate_from_correctness(self):
        """Rule 4: Embedding similarity alone must never determine correctness."""
        verdict = AnswerVerdict(
            question_id="q_01",
            raw_answer="It is something about threads.",
            semantic_similarity=0.88,
            correctness=0.20,
            concept_coverage={"thread safety": False, "immutability": False},
            missed_concepts=["thread safety", "immutability"],
        )
        assert verdict.semantic_similarity == 0.88
        assert verdict.correctness == 0.20
        assert verdict.missed_concepts == ["thread safety", "immutability"]

    def test_verdict_rule_5_confidence_separate_from_correctness(self):
        """Rule 5: Confidence/certainty and correctness are separate dimensions."""
        verdict = AnswerVerdict(
            question_id="q_02",
            raw_answer="I might be completely wrong, but L1 drives weights to zero creating sparsity.",
            correctness=0.95,
            confidence_signal=0.30,
            hedge_phrases_found=["I might be completely wrong"],
            hit_concepts=["sparsity", "weights to zero"],
        )
        # Hedging does NOT degrade correctness score directly
        assert verdict.correctness == 0.95
        assert verdict.confidence_signal == 0.30
        assert len(verdict.hedge_phrases_found) == 1

    def test_verdict_rule_6_dont_know_signal(self):
        """Rule 6: 'I don't know' is a distinct signal routed to Decision Engine, not an automatic low score."""
        verdict = AnswerVerdict(
            question_id="q_03",
            raw_answer="I don't know the answer to this question.",
            is_dont_know=True,
            correctness=0.0,
        )
        assert verdict.is_dont_know is True

    def test_verdict_score_bounds_validation(self):
        with pytest.raises(ValidationError):
            AnswerVerdict(
                question_id="q_04",
                raw_answer="Answer",
                correctness=1.5,  # Out of bounds (> 1.0)
            )

        with pytest.raises(ValidationError):
            AnswerVerdict(
                question_id="q_05",
                raw_answer="Answer",
                confidence_signal=-0.1,  # Out of bounds (< 0.0)
            )


class TestInterviewStateSchema:
    def test_decision_rule_7_reason_required(self):
        """Rule 7: Every non-trivial decision must include a human-readable reason string."""
        d = Decision(
            action="deepen",
            reason="Candidate demonstrated complete mastery of concurrency primitives; escalating to distributed locks.",
            target_question_id="q_dist_locks_01",
        )
        assert d.action == "deepen"
        assert len(d.reason) > 0

    def test_decision_empty_reason_fails(self):
        with pytest.raises(ValidationError):
            Decision(action="move_on", reason="")

        with pytest.raises(ValidationError):
            Decision(action="move_on", reason="   ")

    def test_interview_state_defaults_and_mutation(self):
        state = InterviewState(
            session_id="sess_12345",
            round=RoundType.TECHNICAL,
            mode="demo",
        )
        assert state.current_state == InterviewPhase.INTRO.value
        assert state.current_turn == 0
        assert len(state.question_history) == 0
        assert len(state.covered_concepts) == 0

        # Add asked question
        state.question_history.append(
            AskedQuestion(
                question_id="q_01",
                question_text="What is a process?",
                asked_at_turn=1,
            )
        )
        assert len(state.question_history) == 1
        assert state.question_history[0].question_id == "q_01"

        # Concept tracking
        state.covered_concepts.add("process isolation")
        assert "process isolation" in state.covered_concepts

    def test_contradiction_slot_recording(self):
        c = Contradiction(
            slot="database_choice",
            earlier_value="PostgreSQL",
            later_value="MongoDB",
            earlier_turn=2,
            later_turn=5,
        )
        assert c.slot == "database_choice"
        assert c.earlier_turn == 2
        assert c.later_turn == 5


class TestProviderSchema:
    def test_message_creation(self):
        msg = Message(role=MessageRole.USER, content="Hello")
        assert msg.role == MessageRole.USER.value
        assert msg.content == "Hello"

    def test_provider_manager_config(self):
        config = ProviderManagerConfig(max_retries=2, timeout_seconds=5.0)
        assert config.max_retries == 2
        assert config.timeout_seconds == 5.0
