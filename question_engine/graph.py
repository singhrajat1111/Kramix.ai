"""
Question Graph data structure and deterministic navigation engine.
Answers 'which question, concretely' based on topic, difficulty, and decision action.
Zero answer evaluation or decision choosing logic lives here.
"""
from __future__ import annotations
import random
import re
from typing import Any, Dict, List, Set, Optional, Tuple
from schemas.question import Question, Difficulty, QuestionType
from schemas.interview_state import DecisionAction


class QuestionGraph:
    """
    In-memory graph of interview questions.
    Indexes questions by id, topic, subtopic, and difficulty,
    and supports deterministic traversal across follow-ups, lateral shifts, and difficulty escalation.
    """

    def __init__(self):
        self._questions: Dict[str, Question] = {}
        self._by_topic: Dict[str, List[str]] = {}
        self._by_difficulty: Dict[Difficulty, List[str]] = {
            Difficulty.FOUNDATIONAL: [],
            Difficulty.APPLIED: [],
            Difficulty.ARCHITECTURAL: [],
        }
        self._followups: Dict[str, List[str]] = {}
        self._related: Dict[str, List[str]] = {}

    def add_question(self, question: Question) -> None:
        qid = question.id
        self._questions[qid] = question

        topic = question.topic.lower().strip()
        if topic not in self._by_topic:
            self._by_topic[topic] = []
        if qid not in self._by_topic[topic]:
            self._by_topic[topic].append(qid)

        diff = question.difficulty
        if diff in self._by_difficulty and qid not in self._by_difficulty[diff]:
            self._by_difficulty[diff].append(qid)

        self._followups[qid] = list(question.possible_followups)
        self._related[qid] = list(question.related_questions)

    def get_question(self, qid: str) -> Optional[Question]:
        return self._questions.get(qid)

    def get_all_questions(self) -> List[Question]:
        return list(self._questions.values())

    def get_topics(self) -> List[str]:
        return sorted(list(self._by_topic.keys()))

    def get_initial_question(
        self,
        topic: Optional[str] = None,
        difficulty: Difficulty = Difficulty.FOUNDATIONAL,
        exclude_ids: Optional[Set[str]] = None,
        constraints: Optional[Any] = None,
    ) -> Tuple[Optional[Question], str]:
        """
        Selects an initial question for a session or round.
        Respects RoundConstraints (allowed_topics, preferred_types, allowed_difficulties) if provided.
        Returns (Question, reason_string).
        """
        exclude = exclude_ids or set()
        target_topic = topic.lower().strip() if topic else None

        # Check constraints for topic preferences if topic not explicitly given
        allowed_topics = getattr(constraints, "allowed_topics", None) if constraints else None
        preferred_types = set(getattr(constraints, "preferred_question_types", [])) if constraints else set()
        allowed_diffs = set(getattr(constraints, "allowed_difficulties", [])) if constraints else set()

        candidates = list(self._questions.values())
        if target_topic:
            # 1. Exact match
            matched = [q for q in candidates if q.topic.lower().strip() == target_topic]
            # 2. Substring / partial match
            if not matched:
                matched = [
                    q for q in candidates
                    if target_topic in q.topic.lower().strip() or q.topic.lower().strip() in target_topic
                ]
            if matched:
                candidates = matched
        elif allowed_topics:
            allowed_set = {t.lower().strip() for t in allowed_topics}
            matched = [
                q for q in candidates
                if any(at in q.topic.lower().strip() or q.topic.lower().strip() in at for at in allowed_set)
            ]
            if matched:
                candidates = matched

        # Filter unasked and non-similar questions
        unasked = [q for q in candidates if self._is_eligible(q, exclude)]
        if not unasked:
            return None, f"No unasked questions available in topic '{target_topic or 'all'}'"

        # If allowed difficulties are constrained, filter
        if allowed_diffs:
            diff_candidates = [q for q in unasked if q.difficulty in allowed_diffs]
            if diff_candidates:
                unasked = diff_candidates

        # Prioritize matching difficulty first, then preferred question types
        diff_matched = [q for q in unasked if q.difficulty == difficulty]
        pool = diff_matched if diff_matched else unasked

        if preferred_types:
            type_matched = [q for q in pool if q.question_type in preferred_types]
            if type_matched:
                pool = type_matched

        selected = random.choice(pool) if pool else unasked[0]
        reason = (
            f"Selected initial {selected.difficulty} question '{selected.id}' "
            f"for topic '{selected.topic}'."
        )
        return selected, reason


    def _is_duplicate_or_similar(self, candidate: Question, exclude_ids: Set[str]) -> bool:
        """
        Guarantees semantic deduplication: detects if candidate is a twin variant or
        shares overlapping technical concepts with any previously asked question.
        """
        if candidate.id in exclude_ids:
            return True
        t_cand = candidate.question_text.lower().strip()
        c_cand = {c.lower().strip() for c in candidate.expected_concepts}

        stopwords = {
            "what", "when", "where", "which", "while", "who", "whom", "whose", "why",
            "how", "does", "explain", "describe", "difference", "between", "versus",
            "with", "from", "that", "this", "these", "those", "their", "there", "about",
            "would", "could", "should", "your", "give", "work", "works", "using", "application",
            "applications"
        }
        w_cand = {w for w in re.findall(r"\w+", t_cand) if len(w) > 2 and w not in stopwords}

        for ex_id in exclude_ids:
            ex_q = self._questions.get(ex_id)
            if not ex_q:
                continue
            t_ex = ex_q.question_text.lower().strip()
            if t_cand == t_ex:
                return True

            # Check concept overlap
            c_ex = {c.lower().strip() for c in ex_q.expected_concepts}
            if c_cand and c_ex:
                c_overlap = len(c_cand & c_ex)
                if c_overlap >= 2 or (c_overlap >= 1 and min(len(c_cand), len(c_ex)) <= 2):
                    return True

            # Check keyword containment and overlap
            w_ex = {w for w in re.findall(r"\w+", t_ex) if len(w) > 2 and w not in stopwords}
            if w_cand and w_ex:
                overlap = len(w_cand & w_ex)
                min_len = min(len(w_cand), len(w_ex))
                union_len = len(w_cand | w_ex)
                if min_len >= 2 and (overlap / min_len) >= 0.75:
                    diff1 = w_cand - w_ex
                    diff2 = w_ex - w_cand
                    # If distinctive single keywords differ (e.g. overloading vs overriding), allow
                    if diff1 and diff2 and len(diff1) == 1 and len(diff2) == 1:
                        continue
                    return True
                if union_len > 0 and (overlap / union_len) >= 0.65:
                    return True

        return False

    def _is_eligible(self, q: Question, exclude: Set[str]) -> bool:
        if q.id in exclude:
            return False
        return not self._is_duplicate_or_similar(q, exclude)

    def select_next_question(
        self,
        current_question_id: str,
        action: DecisionAction,
        exclude_ids: Optional[Set[str]] = None,
        target_question_id: Optional[str] = None,
        constraints: Optional[Any] = None,
    ) -> Tuple[Optional[Question], str]:
        """
        Deterministically selects the next question based on the Decision Engine's action
        and optional RoundConstraints.
        Returns (Question, reason_string).
        """
        exclude = set(exclude_ids or set())
        exclude.add(current_question_id)

        allowed_topics = getattr(constraints, "allowed_topics", None) if constraints else None
        allowed_diffs = set(getattr(constraints, "allowed_difficulties", [])) if constraints else set()

        # 1. If explicit target question id was designated
        if target_question_id and target_question_id in self._questions:
            if self._is_eligible(self._questions[target_question_id], exclude):
                q = self._questions[target_question_id]
                return q, f"Selected explicitly targeted question '{q.id}' ({q.topic})."

        current_q = self._questions.get(current_question_id)
        current_topic = current_q.topic.lower().strip() if current_q else None

        # 2. DEEPEN action
        if action == DecisionAction.DEEPEN:
            # Check direct graph follow-ups first
            followups = self._followups.get(current_question_id, [])
            unasked_followups = [
                self._questions[fid] for fid in followups
                if fid in self._questions and self._is_eligible(self._questions[fid], exclude)
            ]
            if unasked_followups:
                unasked_followups.sort(key=lambda q: self._difficulty_rank(q.difficulty), reverse=True)
                top_rank = self._difficulty_rank(unasked_followups[0].difficulty)
                top_candidates = [q for q in unasked_followups if self._difficulty_rank(q.difficulty) == top_rank]
                selected = random.choice(top_candidates)
                return selected, f"Deepening: selected direct graph follow-up '{selected.id}' (difficulty={selected.difficulty})."

            # Search same topic for higher difficulty
            if current_q and current_topic:
                cur_rank = self._difficulty_rank(current_q.difficulty)
                topic_qids = self._by_topic.get(current_topic, [])
                higher_diff = [
                    self._questions[qid] for qid in topic_qids
                    if self._is_eligible(self._questions[qid], exclude) and self._difficulty_rank(self._questions[qid].difficulty) > cur_rank
                ]
                if higher_diff:
                    selected = random.choice(higher_diff)
                    return selected, f"Deepening: escalated to higher difficulty '{selected.difficulty}' question '{selected.id}' in '{selected.topic}'."

                # If no strictly higher difficulty exists, probe unasked in same topic before leaving
                unasked_same = [
                    self._questions[qid] for qid in topic_qids
                    if self._is_eligible(self._questions[qid], exclude)
                ]
                if unasked_same:
                    selected = random.choice(unasked_same)
                    return selected, f"Deepening: selected next question '{selected.id}' in current topic '{selected.topic}'."

        # 3. SIMPLIFY action
        elif action == DecisionAction.SIMPLIFY:
            if current_q and current_topic:
                cur_rank = self._difficulty_rank(current_q.difficulty)
                topic_qids = self._by_topic.get(current_topic, [])
                lower_diff = [
                    self._questions[qid] for qid in topic_qids
                    if self._is_eligible(self._questions[qid], exclude) and self._difficulty_rank(self._questions[qid].difficulty) < cur_rank
                ]
                if lower_diff:
                    selected = random.choice(lower_diff)
                    return selected, f"Simplifying: routed to lower difficulty '{selected.difficulty}' question '{selected.id}' in '{selected.topic}'."

            # Check related questions
            related = self._related.get(current_question_id, [])
            unasked_related = [
                self._questions[rid] for rid in related
                if rid in self._questions and self._is_eligible(self._questions[rid], exclude)
            ]
            if unasked_related:
                selected = random.choice(unasked_related)
                return selected, f"Simplifying: routed to related foundational concept question '{selected.id}'."

            # If no lower difficulty exists, probe unasked in same topic before leaving
            if current_topic:
                topic_qids = self._by_topic.get(current_topic, [])
                unasked_same = [
                    self._questions[qid] for qid in topic_qids
                    if self._is_eligible(self._questions[qid], exclude)
                ]
                if unasked_same:
                    selected = random.choice(unasked_same)
                    return selected, f"Simplifying: selected foundational question '{selected.id}' in current topic '{selected.topic}'."

        # 4. CLARIFY action
        elif action == DecisionAction.CLARIFY:
            # Check clarification follow-ups or direct follow-ups
            followups = self._followups.get(current_question_id, [])
            unasked_followups = [
                self._questions[fid] for fid in followups
                if fid in self._questions and self._is_eligible(self._questions[fid], exclude)
            ]
            clarifications = [q for q in unasked_followups if q.question_type == QuestionType.CLARIFICATION]
            if clarifications:
                selected = random.choice(clarifications)
                return selected, f"Clarification: selected targeted follow-up clarification '{selected.id}'."
            if unasked_followups:
                selected = random.choice(unasked_followups)
                return selected, f"Clarification: selected graph follow-up '{selected.id}' to probe further."

            # If no direct follow-up exists, probe unasked in same topic before leaving
            if current_topic:
                topic_qids = self._by_topic.get(current_topic, [])
                unasked_same = [
                    self._questions[qid] for qid in topic_qids
                    if self._is_eligible(self._questions[qid], exclude)
                ]
                if unasked_same:
                    selected = random.choice(unasked_same)
                    return selected, f"Clarification: probing next concept in current topic '{selected.topic}' with question '{selected.id}'."

        # 5. MOVE_ON action
        elif action == DecisionAction.MOVE_ON:
            # First check unasked questions in the same topic
            if current_topic:
                topic_qids = self._by_topic.get(current_topic, [])
                unasked_same_topic = [
                    self._questions[qid] for qid in topic_qids
                    if self._is_eligible(self._questions[qid], exclude)
                ]
                if unasked_same_topic:
                    selected = random.choice(unasked_same_topic)
                    return selected, f"Moving on: selected next planned question '{selected.id}' in current topic '{selected.topic}'."

        # 6. TRANSITION_TOPIC (or fallback when current topic exhausted)
        # Find next available compatible topic with unasked questions
        all_topics = self.get_topics()
        other_topics = [t for t in all_topics if t != current_topic]

        if allowed_topics:
            allowed_set = {t.lower().strip() for t in allowed_topics}
            other_topics = [
                t for t in other_topics
                if any(at in t.lower() or t.lower() in at for at in allowed_set)
            ]
        elif current_topic:
            # Prevent jumping to completely unrelated role domains
            # Only consider topics that share a keyword or stem with current topic
            keywords = [w for w in current_topic.split() if len(w) > 3 and w not in {"developer", "engineer", "software", "architect"}]
            if keywords:
                compatible = [
                    t for t in other_topics
                    if any(kw in t.lower() for kw in keywords)
                ]
                if compatible:
                    other_topics = compatible

        for next_topic in other_topics:
            topic_qids = self._by_topic.get(next_topic, [])
            unasked_in_next = [
                self._questions[qid] for qid in topic_qids
                if self._is_eligible(self._questions[qid], exclude)
            ]
            if unasked_in_next:
                # If constraints allow specific difficulties, prioritize them
                if allowed_diffs:
                    matching_diff = [q for q in unasked_in_next if q.difficulty in allowed_diffs]
                    if matching_diff:
                        unasked_in_next = matching_diff

                selected = random.choice(unasked_in_next)
                return selected, f"Transitioning topic: moved from '{current_topic}' to '{selected.topic}' with question '{selected.id}'."

        # Final fallback within current topic or allowed topics only
        if current_topic:
            topic_qids = self._by_topic.get(current_topic, [])
            unasked_same = [
                self._questions[qid] for qid in topic_qids
                if self._is_eligible(self._questions[qid], exclude)
            ]
            if unasked_same:
                selected = random.choice(unasked_same)
                return selected, f"Topic fallback: continuing with question in '{current_topic}'."

        return None, "All questions in the designated topic track have been exhausted."

    @staticmethod
    def _difficulty_rank(difficulty: Difficulty | str) -> int:
        ranks = {
            Difficulty.FOUNDATIONAL: 1,
            Difficulty.APPLIED: 2,
            Difficulty.ARCHITECTURAL: 3,
            "foundational": 1,
            "applied": 2,
            "architectural": 3,
        }
        return ranks.get(difficulty, 1)
