"""
Vector Store abstraction and in-memory implementation for candidate context chunks.
Supports vector similarity search, metadata filtering, and candidate cleanup (Requirement #5).
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from rag.models import ContextChunk


class BaseVectorStore(ABC):
    """
    Abstract vector storage interface.
    """

    @abstractmethod
    def add_chunks(self, chunks: List[ContextChunk], embeddings: List[List[float]]) -> None:
        pass

    @abstractmethod
    def search(
        self,
        query_vector: List[float],
        top_k: int = 3,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[ContextChunk, float]]:
        """Returns list of (ContextChunk, similarity_score)."""
        pass

    @abstractmethod
    def remove_by_candidate(self, candidate_id: str) -> int:
        pass

    @abstractmethod
    def remove_by_source(self, source_id: str) -> int:
        pass

    @abstractmethod
    def clear(self) -> None:
        pass


class InMemoryVectorStore(BaseVectorStore):
    """
    High-performance in-memory vector store using numpy matrix multiplication for cosine similarity.
    """

    def __init__(self):
        self._chunks: List[ContextChunk] = []
        self._vectors: Optional[np.ndarray] = None  # Shape: (N, D)

    def add_chunks(self, chunks: List[ContextChunk], embeddings: List[List[float]]) -> None:
        if len(chunks) != len(embeddings):
            raise ValueError(f"Mismatched chunks ({len(chunks)}) and embeddings ({len(embeddings)})")

        if not chunks:
            return

        new_vecs = np.array(embeddings, dtype=np.float32)
        # Ensure rows are unit normalized
        norms = np.linalg.norm(new_vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        new_vecs = new_vecs / norms

        if self._vectors is None or len(self._chunks) == 0:
            self._chunks = list(chunks)
            self._vectors = new_vecs
        else:
            self._chunks.extend(chunks)
            self._vectors = np.vstack([self._vectors, new_vecs])

    def search(
        self,
        query_vector: List[float],
        top_k: int = 3,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[ContextChunk, float]]:
        if self._vectors is None or len(self._chunks) == 0:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
        q_vec = q_vec / q_norm

        # Cosine similarities: dot product with normalized vectors
        scores = np.dot(self._vectors, q_vec)

        # Apply metadata filters
        candidate_indices = range(len(self._chunks))
        if filters:
            filtered = []
            for idx in candidate_indices:
                chunk = self._chunks[idx]
                match = True
                for k, v in filters.items():
                    if k == "candidate_id" and chunk.candidate_id != v:
                        match = False
                        break
                    elif k == "source_type" and chunk.source_type != v:
                        match = False
                        break
                    elif k == "section" and chunk.section.lower() != str(v).lower():
                        match = False
                        break
                    elif k in chunk.metadata and chunk.metadata[k] != v:
                        match = False
                        break
                if match:
                    filtered.append(idx)
            candidate_indices = filtered

        if not candidate_indices:
            return []

        # Sort candidate indices by score descending
        sorted_indices = sorted(candidate_indices, key=lambda idx: scores[idx], reverse=True)[:top_k]
        results = [
            (self._chunks[idx], max(0.0, min(1.0, float(scores[idx]))))
            for idx in sorted_indices
        ]
        return results

    def remove_by_candidate(self, candidate_id: str) -> int:
        if not self._chunks:
            return 0
        keep_mask = [c.candidate_id != candidate_id for c in self._chunks]
        removed_count = len(self._chunks) - sum(keep_mask)

        self._chunks = [c for i, c in enumerate(self._chunks) if keep_mask[i]]
        if self._vectors is not None:
            self._vectors = self._vectors[keep_mask] if any(keep_mask) else None
        return removed_count

    def remove_by_source(self, source_id: str) -> int:
        if not self._chunks:
            return 0
        keep_mask = [c.source_id != source_id for c in self._chunks]
        removed_count = len(self._chunks) - sum(keep_mask)

        self._chunks = [c for i, c in enumerate(self._chunks) if keep_mask[i]]
        if self._vectors is not None:
            self._vectors = self._vectors[keep_mask] if any(keep_mask) else None
        return removed_count

    def clear(self) -> None:
        self._chunks.clear()
        self._vectors = None
