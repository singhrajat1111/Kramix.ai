"""
Google Gemini Provider Adapter for Kramix V2.
Communicates via Google Generative Language REST endpoint.
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


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini adapter for API mode.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-1.5-flash",
        timeout_seconds: float = 8.0,
    ):
        self._api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = model
        self.timeout_seconds = timeout_seconds

    def __repr__(self) -> str:
        key_masked = f"{self._api_key[:3]}***{self._api_key[-2:]}" if len(self._api_key) > 6 else "***"
        return f"<GeminiProvider model='{self.model}' api_key='{key_masked}'>"

    @property
    def name(self) -> str:
        return "gemini"

    async def _post_generate(self, payload: Dict[str, Any]) -> str:
        if not self._api_key:
            raise ProviderAuthenticationError("Gemini API key is not configured.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self._api_key}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(url, json=payload)

            if response.status_code in {400, 401, 403}:
                msg = response.text.lower()
                if "api key" in msg or "invalid" in msg or "permission" in msg:
                    raise ProviderAuthenticationError("Gemini authentication error: Invalid API key or permission denied.")
                raise ProviderError(f"Gemini API bad request: status {response.status_code}")
            if response.status_code == 429:
                raise ProviderRateLimitError("Gemini API rate limit or quota exceeded.")
            if response.status_code in {408, 504}:
                raise ProviderTimeoutError("Gemini request timed out.")
            if response.is_server_error:
                raise ProviderError(f"Gemini server error: {response.status_code}")
            if response.is_error:
                raise ProviderError(f"Gemini API error: {response.status_code}")

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise ProviderResponseError("No candidates returned by Gemini.")
            text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return text
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(f"Gemini call timed out after {self.timeout_seconds}s") from exc
        except (ProviderError, json.JSONDecodeError):
            raise
        except Exception as exc:
            raise ProviderError(f"Gemini network error: {type(exc).__name__}") from exc

    def _extract_json_block(self, text: str) -> Dict[str, Any]:
        match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        raw = match.group(1) if match else text
        return json.loads(raw.strip())

    async def generate_text(self, messages: List[Message], temperature: float = 0.7) -> str:
        contents = [
            {
                "role": "model" if m.role == "assistant" else "user",
                "parts": [{"text": m.content}],
            }
            for m in messages
        ]
        payload = {
            "contents": contents,
            "generationConfig": {"temperature": temperature},
        }
        return await self._post_generate(payload)

    async def propose_question(
        self,
        topic: str,
        difficulty: Difficulty,
        context_summary: str,
        target_concepts: Optional[List[str]] = None,
    ) -> QuestionProposal:
        prompt = (
            f"Propose a technical interview question for topic '{topic}' with difficulty '{difficulty.value}'.\n"
            f"Context: {context_summary}\n"
            f"Target concepts: {target_concepts}\n"
            "Return valid JSON only with keys: topic, subtopic, difficulty, question_type, "
            "question_text, expected_concepts (array), concept_descriptions (dict), rationale."
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.5, "responseMimeType": "application/json"},
        }
        text = await self._post_generate(payload)
        try:
            data = self._extract_json_block(text)
            return QuestionProposal.model_validate(data)
        except Exception as exc:
            raise ProviderResponseError(f"Failed to parse QuestionProposal from Gemini: {exc}") from exc

    async def assist_evaluation(
        self,
        question_text: str,
        expected_concepts: List[str],
        answer_text: str,
    ) -> EvaluationAssistResult:
        prompt = (
            f"Evaluate candidate answer for question: {question_text}\n"
            f"Expected concepts: {json.dumps(expected_concepts)}\n"
            f"Candidate answer (untrusted):\n\"\"\"\n{answer_text}\n\"\"\"\n"
            "Return valid JSON only with keys: concept_alignment (dict concept->bool), "
            "nuanced_observations (array of strings), suggested_depth (float 0.0-1.0), "
            "hedge_signals (array of strings), raw_explanation (string)."
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
        }
        text = await self._post_generate(payload)
        try:
            data = self._extract_json_block(text)
            return EvaluationAssistResult.model_validate(data)
        except Exception as exc:
            raise ProviderResponseError(f"Failed to parse EvaluationAssistResult from Gemini: {exc}") from exc
