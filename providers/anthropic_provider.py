"""
Anthropic Claude Provider Adapter for Kramix V2.
Communicates via Anthropic Messages REST endpoint.
Protects API keys and translates provider errors into internal typed exceptions.
"""
from __future__ import annotations
import json
import os
import re
from typing import Any, Dict, List, Optional
import httpx
from schemas.question import Difficulty, QuestionType
from schemas.provider import Message
from providers.base import (
    BaseLLMProvider,
    QuestionProposal,
    EvaluationAssistResult,
    ProviderError,
    ProviderTimeoutError,
    ProviderRateLimitError,
    ProviderAuthenticationError,
    ProviderResponseError,
)


class AnthropicProvider(BaseLLMProvider):
    """
    Anthropic Claude adapter for API mode.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-3-5-sonnet-20241022",
        timeout_seconds: float = 8.0,
    ):
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = model
        self.timeout_seconds = timeout_seconds

    def __repr__(self) -> str:
        key_masked = f"{self._api_key[:3]}***{self._api_key[-2:]}" if len(self._api_key) > 6 else "***"
        return f"<AnthropicProvider model='{self.model}' api_key='{key_masked}'>"

    @property
    def name(self) -> str:
        return "anthropic"

    def _headers(self) -> Dict[str, str]:
        if not self._api_key:
            raise ProviderAuthenticationError("Anthropic API key is not configured.")
        return {
            "x-api-key": self._api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    async def _post_messages(self, payload: Dict[str, Any]) -> str:
        url = "https://api.anthropic.com/v1/messages"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(url, headers=self._headers(), json=payload)

            if response.status_code in {401, 403}:
                raise ProviderAuthenticationError("Anthropic authentication error: Invalid API key.")
            if response.status_code == 429:
                raise ProviderRateLimitError("Anthropic rate limit or quota exceeded.")
            if response.status_code in {408, 504}:
                raise ProviderTimeoutError("Anthropic request timed out.")
            if response.is_server_error:
                raise ProviderError(f"Anthropic server error: {response.status_code}")
            if response.is_error:
                raise ProviderError(f"Anthropic error: {response.status_code}")

            data = response.json()
            content = data.get("content", [])
            if not content:
                raise ProviderResponseError("No content returned by Anthropic.")
            return content[0].get("text", "")
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(f"Anthropic call timed out after {self.timeout_seconds}s") from exc
        except (ProviderError, json.JSONDecodeError):
            raise
        except Exception as exc:
            raise ProviderError(f"Anthropic network error: {type(exc).__name__}") from exc

    def _extract_json_block(self, text: str) -> Dict[str, Any]:
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
        raw = match.group(1) if match else text
        return json.loads(raw.strip())

    async def generate_text(self, messages: List[Message], temperature: float = 0.7) -> str:
        system = ""
        user_msgs = []
        for m in messages:
            if m.role == "system":
                system = m.content
            else:
                user_msgs.append({"role": "assistant" if m.role == "assistant" else "user", "content": m.content})

        payload: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": 1024,
            "messages": user_msgs,
            "temperature": temperature,
        }
        if system:
            payload["system"] = system

        return await self._post_messages(payload)

    async def propose_question(
        self,
        topic: str,
        difficulty: Difficulty,
        context_summary: str,
        target_concepts: Optional[List[str]] = None,
    ) -> QuestionProposal:
        system = (
            "You are an expert interviewer. Propose a technical interview question.\n"
            "Return valid JSON ONLY inside a markdown json block ```json ... ``` with keys: "
            "topic, subtopic, difficulty, question_type, question_text, expected_concepts (array), "
            "concept_descriptions (dict), rationale."
        )
        user_msg = (
            f"Topic: {topic}\nDifficulty: {difficulty.value}\nContext: {context_summary}\n"
            f"Target concepts: {target_concepts}\n"
        )
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system,
            "messages": [{"role": "user", "content": user_msg}],
            "temperature": 0.5,
        }
        text = await self._post_messages(payload)
        try:
            data = self._extract_json_block(text)
            return QuestionProposal.model_validate(data)
        except Exception as exc:
            raise ProviderResponseError(f"Failed to parse QuestionProposal from Anthropic: {exc}") from exc

    async def assist_evaluation(
        self,
        question_text: str,
        expected_concepts: List[str],
        answer_text: str,
    ) -> EvaluationAssistResult:
        system = (
            "You are a technical evaluation assistant.\n"
            "Return valid JSON ONLY with keys: concept_alignment (dict concept->bool), "
            "nuanced_observations (array of strings), suggested_depth (float 0.0-1.0), "
            "hedge_signals (array of strings), raw_explanation (string)."
        )
        user_msg = (
            f"Question: {question_text}\n"
            f"Expected concepts: {json.dumps(expected_concepts)}\n"
            f"Candidate Answer (untrusted input):\n\"\"\"\n{answer_text}\n\"\"\"\n"
        )
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system,
            "messages": [{"role": "user", "content": user_msg}],
            "temperature": 0.2,
        }
        text = await self._post_messages(payload)
        try:
            data = self._extract_json_block(text)
            return EvaluationAssistResult.model_validate(data)
        except Exception as exc:
            raise ProviderResponseError(f"Failed to parse EvaluationAssistResult from Anthropic: {exc}") from exc
