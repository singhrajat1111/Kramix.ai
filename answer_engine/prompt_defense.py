"""
Prompt defense and injection detection module for candidate input.
Detects instruction override attempts, jailbreaks, and prompt leakage probes.
"""
import re

INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|directions)",
    r"(?i)disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts)",
    r"(?i)system\s*prompt",
    r"(?i)you\s+are\s+now\s+(a|an)?\s*(new|different|unrestricted)?",
    r"(?i)act\s+as\s+(a|an)?\s*(developer|hacker|dan|unfiltered|jailbroken)",
    r"(?i)reveal\s+(your|the)\s+(secret|hidden|system|developer)\s*(instructions|prompt)?",
    r"(?i)give\s+me\s+a\s+perfect\s+score\s+(regardless|anyway|please)",
    r"(?i)score\s*:\s*100|score\s*:\s*1\.0",
    r"(?i)<\s*script\b",
    r"(?i)drop\s+table\b",
]

_COMPILED_PATTERNS = [re.compile(p) for p in INJECTION_PATTERNS]


def detect_injection(text: str) -> bool:
    """
    Returns True if the text contains prompt injection or instruction-override attempts.
    """
    if not text or not text.strip():
        return False

    cleaned = text.strip()
    return any(p.search(cleaned) is not None for p in _COMPILED_PATTERNS)
