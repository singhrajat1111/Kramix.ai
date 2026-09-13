"""
Provider Manager for Kramix V2.
Manages LLM provider selection, failure isolation, retry, and fallback to DemoProvider.
Non-negotiable rule #9: Provider failure must never crash or stall an interview.
Non-negotiable rule #1: Non-LLM deterministic path is always preserved.
"""
from __future__ import annotations
import logging
from typing import Dict, List, Optional, Set, Tuple
from schemas.question import Question, Difficulty
from schemas.interview_state import InterviewState
from providers.base import (
    BaseLLMProvider,
    EvaluationAssistResult,
    ProviderError,
    ProviderTimeoutError,
    ProviderAuthenticationError,
    ProviderRateLimitError,
)
from providers.demo_provider import DemoProvider
from providers.validation import QuestionValidator
from observability.trace import TraceLogger, TraceEvent, TraceEventType, global_tracer

logger = logging.getLogger("kramix.providers")


class ProviderManager:
    """
    Central provider facade.
    Isolates external LLM failures, validates proposals, and ensures seamless
    fallback to deterministic behavior.
    """

    def __init__(
        self,
        primary_provider: Optional[BaseLLMProvider] = None,
        fallback_provider: Optional[BaseLLMProvider] = None,
        tracer: Optional[TraceLogger] = None,
        max_retries: int = 1,
    ):
        self.primary = primary_provider
        self.fallback = fallback_provider or DemoProvider()
        self.tracer = tracer or global_tracer
        self.max_retries = max_retries

    @property
    def active_provider_name(self) -> str:
        return self.primary.name if self.primary else self.fallback.name

    def _mask_error(self, exc: Exception) -> str:
        """Sanitizes exception messages to guarantee no secret or raw token leaks."""
        msg = str(exc)
        # Scrub standard API key tokens if present
        for token_prefix in ["sk-", "key=", "Bearer "]:
            if token_prefix in msg:
                msg = f"{type(exc).__name__}: [credentials masked]"
        return msg

    def _trace(self, session_id: str, turn: int, event_type: str, reason: str, metadata: dict) -> None:
        self.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=turn,
                event_type=event_type,
                reason=reason,
                actor="provider_manager",
                metadata=metadata,
            )
        )

    async def propose_question(
        self,
        topic: str,
        difficulty: Difficulty,
        context_summary: str,
        state: InterviewState,
        existing_question_texts: Optional[Set[str]] = None,
        target_concepts: Optional[List[str]] = None,
    ) -> Tuple[Optional[Question], str]:
        """
        Attempts to acquire a validated question proposal from the configured provider.
        If the provider fails or the proposal fails validation, falls back to deterministic behavior.
        Never crashes an interview turn (Rule #9).
        """
        asked_ids = {q.question_id for q in state.question_history}
        provider_to_use = self.primary or self.fallback

        self._trace(
            session_id=state.session_id,
            turn=state.current_turn,
            event_type="provider_requested",
            reason=f"Requested candidate-aware question proposal from provider '{provider_to_use.name}'.",
            metadata={"provider": provider_to_use.name, "topic": topic, "difficulty": difficulty.value},
        )

        proposal = None
        used_provider_name = provider_to_use.name

        # Try primary with retries
        for attempt in range(self.max_retries + 1):
            try:
                proposal = await provider_to_use.propose_question(
                    topic=topic,
                    difficulty=difficulty,
                    context_summary=context_summary,
                    target_concepts=target_concepts,
                )
                break
            except Exception as exc:
                clean_err = self._mask_error(exc)
                logger.warning(
                    "Provider %s attempt %d failed: %s",
                    provider_to_use.name, attempt + 1, clean_err
                )
                if attempt == self.max_retries and provider_to_use != self.fallback:
                    # Fallback triggered
                    self._trace(
                        session_id=state.session_id,
                        turn=state.current_turn,
                        event_type="provider_failed",
                        reason=f"Provider '{provider_to_use.name}' failed after {self.max_retries + 1} attempts: {clean_err}",
                        metadata={"provider": provider_to_use.name, "error": clean_err},
                    )
                    self._trace(
                        session_id=state.session_id,
                        turn=state.current_turn,
                        event_type="provider_fallback",
                        reason=f"Fell back from '{provider_to_use.name}' to deterministic fallback '{self.fallback.name}'.",
                        metadata={"fallback": self.fallback.name},
                    )
                    try:
                        proposal = await self.fallback.propose_question(
                            topic=topic,
                            difficulty=difficulty,
                            context_summary=context_summary,
                            target_concepts=target_concepts,
                        )
                        used_provider_name = self.fallback.name
                    except Exception as fallback_exc:
                        clean_fb_err = self._mask_error(fallback_exc)
                        return None, f"Fallback provider also failed: {clean_fb_err}"

        if not proposal:
            return None, f"Provider '{used_provider_name}' did not produce a proposal."

        # Validate proposal through QuestionValidator (Rule #8)
        is_valid, validated_q, val_reason = QuestionValidator.validate_proposal(
            proposal=proposal,
            active_topic=state.current_topic or topic,
            asked_question_ids=asked_ids,
            existing_question_texts=existing_question_texts,
        )

        if not is_valid or not validated_q:
            self._trace(
                session_id=state.session_id,
                turn=state.current_turn,
                event_type="question_proposal_rejected",
                reason=f"Provider '{used_provider_name}' proposal rejected: {val_reason}",
                metadata={"provider": used_provider_name, "rejection_reason": val_reason},
            )
            return None, f"Proposed question failed validation: {val_reason}"

        self._trace(
            session_id=state.session_id,
            turn=state.current_turn,
            event_type="question_proposal_received",
            reason=f"Accepted validated question proposal '{validated_q.id}' from '{used_provider_name}'.",
            metadata={"provider": used_provider_name, "question_id": validated_q.id},
        )
        return validated_q, f"Accepted validated question '{validated_q.id}' from provider '{used_provider_name}'."

    async def assist_evaluation(
        self,
        question_text: str,
        expected_concepts: List[str],
        answer_text: str,
        session_id: str = "unknown",
        turn: int = 0,
    ) -> Optional[EvaluationAssistResult]:
        """
        Requests evaluation assistance from active provider with fallback isolation.
        """
        provider_to_use = self.primary or self.fallback

        for attempt in range(self.max_retries + 1):
            try:
                result = await provider_to_use.assist_evaluation(
                    question_text=question_text,
                    expected_concepts=expected_concepts,
                    answer_text=answer_text,
                )
                return result
            except Exception as exc:
                clean_err = self._mask_error(exc)
                logger.warning("Assist evaluation failed for %s: %s", provider_to_use.name, clean_err)
                if attempt == self.max_retries and provider_to_use != self.fallback:
                    self._trace(
                        session_id=session_id,
                        turn=turn,
                        event_type="provider_fallback",
                        reason=f"Evaluation assist fallback triggered: {clean_err}",
                        metadata={"provider": provider_to_use.name},
                    )
                    try:
                        return await self.fallback.assist_evaluation(
                            question_text=question_text,
                            expected_concepts=expected_concepts,
                            answer_text=answer_text,
                        )
                    except Exception:
                        return None
        return None
