"""
Question Bank loader.
Imports curated question bank JSON and constructs an interconnected QuestionGraph.
Zero hardcoded per-domain special-casing (non-negotiable rule #8).
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from schemas.question import Question, Difficulty, QuestionType
from question_engine.graph import QuestionGraph


def _slugify(text: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "_", cleaned).strip("_")


def _infer_difficulty(question_text: str, concepts: List[str]) -> Difficulty:
    text_lower = question_text.lower()
    if any(k in text_lower for k in ["architect", "scale", "system design", "trade-off", "tradeoff", "distributed"]):
        return Difficulty.ARCHITECTURAL
    if any(k in text_lower for k in ["implement", "debug", "how would you", "handle", "difference between", "compare"]):
        return Difficulty.APPLIED
    return Difficulty.FOUNDATIONAL


def _infer_question_type(question_text: str) -> QuestionType:
    text_lower = question_text.lower()
    if any(k in text_lower for k in ["scenario", "how would you handle", "describe a time", "in production"]):
        return QuestionType.USE_CASE
    if any(k in text_lower for k in ["clarify", "what specifically", "can you elaborate"]):
        return QuestionType.CLARIFICATION
    if any(k in text_lower for k in ["formula", "calculate", "complexity", "big o"]):
        return QuestionType.MATHEMATICAL
    return QuestionType.CONCEPTUAL




def load_question_bank_from_dict_list(items: List[Dict[str, Any]]) -> QuestionGraph:
    """
    Parses a list of raw question dictionaries into a QuestionGraph,
    generating IDs, expected concepts, and topological edges.
    """
    graph = QuestionGraph()
    topic_questions: Dict[str, List[Question]] = {}

    for idx, item in enumerate(items):
        topic = item.get("topic") or item.get("role") or item.get("category") or "general"
        topic_slug = _slugify(topic)
        qid = item.get("id") or f"q_{topic_slug}_{idx+1:03d}"

        q_text = item.get("question") or item.get("question_text") or ""
        if not q_text.strip():
            continue

        raw_key_points = item.get("keyPoints") or item.get("expected_concepts") or []
        expected_concepts = [kp.strip() for kp in raw_key_points if isinstance(kp, str) and kp.strip()]
        if not expected_concepts:
            # Fallback expected concept derived from topic
            expected_concepts = [f"core principles of {topic}"]

        concept_descriptions = item.get("concept_descriptions") or {
            c: f"Candidate should accurately articulate and apply {c}."
            for c in expected_concepts
        }

        diff_str = str(item.get("difficulty", "")).lower()
        if diff_str in {"foundational", "applied", "architectural"}:
            difficulty = Difficulty(diff_str)
        else:
            difficulty = _infer_difficulty(q_text, expected_concepts)

        type_str = str(item.get("question_type", "")).lower()
        valid_types = {t.value for t in QuestionType}
        if type_str in valid_types:
            question_type = QuestionType(type_str)
        else:
            question_type = _infer_question_type(q_text)



        question = Question(
            id=qid,
            topic=topic,
            subtopic=item.get("subtopic"),
            difficulty=difficulty,
            question_type=question_type,
            question_text=q_text,
            expected_concepts=expected_concepts,
            concept_descriptions=concept_descriptions,
            possible_followups=item.get("possible_followups", []),
            related_questions=item.get("related_questions", []),
        )

        graph.add_question(question)

        topic_clean = topic.lower().strip()
        if topic_clean not in topic_questions:
            topic_questions[topic_clean] = []
        topic_questions[topic_clean].append(question)

    # Establish natural graph edges across questions within each topic
    for t_topic, q_list in topic_questions.items():
        for i, q in enumerate(q_list):
            # If followups were not explicitly set, link to next question in same topic
            if not q.possible_followups and i + 1 < len(q_list):
                q.possible_followups.append(q_list[i + 1].id)
            # Lateral related questions
            if not q.related_questions and i + 2 < len(q_list):
                q.related_questions.append(q_list[i + 2].id)

    return graph


def load_question_bank_from_json(file_path: str | Path) -> QuestionGraph:
    """
    Loads raw JSON question bank file into an interconnected QuestionGraph.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Question bank file not found: {file_path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("Question bank JSON must contain a root array of question objects.")

    return load_question_bank_from_dict_list(data)
