"""
End-to-End Interview Session Runner (Demo Mode / Offline Integration).
Glues State Machine, Question Graph, Answer Engine, Decision Engine, and Round Strategies
into a seamless turn loop.
Zero live LLM dependencies (non-negotiable rule #1).
"""
from __future__ import annotations
from typing import Optional, Dict, List
from schemas.question import Question, Difficulty
from schemas.interview_state import (
    InterviewState,
    InterviewPhase,
    RoundType,
    Decision,
    DecisionAction,
    SessionTurnResult,
)
from schemas.evaluation import AnswerVerdict
from orchestrator.state_machine import InterviewOrchestrator
from orchestrator.exceptions import InterviewCompletedError, InvalidStateTransitionError
from question_engine.graph import QuestionGraph
from answer_engine.engine import evaluate_answer
from decision_engine.rules import decide_next_step
from observability.trace import TraceLogger, TraceEvent, global_tracer
from rounds.manager import RoundManager, InterviewFlowConfig
from memory.candidate_context import CandidateContextMemory


class InterviewSession:
    """
    Coordinates an entire multi-turn interview session in Demo Mode.
    Ensures that Answer Engine, Decision Engine, Question Engine, Round Strategy,
    and State Machine execute in strict sequential harmony without mixing responsibilities.
    """

    def __init__(
        self,
        session_id: str,
        round_type: RoundType,
        question_graph: QuestionGraph,
        topic: Optional[str] = None,
        max_turns: int = 6,  # Production standard: 6 questions in total
        max_followups_per_question: int = 2,
        tracer: Optional[TraceLogger] = None,
        flow_config: Optional[InterviewFlowConfig] = None,
        round_manager: Optional[RoundManager] = None,
        candidate_context: Optional[CandidateContextMemory] = None,
    ):
        self.question_graph = question_graph
        self.max_turns = max_turns
        self.max_followups_per_question = max_followups_per_question
        self.tracer = tracer or global_tracer
        self.candidate_context = candidate_context

        # Initialize RoundManager with explicit or default configuration
        if round_manager:
            self.round_manager = round_manager
        elif flow_config:
            self.round_manager = RoundManager(
                config=flow_config,
                candidate_context=candidate_context,
            )
        else:
            self.round_manager = RoundManager(
                config=InterviewFlowConfig(
                    round_sequence=[round_type],
                    max_total_questions=max_turns,
                ),
                candidate_context=candidate_context,
            )

        self.state = InterviewState(
            session_id=session_id,
            mode="demo",
            round=round_type,
            current_topic=topic,
        )
        self.orchestrator = InterviewOrchestrator(self.state, tracer=self.tracer)
        self._current_question: Optional[Question] = None
        self.turn_results: List[SessionTurnResult] = []

    @property
    def current_question(self) -> Optional[Question]:
        return self._current_question

    @property
    def current_phase(self) -> InterviewPhase:
        return self.orchestrator.current_phase

    @property
    def is_complete(self) -> bool:
        return self.orchestrator.is_terminal()

    def start(self) -> Question:
        """
        Begins the interview session.
        Transitions INTRO -> ASKING -> LISTENING and poses the initial foundational question
        respecting the active RoundStrategy constraints.
        """
        if self.orchestrator.current_phase != InterviewPhase.INTRO:
            raise InvalidStateTransitionError(
                current_phase=self.orchestrator.current_phase.value,
                target_phase=InterviewPhase.ASKING.value,
                reason="Session has already been started.",
            )

        strategy = self.round_manager.get_current_strategy(self.state)
        constraints = strategy.get_constraints(self.state)

        self.tracer.record(
            TraceEvent(
                session_id=self.state.session_id,
                turn=self.state.current_turn,
                event_type="round_started",
                reason=f"Starting round {self.state.round}: {strategy.round_objective}",
                metadata={"round": str(self.state.round), "objective": strategy.round_objective},
            )
        )
        self.tracer.record(
            TraceEvent(
                session_id=self.state.session_id,
                turn=self.state.current_turn,
                event_type="round_constraints_applied",
                reason=f"Applied constraints for {self.state.round} round",
                metadata={"progression": constraints.progression_policy},
            )
        )

        self.orchestrator.transition_to(
            InterviewPhase.ASKING,
            reason=f"Starting {self.state.round} interview session",
        )

        q, reason = self.question_graph.get_initial_question(
            topic=self.state.current_topic,
            difficulty=Difficulty.FOUNDATIONAL,
            constraints=constraints,
        )
        if not q:
            # Fallback to any unasked question matching round constraints
            q, reason = self.question_graph.get_initial_question(
                topic=None,
                difficulty=Difficulty.FOUNDATIONAL,
                constraints=constraints,
            )

        if not q:
            self.orchestrator.transition_to(
                InterviewPhase.ROUND_COMPLETE,
                reason="No questions found in question graph for target topic/constraints.",
            )
            raise RuntimeError(f"No questions available in question graph for topic '{self.state.current_topic}'")

        self._current_question = q
        self.orchestrator.record_asked_question(q.id, q.question_text)
        self.state.current_topic = q.topic

        self.orchestrator.transition_to(
            InterviewPhase.LISTENING,
            reason="Interviewer finished reading question; microphone active for candidate answer.",
        )
        return q

    def submit_answer(
        self,
        answer_text: str,
        fact_slot_claims: Optional[Dict[str, str]] = None,
    ) -> SessionTurnResult:
        """
        Executes one full cycle of an interview turn:
        1. Transition LISTENING -> PROCESSING
        2. Answer Engine: evaluate_answer -> AnswerVerdict
        3. Orchestrator: update running scores & fact slots
        4. Decision Engine: decide_next_step -> Decision
        5. Transition PROCESSING -> RESPONDING
        6. Check completion limits and round transition policy
        7. Question Engine: selects next question (FOLLOW_UP / ASKING / TRANSITIONING)
        """
        if self.orchestrator.is_terminal():
            raise InterviewCompletedError("Cannot submit answer to an already completed interview.")

        if self.orchestrator.current_phase != InterviewPhase.LISTENING:
            raise InvalidStateTransitionError(
                current_phase=self.orchestrator.current_phase.value,
                target_phase=InterviewPhase.PROCESSING.value,
                reason=f"Session is in {self.orchestrator.current_phase.value}, must be in LISTENING phase.",
            )

        if not self._current_question:
            raise RuntimeError("No current question active in session.")

        # 1. Candidate submitted answer -> PROCESSING
        self.orchestrator.transition_to(
            InterviewPhase.PROCESSING,
            reason="Candidate submitted answer text; evaluating concept coverage.",
        )

        # 2. Answer Engine evaluation
        verdict = evaluate_answer(self._current_question, answer_text)

        # 3. Opportunistic fact claims / contradiction tracking
        if fact_slot_claims:
            for slot, val in fact_slot_claims.items():
                self.orchestrator.record_fact(slot, val)

        # 4. Orchestrator updates running scores and concept sets
        self.orchestrator.update_scores(verdict)

        # 5. Decision Engine decides next step
        decision = decide_next_step(
            verdict,
            state=self.state,
            max_followups_per_question=self.max_followups_per_question,
        )
        self.orchestrator.apply_decision(decision)

        # 6. PROCESSING -> RESPONDING
        self.orchestrator.transition_to(
            InterviewPhase.RESPONDING,
            reason="Evaluation and decision computed; delivering interviewer response.",
        )

        # 7. Check if global turn budget exhausted
        if self.state.current_turn >= self.max_turns:
            self.tracer.record(
                TraceEvent(
                    session_id=self.state.session_id,
                    turn=self.state.current_turn,
                    event_type="round_completed",
                    reason=f"Reached session turn limit ({self.max_turns}); round complete.",
                    metadata={"round": str(self.state.round), "turns": self.state.current_turn},
                )
            )
            self.orchestrator.transition_to(
                InterviewPhase.ROUND_COMPLETE,
                reason=f"Reached session turn limit ({self.max_turns}); round complete.",
            )
            self._current_question = None
            res = SessionTurnResult(
                turn=self.state.current_turn,
                phase=self.orchestrator.current_phase,
                verdict=verdict,
                decision=decision,
                next_question=None,
                is_complete=True,
                state=self.state,
            )
            self.turn_results.append(res)
            return res

        # 8. Check Round Strategy completion & transition
        is_round_complete, next_round, round_reason = self.round_manager.check_round_transition(
            self.state,
            verdict=verdict,
        )

        asked_ids = {q.question_id for q in self.state.question_history}
        if self._current_question:
            asked_ids.add(self._current_question.id)

        if is_round_complete:
            self.tracer.record(
                TraceEvent(
                    session_id=self.state.session_id,
                    turn=self.state.current_turn,
                    event_type="round_completed",
                    reason=round_reason,
                    metadata={"completed_round": str(self.state.round)},
                )
            )
            self.tracer.record(
                TraceEvent(
                    session_id=self.state.session_id,
                    turn=self.state.current_turn,
                    event_type="round_completion_reason",
                    reason=round_reason,
                    metadata={"completed_round": str(self.state.round)},
                )
            )

            if next_round and self.state.current_turn < self.max_turns:
                # Transition to next round via State Machine
                self.orchestrator.transition_to(
                    InterviewPhase.TRANSITIONING,
                    reason=round_reason,
                )
                next_name = next_round.value if hasattr(next_round, "value") else str(next_round)
                self.orchestrator.transition_round(
                    next_round,
                    reason=f"Transitioning from {self.state.round} to {next_name} round.",
                )

                next_strat = self.round_manager.get_current_strategy(self.state)
                next_constraints = next_strat.get_constraints(self.state)

                self.tracer.record(
                    TraceEvent(
                        session_id=self.state.session_id,
                        turn=self.state.current_turn,
                        event_type="round_started",
                        reason=f"Starting round {next_name}: {next_strat.round_objective}",
                        metadata={"round": next_name, "objective": next_strat.round_objective},
                    )
                )
                self.tracer.record(
                    TraceEvent(
                        session_id=self.state.session_id,
                        turn=self.state.current_turn,
                        event_type="round_constraints_applied",
                        reason=f"Applied constraints for {next_name} round",
                        metadata={"progression": next_constraints.progression_policy},
                    )
                )


                # Select initial question for new round
                next_q, q_reason = self.question_graph.get_initial_question(
                    topic=None,
                    difficulty=Difficulty.FOUNDATIONAL,
                    exclude_ids=asked_ids,
                    constraints=next_constraints,
                )
                if not next_q:
                    next_q, q_reason = self.question_graph.get_initial_question(
                        topic=self.state.current_topic,
                        difficulty=Difficulty.FOUNDATIONAL,
                        exclude_ids=asked_ids,
                    )

                if next_q:
                    self.orchestrator.transition_to(InterviewPhase.ASKING, reason=q_reason)
                    self.orchestrator.record_asked_question(next_q.id, next_q.question_text)
                    self.state.current_topic = next_q.topic
                    self._current_question = next_q
                    self.orchestrator.transition_to(
                        InterviewPhase.LISTENING,
                        reason="Listening for candidate answer in new round.",
                    )
                    res = SessionTurnResult(
                        turn=self.state.current_turn,
                        phase=self.orchestrator.current_phase,
                        verdict=verdict,
                        decision=decision,
                        next_question=next_q,
                        is_complete=False,
                        state=self.state,
                    )
                    self.turn_results.append(res)
                    return res
                else:
                    self.orchestrator.transition_to(
                        InterviewPhase.ROUND_COMPLETE,
                        reason="No questions available for next round; completing interview.",
                    )
                    self._current_question = None
                    res = SessionTurnResult(
                        turn=self.state.current_turn,
                        phase=self.orchestrator.current_phase,
                        verdict=verdict,
                        decision=decision,
                        next_question=None,
                        is_complete=True,
                        state=self.state,
                    )
                    self.turn_results.append(res)
                    return res
            else:
                # No next round or reached turn budget -> ROUND_COMPLETE
                self.orchestrator.transition_to(
                    InterviewPhase.ROUND_COMPLETE,
                    reason=round_reason,
                )
                self._current_question = None
                res = SessionTurnResult(
                    turn=self.state.current_turn,
                    phase=self.orchestrator.current_phase,
                    verdict=verdict,
                    decision=decision,
                    next_question=None,
                    is_complete=True,
                    state=self.state,
                )
                self.turn_results.append(res)
                return res

        # 9. Normal question progression within active round
        current_strategy = self.round_manager.get_current_strategy(self.state)
        current_constraints = current_strategy.get_constraints(self.state)

        next_q, q_reason = self.question_graph.select_next_question(
            current_question_id=self._current_question.id,
            action=decision.action,
            exclude_ids=asked_ids,
            target_question_id=decision.target_question_id,
            constraints=current_constraints,
        )

        if not next_q:
            # Question graph exhausted for this round
            self.orchestrator.transition_to(
                InterviewPhase.ROUND_COMPLETE,
                reason="All questions in QuestionGraph exhausted; completing round.",
            )
            self._current_question = None
            res = SessionTurnResult(
                turn=self.state.current_turn,
                phase=self.orchestrator.current_phase,
                verdict=verdict,
                decision=decision,
                next_question=None,
                is_complete=True,
                state=self.state,
            )
            self.turn_results.append(res)
            return res

        # Route transition based on decision action
        if decision.action == DecisionAction.TRANSITION_TOPIC:
            self.orchestrator.transition_to(InterviewPhase.TRANSITIONING, reason=decision.reason)
            self.state.current_topic = next_q.topic
            self.orchestrator.transition_to(InterviewPhase.ASKING, reason=q_reason)
            self.orchestrator.record_asked_question(next_q.id, next_q.question_text)
            self._current_question = next_q
            self.orchestrator.transition_to(InterviewPhase.LISTENING, reason="Listening for candidate answer.")

        elif decision.action in {DecisionAction.CLARIFY, DecisionAction.DEEPEN} and (
            next_q.id in self._current_question.possible_followups
        ):
            self.orchestrator.transition_to(InterviewPhase.FOLLOW_UP, reason=decision.reason)
            self.orchestrator.record_asked_question(next_q.id, next_q.question_text)
            self._current_question = next_q
            self.orchestrator.transition_to(InterviewPhase.LISTENING, reason="Listening for candidate answer.")

        else:
            self.orchestrator.transition_to(InterviewPhase.ASKING, reason=q_reason)
            self.orchestrator.record_asked_question(next_q.id, next_q.question_text)
            self._current_question = next_q
            self.orchestrator.transition_to(InterviewPhase.LISTENING, reason="Listening for candidate answer.")

        res = SessionTurnResult(
            turn=self.state.current_turn,
            phase=self.orchestrator.current_phase,
            verdict=verdict,
            decision=decision,
            next_question=next_q,
            is_complete=False,
            state=self.state,
        )
        self.turn_results.append(res)
        return res

    def generate_report(self, duration_seconds: Optional[float] = None):
        """
        Generates the authoritative FinalInterviewReport synthesizing all turns, verdicts,
        decisions, and state from this interview session.
        """
        from scoring.report_engine import ReportEngine
        engine = ReportEngine(tracer=self.tracer)
        return engine.generate_report(
            state=self.state,
            turn_results=self.turn_results,
            candidate_context=self.candidate_context,
            duration_seconds=duration_seconds,
        )

