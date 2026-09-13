"""
Validation engine for LLM-generated questions and outputs.
Enforces that no LLM proposal can ever bypass the QuestionGraph contract (Requirement #8).
"""
from __future__ import annotations
import re
from typing import Optional, Set, Tuple
from schemas.question import Question, Difficulty, QuestionType
from providers.base import QuestionProposal
from answer_engine.prompt_defense import detect_injection


class QuestionValidator:
    """
    Validates candidate-aware question proposals from LLM providers before they can be
    integrated into the interview session or QuestionGraph.
    """

    @staticmethod
    def validate_proposal(
        proposal: QuestionProposal,
        active_topic: Optional[str] = None,
        asked_question_ids: Optional[Set[str]] = None,
        existing_question_texts: Optional[Set[str]] = None,
    ) -> Tuple[bool, Optional[Question], str]:
        """
        Validates an LLM QuestionProposal against strict contract rules.
        Returns:
            (is_valid: bool, validated_question: Optional[Question], reason: str)
        """
        asked_ids = asked_question_ids or set()
        existing_texts = {t.lower().strip() for t in (existing_question_texts or set())}

        # 1. Security & Safety check: detect injection or meta instructions in question text
        if detect_injection(proposal.question_text):
            return False, None, "Proposed question contained unsafe prompt injection or override patterns."

        # 2. Question text length and substance check
        clean_text = proposal.question_text.strip()
        if len(clean_text) < 15 or len(clean_text.split()) < 4:
            return False, None, "Proposed question text is too brief to be technically substantive."

        # 3. Duplicate check against existing asked or known questions
        if clean_text.lower() in existing_texts:
            return False, None, "Proposed question text duplicates an already-asked or existing question."

        # 4. Topic compatibility check
        if active_topic:
            act_clean = active_topic.lower().strip()
            prop_clean = proposal.topic.lower().strip()
            # Allow exact match, substring match, or common subtopic
            if act_clean not in prop_clean and prop_clean not in act_clean:
                return (
                    False,
                    None,
                    f"Proposed question targeted topic '{proposal.topic}', outside active round topic '{active_topic}'.",
                )

        # 5. Expected concepts check (Must have at least 1 substantive expected concept)
        valid_concepts = [c.strip() for c in proposal.expected_concepts if c and c.strip()]
        if not valid_concepts:
            return False, None, "Proposed question omitted required expected concepts for deterministic evaluation."

        # 6. Difficulty and Type validation
        if not isinstance(proposal.difficulty, Difficulty):
            try:
                diff = Difficulty(proposal.difficulty)
            except ValueError:
                return False, None, f"Invalid difficulty level '{proposal.difficulty}'."
        else:
            diff = proposal.difficulty

        if not isinstance(proposal.question_type, QuestionType):
            try:
                qtype = QuestionType(proposal.question_type)
            except ValueError:
                return False, None, f"Invalid question type '{proposal.question_type}'."
        else:
            qtype = proposal.question_type

        # 7. Generate a unique question ID conforming to the graph convention
        topic_slug = re.sub(r"[^\w]+", "_", proposal.topic.lower()).strip("_")
        generated_id = f"llm_{topic_slug}_{abs(hash(clean_text)) % 100000:05d}"

        if generated_id in asked_ids:
            return False, None, f"Generated question ID '{generated_id}' has already been asked in this session."

        concept_descriptions = proposal.concept_descriptions or {
            c: f"Candidate must explain {c}." for c in valid_concepts
        }

        # Construct authoritative Question
        validated_question = Question(
            id=generated_id,
            topic=proposal.topic,
            subtopic=proposal.subtopic,
            difficulty=diff,
            question_type=qtype,
            question_text=clean_text,
            expected_concepts=valid_concepts,
            concept_descriptions=concept_descriptions,
        )

        return (
            True,
            validated_question,
            f"Question proposal '{validated_question.id}' passed full validation for topic '{proposal.topic}'.",
        )
