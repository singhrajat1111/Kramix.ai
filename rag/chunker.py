"""
Deterministic chunking engine for candidate documents.
Splits parsed text into retrieval-friendly ContextChunks preserving section metadata.
"""
from __future__ import annotations
import re
from typing import List, Optional
from rag.models import ContextChunk, ContextSourceType, ParsedDocument


class DeterministicChunker:
    """
    Splits ParsedDocuments into ContextChunks with deterministic boundaries and overlap.
    """

    def __init__(self, target_words: int = 150, overlap_words: int = 25):
        self.target_words = target_words
        self.overlap_words = overlap_words

    def chunk_document(
        self,
        document: ParsedDocument,
        candidate_id: str,
        source_id: Optional[str] = None,
        source_type: ContextSourceType = ContextSourceType.RESUME,
    ) -> List[ContextChunk]:
        """
        Chunks all sections of a parsed document into structured ContextChunks.
        """
        effective_source_id = source_id or document.filename
        chunks: List[ContextChunk] = []
        global_index = 0

        # Chunk each section individually to preserve contextual boundaries
        for section_name, section_text in document.sections.items():
            section_chunks = self._chunk_text(
                text=section_text,
                section=section_name,
                source_id=effective_source_id,
                candidate_id=candidate_id,
                source_type=source_type,
                start_index=global_index,
            )
            chunks.extend(section_chunks)
            global_index += len(section_chunks)

        return chunks

    def _chunk_text(
        self,
        text: str,
        section: str,
        source_id: str,
        candidate_id: str,
        source_type: ContextSourceType,
        start_index: int = 0,
    ) -> List[ContextChunk]:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [text.strip()] if text.strip() else []

        words_pool: List[str] = []
        for p in paragraphs:
            words_pool.extend(p.split())

        if not words_pool:
            return []

        chunks: List[ContextChunk] = []
        step = max(1, self.target_words - self.overlap_words)
        idx = 0

        while idx < len(words_pool):
            chunk_slice = words_pool[idx:idx + self.target_words]
            chunk_content = " ".join(chunk_slice)
            chunk_idx = start_index + len(chunks)

            # Generate a readable title from section and leading words
            title_sample = " ".join(chunk_slice[:6])
            chunk_title = f"{section.title()}: {title_sample}..."

            chunk = ContextChunk(
                chunk_id=f"{source_id}_{section}_{chunk_idx:03d}",
                source_id=source_id,
                candidate_id=candidate_id,
                source_type=source_type,
                section=section,
                title=chunk_title,
                chunk_index=chunk_idx,
                content=chunk_content,
                metadata={
                    "word_count": len(chunk_slice),
                    "section": section,
                    "is_untrusted_candidate_context": True,
                },
            )
            chunks.append(chunk)
            idx += step

        return chunks
