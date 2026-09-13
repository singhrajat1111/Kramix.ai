"""
Concept extraction and evaluation logic for candidate answers (deterministic no-LLM path).
Checks substantive concept coverage, hedge phrases, and 'I don't know' signals.
"""
from __future__ import annotations
import re
from typing import Dict, List, Set

STOP_WORDS: Set[str] = {
    "a", "an", "the", "and", "or", "in", "on", "of", "to", "for", "with", "at",
    "by", "from", "as", "that", "this", "it", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "can", "could",
    "will", "would", "should", "must", "what", "how", "why", "when", "where",
    "which", "who", "whom", "candidate", "explain", "describe", "accurately",
    "articulate", "concept", "mechanism", "technique", "techniques", "thing",
    "things", "some", "any", "all", "more", "most", "other", "into", "through",
}

HEDGE_PATTERNS = [
    r"\bi think\b",
    r"\bi believe\b",
    r"\bi guess\b",
    r"\bi feel like\b",
    r"\bmaybe\b",
    r"\bprobably\b",
    r"\bpossibly\b",
    r"\bperhaps\b",
    r"\bnot entirely sure\b",
    r"\bnot 100% sure\b",
    r"\bi might be wrong\b",
    r"\bi could be wrong\b",
    r"\bcorrect me if i'm wrong\b",
    r"\bas far as i know\b",
    r"\bto the best of my knowledge\b",
    r"\bsort of\b",
    r"\bkind of\b",
]

DONT_KNOW_PATTERNS = [
    r"\bi don't know\b",
    r"\bi do not know\b",
    r"\bi have no idea\b",
    r"\bno idea\b",
    r"\bnot sure about this\b",
    r"\bi'm not sure about that\b",
    r"\bi haven't worked with this\b",
    r"\bi have not worked with this\b",
    r"\bi never used this\b",
    r"\bcan we skip\b",
    r"\bskip this question\b",
    r"\bpass on this\b",
    r"\bi am unfamiliar with\b",
    r"\bi'm unfamiliar with\b",
]


def detect_dont_know(text: str) -> bool:
    """
    Returns True if the candidate explicitly indicates they don't know or wish to skip.
    Non-negotiable rule #6: This is a distinct routing signal for Decision Engine, not a score penalty.
    """
    if not text or not text.strip():
        return False
    lower = text.lower().strip()
    return any(re.search(p, lower) is not None for p in DONT_KNOW_PATTERNS)


def detect_hedge_phrases(text: str) -> List[str]:
    """
    Finds hedging and uncertainty language in the candidate's answer.
    Non-negotiable rule #5: Kept strictly separate from correctness.
    """
    if not text or not text.strip():
        return []
    lower = text.lower().strip()
    found = []
    for p in HEDGE_PATTERNS:
        match = re.search(p, lower)
        if match:
            found.append(match.group(0))
    return found


def _extract_ngrams_and_tokens(concept: str, description: str) -> tuple[List[str], Set[str]]:
    """
    Extracts multi-word key phrases and distinct substantive tokens from concept metadata.
    """
    combined = f"{concept} {description}".lower()

    # Extract multi-word phrases inside parentheses or between delimiters
    phrases: List[str] = []
    paren_matches = re.findall(r"\(([^)]+)\)", concept.lower())
    for pm in paren_matches:
        parts = [p.strip() for p in pm.split("/") if p.strip()]
        for part in parts:
            if len(part.split()) >= 2:
                phrases.append(part)

    # Key multi-word terms from description
    for chunk in re.split(r"[,;.]", combined):
        clean_chunk = chunk.strip()
        words = [w for w in re.findall(r"\b[a-z0-9_-]+\b", clean_chunk) if w not in STOP_WORDS]
        if 2 <= len(words) <= 4:
            phrases.append(" ".join(words))

    # Single content tokens
    all_tokens = set(re.findall(r"\b[a-z0-9_-]+\b", combined))
    content_tokens = {t for t in all_tokens if t not in STOP_WORDS and len(t) > 2}

    return phrases, content_tokens


def check_concept_coverage(
    answer_text: str,
    expected_concepts: List[str],
    concept_descriptions: Dict[str, str] | None = None,
) -> Dict[str, bool]:
    """
    Deterministic concept-coverage check.
    Evaluates whether the candidate's answer substantively demonstrates understanding
    of each expected concept without relying on an LLM or keyword presence alone.
    """
    if not answer_text or not answer_text.strip():
        return {c: False for c in expected_concepts}

    descriptions = concept_descriptions or {}
    lower_answer = answer_text.lower().strip()
    answer_tokens = set(re.findall(r"\b[a-z0-9_-]+\b", lower_answer))

    coverage: Dict[str, bool] = {}

    for concept in expected_concepts:
        desc = descriptions.get(concept, "")
        phrases, content_tokens = _extract_ngrams_and_tokens(concept, desc)

        # 1. Multi-word key phrase match (high confidence hit)
        phrase_hit = any(phrase in lower_answer for phrase in phrases if len(phrase) > 4)
        if phrase_hit:
            coverage[concept] = True
            continue

        # 2. Distinct content tokens overlap
        overlap = content_tokens.intersection(answer_tokens)
        required_overlap = min(2, len(content_tokens)) if len(content_tokens) > 1 else 1

        if len(overlap) >= required_overlap:
            coverage[concept] = True
        else:
            coverage[concept] = False

    return coverage


def compute_correctness(coverage: Dict[str, bool]) -> float:
    """
    Non-negotiable rule #4: Correctness is directly derived from concept coverage,
    NEVER from semantic/embedding similarity alone.
    """
    if not coverage:
        return 0.0
    hits = sum(1 for hit in coverage.values() if hit)
    return round(hits / len(coverage), 4)
