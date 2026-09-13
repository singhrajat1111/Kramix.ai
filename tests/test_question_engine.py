"""
Unit tests for Kramix V2 Question Engine (Phase 3).
Verifies QuestionGraph traversal, deterministic question selection, and seed data loader.
"""
from pathlib import Path
import pytest
from schemas.question import Question, Difficulty, QuestionType
from schemas.interview_state import DecisionAction
from question_engine.graph import QuestionGraph
from question_engine.loader import (
    load_question_bank_from_dict_list,
    load_question_bank_from_json,
)


@pytest.fixture
def sample_graph():
    graph = QuestionGraph()
    q1 = Question(
        id="q_concurrency_01",
        topic="concurrency",
        subtopic="locks",
        difficulty=Difficulty.FOUNDATIONAL,
        question_type=QuestionType.CONCEPTUAL,
        question_text="What is a race condition?",
        expected_concepts=["shared mutable state", "unsynchronized access"],
        possible_followups=["q_concurrency_02"],
        related_questions=["q_concurrency_03"],
    )
    q2 = Question(
        id="q_concurrency_02",
        topic="concurrency",
        subtopic="locks",
        difficulty=Difficulty.APPLIED,
        question_type=QuestionType.CONCEPTUAL,
        question_text="How do optimistic and pessimistic locking differ in high-contention scenarios?",
        expected_concepts=["optimistic lock", "pessimistic lock", "contention overhead"],
        possible_followups=["q_concurrency_04"],
    )
    q3 = Question(
        id="q_concurrency_03",
        topic="concurrency",
        subtopic="immutability",
        difficulty=Difficulty.FOUNDATIONAL,
        question_type=QuestionType.CONCEPTUAL,
        question_text="How does object immutability prevent race conditions?",
        expected_concepts=["read-only state", "thread safety by design"],
    )
    q4 = Question(
        id="q_concurrency_04",
        topic="concurrency",
        subtopic="distributed",
        difficulty=Difficulty.ARCHITECTURAL,
        question_type=QuestionType.USE_CASE,
        question_text="Design a distributed locking mechanism using Redis or etcd.",
        expected_concepts=["lease / ttl", "heartbeat", "split-brain handling"],
    )
    q5 = Question(
        id="q_storage_01",
        topic="storage",
        difficulty=Difficulty.FOUNDATIONAL,
        question_type=QuestionType.CONCEPTUAL,
        question_text="What is the difference between B-Tree and LSM-Tree storage engines?",
        expected_concepts=["random writes vs sequential writes", "write amplification", "compaction"],
    )

    for q in [q1, q2, q3, q4, q5]:
        graph.add_question(q)
    return graph


class TestQuestionGraphTraversal:
    def test_get_initial_question(self, sample_graph):
        q, reason = sample_graph.get_initial_question(topic="concurrency", difficulty=Difficulty.FOUNDATIONAL)
        assert q is not None
        assert q.id in {"q_concurrency_01", "q_concurrency_03"}
        assert q.difficulty == Difficulty.FOUNDATIONAL
        assert "Selected initial foundational question" in reason

    def test_deepen_action_escalates_to_followup(self, sample_graph):
        q, reason = sample_graph.select_next_question(
            current_question_id="q_concurrency_01",
            action=DecisionAction.DEEPEN,
            exclude_ids={"q_concurrency_01"},
        )
        assert q is not None
        assert q.id == "q_concurrency_02"
        assert q.difficulty == Difficulty.APPLIED
        assert "Deepening" in reason

    def test_simplify_action_deescalates(self, sample_graph):
        q, reason = sample_graph.select_next_question(
            current_question_id="q_concurrency_02",
            action=DecisionAction.SIMPLIFY,
            exclude_ids={"q_concurrency_01", "q_concurrency_02"},
        )
        assert q is not None
        # Should pick lower difficulty in concurrency (q_concurrency_03)
        assert q.id == "q_concurrency_03"
        assert q.difficulty == Difficulty.FOUNDATIONAL
        assert "Simplifying" in reason

    def test_move_on_picks_next_in_topic(self, sample_graph):
        q, reason = sample_graph.select_next_question(
            current_question_id="q_concurrency_01",
            action=DecisionAction.MOVE_ON,
            exclude_ids={"q_concurrency_01"},
        )
        assert q is not None
        assert q.topic == "concurrency"
        assert "Moving on" in reason

    def test_transition_topic_switches_topic(self, sample_graph):
        q, reason = sample_graph.select_next_question(
            current_question_id="q_concurrency_04",
            action=DecisionAction.TRANSITION_TOPIC,
            exclude_ids={"q_concurrency_01", "q_concurrency_02", "q_concurrency_03", "q_concurrency_04"},
        )
        assert q is not None
        assert q.topic == "storage"
        assert q.id == "q_storage_01"
        assert "Transitioning topic" in reason

    def test_target_question_id_override(self, sample_graph):
        q, reason = sample_graph.select_next_question(
            current_question_id="q_concurrency_01",
            action=DecisionAction.DEEPEN,
            target_question_id="q_storage_01",
        )
        assert q is not None
        assert q.id == "q_storage_01"
        assert "explicitly targeted" in reason

    def test_graph_exhaustion_returns_clean_none(self, sample_graph):
        all_ids = {q.id for q in sample_graph.get_all_questions()}
        q, reason = sample_graph.select_next_question(
            current_question_id="q_storage_01",
            action=DecisionAction.MOVE_ON,
            exclude_ids=all_ids,
        )
        assert q is None
        assert "exhausted" in reason.lower()


class TestQuestionLoader:
    def test_load_from_dict_list(self):
        raw_items = [
            {
                "role": "Distributed Systems Engineer",
                "question": "What is the CAP theorem?",
                "keyPoints": ["consistency", "availability", "partition tolerance"],
            },
            {
                "role": "Distributed Systems Engineer",
                "question": "How does Raft maintain consensus across partitions?",
                "keyPoints": ["leader election", "log replication", "quorum"],
            },
        ]
        graph = load_question_bank_from_dict_list(raw_items)
        topics = graph.get_topics()
        assert "distributed systems engineer" in topics
        assert len(graph.get_all_questions()) == 2

        q1 = graph.get_question("q_distributed_systems_engineer_001")
        assert q1 is not None
        assert len(q1.expected_concepts) == 3
        # Automatic edge linking
        assert "q_distributed_systems_engineer_002" in q1.possible_followups

    def test_load_curated_seed_json(self):
        seed_path = Path("src/lib/demo/question-bank-data.json")
        if not seed_path.exists():
            pytest.skip("Seed JSON file not present in workspace")

        graph = load_question_bank_from_json(seed_path)
        all_questions = graph.get_all_questions()
        assert len(all_questions) > 50, f"Expected >50 questions, got {len(all_questions)}"

        topics = graph.get_topics()
        assert len(topics) >= 3

        # Verify that all questions have non-empty expected concepts (Rule #1 requirement)
        for q in all_questions:
            assert len(q.expected_concepts) > 0, f"Question {q.id} missing expected_concepts"
            assert q.difficulty in {Difficulty.FOUNDATIONAL, Difficulty.APPLIED, Difficulty.ARCHITECTURAL}
            assert q.question_type in {QuestionType.CONCEPTUAL, QuestionType.MATHEMATICAL, QuestionType.USE_CASE, QuestionType.CLARIFICATION}
