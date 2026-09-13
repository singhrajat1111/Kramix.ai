"""
Embedding generation abstraction and deterministic offline implementation.
Guarantees zero-network, zero-API-key local operation for Demo Mode (Requirement #4).
"""
from __future__ import annotations
from abc import ABC, abstractmethod
import hashlib
import re
from typing import List
import numpy as np


class BaseEmbeddingProvider(ABC):
    """
    Abstract interface for generating vector embeddings.
    """

    @property
    @abstractmethod
    def dimension(self) -> int:
        pass

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Embeds a single text string into a normalized float vector."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embeds a batch of texts."""
        pass


class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic local embedding provider using token-hashing and character n-gram projection.
    Operates offline with zero external network or model downloads.
    """

    def __init__(self, dimension: int = 64):
        self._dim = dimension

    @property
    def dimension(self) -> int:
        return self._dim

    def embed_text(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * self._dim

        tokens = re.findall(r"\b[a-z0-9_-]+\b", text.lower())
        if not tokens:
            return [0.0] * self._dim

        vec = np.zeros(self._dim, dtype=np.float32)

        for token in tokens:
            # Word-level hash bucket
            h_word = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            idx_word = h_word % self._dim
            sign_word = 1.0 if (h_word >> 8) & 1 else -1.0
            vec[idx_word] += sign_word * 2.0

            # 3-gram character sub-tokens for morphological similarity
            if len(token) >= 3:
                for i in range(len(token) - 2):
                    trigram = token[i:i + 3]
                    h_tri = int(hashlib.sha1(trigram.encode("utf-8")).hexdigest(), 16)
                    idx_tri = h_tri % self._dim
                    sign_tri = 1.0 if (h_tri >> 8) & 1 else -1.0
                    vec[idx_tri] += sign_tri * 0.5

        # L2 normalization
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        return [float(x) for x in vec]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_text(t) for t in texts]
