"""
Context Retriever module for Kramix V2.
Retrieves top relevant candidate context chunks and explains the human-readable retrieval reason.
Zero decision or scoring authority (Requirement #6 & #9).
"""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional
from rag.models import RetrievalResult, ContextChunk
from rag.embeddings import BaseEmbeddingProvider, LocalEmbeddingProvider
from rag.vector_store import BaseVectorStore, InMemoryVectorStore
from observability.trace import TraceLogger, TraceEvent, global_tracer

logger = logging.getLogger("kramix.rag.retriever")


class ContextRetriever:
    """
    Retrieves candidate background context matching a query or topic.
    Returns structured results with transparent, human-readable retrieval rationales.
    """

    def __init__(
        self,
        vector_store: Optional[BaseVectorStore] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
        tracer: Optional[TraceLogger] = None,
    ):
        self.vector_store = vector_store or InMemoryVectorStore()
        self.embedding_provider = embedding_provider or LocalEmbeddingProvider()
        self.tracer = tracer or global_tracer

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        filters: Optional[Dict[str, Any]] = None,
        session_id: str = "unknown",
        turn: int = 0,
    ) -> List[RetrievalResult]:
        """
        Queries the vector store for relevant candidate context.
        Failure-isolated: if embeddings or vector search fails, returns [] without crashing.
        """
        clean_query = (query or "").strip()
        if not clean_query:
            return []

        self.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=turn,
                event_type="retrieval_requested",
                reason=f"Requested candidate context retrieval for query: '{clean_query[:50]}...'",
                metadata={"top_k": top_k, "filters": filters or {}},
            )
        )

        try:
            query_vec = self.embedding_provider.embed_text(clean_query)
            raw_matches = self.vector_store.search(
                query_vector=query_vec,
                top_k=top_k,
                filters=filters,
            )
        except Exception as exc:
            logger.warning("Retrieval failed for query '%s': %s", clean_query[:40], exc)
            self.tracer.record(
                TraceEvent(
                    session_id=session_id,
                    turn=turn,
                    event_type="retrieval_failed",
                    reason=f"Context retrieval failed: {type(exc).__name__}",
                    metadata={"query_preview": clean_query[:40]},
                )
            )
            return []

        results: List[RetrievalResult] = []
        for chunk, score in raw_matches:
            reason = (
                f"Retrieved because query matched candidate's {chunk.section} "
                f"context ({chunk.title}) with similarity {score:.2f}."
            )
            results.append(
                RetrievalResult(
                    chunk_id=chunk.chunk_id,
                    source_id=chunk.source_id,
                    title=chunk.title,
                    section=chunk.section,
                    content=chunk.content,
                    similarity_score=score,
                    retrieval_reason=reason,
                    metadata=chunk.metadata,
                )
            )

        self.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=turn,
                event_type="retrieval_completed",
                reason=f"Retrieved {len(results)} context chunks for topic/query.",
                metadata={"chunk_ids": [r.chunk_id for r in results]},
            )
        )

        return results
