"""
Answer Engine Core (deterministic no-LLM path).
Answers 'what happened in the candidate's answer' and produces an authoritative AnswerVerdict.
Zero decision logic or question selection logic lives here.
"""
from __future__ import annotations
import re
from schemas.question import Question
from schemas.evaluation import AnswerVerdict
from answer_engine.concept_extraction import (
    check_concept_coverage,
    detect_hedge_phrases,
    detect_dont_know,
    compute_correctness,
)
from answer_engine.prompt_defense import detect_injection


def _calc_jaccard_similarity(text_a: str, text_b: str) -> float:
    tokens_a = set(re.findall(r"\b[a-z0-9_-]+\b", text_a.lower()))
    tokens_b = set(re.findall(r"\b[a-z0-9_-]+\b", text_b.lower()))
    if not tokens_a or not tokens_b:
        return 0.0
    return round(len(tokens_a.intersection(tokens_b)) / len(tokens_a.union(tokens_b)), 4)


def evaluate_answer(question: Question, answer_text: str) -> AnswerVerdict:
    """
    Evaluates candidate answer text deterministically without an LLM.
    Acts as the offline evaluation engine and the guaranteed fallback when live LLM calls fail.
    """
    clean_answer = (answer_text or "").strip()

    # 1. Security: Prompt Injection / Instruction override detection
    if detect_injection(clean_answer):
        return AnswerVerdict(
            question_id=question.id,
            raw_answer=clean_answer,
            injection_detected=True,
            correctness=0.0,
            relevance=0.0,
            completeness=0.0,
            depth=0.0,
            clarity=0.0,
            confidence_signal=0.0,
            missed_concepts=list(question.expected_concepts),
        )

    # 2. Distinct routing signal: Candidate indicates "I don't know" / skip
    # Non-negotiable rule #6: Distinct signal routed to Decision Engine, not an automatic penalty
    if detect_dont_know(clean_answer):
        return AnswerVerdict(
            question_id=question.id,
            raw_answer=clean_answer,
            is_dont_know=True,
            correctness=0.0,
            relevance=1.0,  # Candidate appropriately responded to prompt acknowledging gap
            completeness=0.0,
            depth=0.0,
            clarity=1.0,
            confidence_signal=0.9,  # High honesty/certainty about their own knowledge gap
            missed_concepts=list(question.expected_concepts),
        )

    # 3. Concept coverage check
    coverage = check_concept_coverage(
        clean_answer,
        question.expected_concepts,
        question.concept_descriptions,
    )

    # Non-negotiable rule #4: Correctness derived from concept coverage, NEVER similarity alone
    correctness = compute_correctness(coverage)
    hit_concepts = [c for c, hit in coverage.items() if hit]
    missed_concepts = [c for c, hit in coverage.items() if not hit]

    # Non-negotiable rule #5: Confidence kept separate from correctness
    hedges = detect_hedge_phrases(clean_answer)
    confidence_signal = max(0.0, min(1.0, round(1.0 - 0.2 * len(hedges), 4)))

    # Semantic token similarity as one auxiliary signal among several
    reference_corpus = f"{question.question_text} " + " ".join(question.expected_concepts)
    semantic_similarity = _calc_jaccard_similarity(clean_answer, reference_corpus)

    # Dimensional metrics
    word_count = len(clean_answer.split())
    completeness = min(
        1.0,
        round(
            (len(hit_concepts) / max(1, len(question.expected_concepts))) * 0.7
            + (min(word_count, 80) / 80) * 0.3,
            4,
        ),
    )
    depth = round(
        correctness * (1.0 if word_count >= 40 else max(0.4, word_count / 40)),
        4,
    )
    relevance = 1.0 if hit_concepts else (0.4 if word_count >= 5 else 0.1)
    clarity = max(0.2, round(1.0 - (0.15 * len(hedges)), 4))

    return AnswerVerdict(
        question_id=question.id,
        raw_answer=clean_answer,
        concept_coverage=coverage,
        hit_concepts=hit_concepts,
        missed_concepts=missed_concepts,
        correctness=correctness,
        semantic_similarity=semantic_similarity,
        relevance=relevance,
        completeness=completeness,
        depth=depth,
        clarity=clarity,
        confidence_signal=confidence_signal,
        hedge_phrases_found=hedges,
        is_dont_know=False,
        injection_detected=False,
    )
