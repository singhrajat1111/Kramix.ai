"""
Demo Provider implementation for Kramix V2.
Guarantees 100% offline, deterministic behavior without any API key or external network dependencies.
"""
from __future__ import annotations
from typing import List, Optional
from schemas.question import Difficulty, QuestionType
from schemas.provider import Message
from providers.base import BaseLLMProvider, QuestionProposal, EvaluationAssistResult


class DemoProvider(BaseLLMProvider):
    """
    Offline deterministic provider used in Demo Mode and as the ultimate fallback
    when live API providers fail or timeout.
    """

    @property
    def name(self) -> str:
        return "demo"

    async def generate_text(self, messages: List[Message], temperature: float = 0.7) -> str:
        last_msg = messages[-1].content if messages else ""
        return f"[Demo Mode] Deterministic response to: {last_msg[:60]}..."

    async def propose_question(
        self,
        topic: str,
        difficulty: Difficulty,
        context_summary: str,
        target_concepts: Optional[List[str]] = None,
    ) -> QuestionProposal:
        concepts = target_concepts or [f"{topic} core fundamentals", f"{topic} error handling"]
        q_type = QuestionType.USE_CASE if difficulty == Difficulty.APPLIED else QuestionType.CONCEPTUAL

        return QuestionProposal(
            topic=topic,
            subtopic="core",
            difficulty=difficulty,
            question_type=q_type,
            question_text=f"How would you explain the operational trade-offs and implementation of {topic}?",
            expected_concepts=concepts,
            concept_descriptions={c: f"Understanding and explanation of {c}." for c in concepts},
            rationale=f"Deterministic demo proposal for {topic} ({difficulty.value})",
        )

    async def assist_evaluation(
        self,
        question_text: str,
        expected_concepts: List[str],
        answer_text: str,
    ) -> EvaluationAssistResult:
        answer_lower = answer_text.lower()
        alignment = {c: any(w in answer_lower for w in c.lower().split()) for c in expected_concepts}
        hits = sum(1 for v in alignment.values() if v)
        depth = round(hits / max(1, len(expected_concepts)), 2)

        return EvaluationAssistResult(
            concept_alignment=alignment,
            nuanced_observations=[f"Deterministic check: {hits}/{len(expected_concepts)} concepts present."],
            suggested_depth=depth,
            hedge_signals=[],
            raw_explanation="Demo evaluation assistance computed deterministically from concept tokens.",
        )
