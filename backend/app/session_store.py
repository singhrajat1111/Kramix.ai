"""
Active Session Store, Recovery Manager, and Relational Persistence Integration for Kramix V2.
Coordinates memory runtime, state recovery on server restart, concurrency locking, and turn persistence.

NON-NEGOTIABLE ARCHITECTURAL RULES:
1. InterviewSession remains the single authority.
2. An asyncio.Lock per session prevents race conditions or double evaluations on rapid submissions.
3. Reconnection recovers active state without restarting or advancing turn budget.
4. Production repository persists sessions, turns, states, and reports for robust recovery.
"""
from __future__ import annotations
import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Dict, Optional, List

from schemas.interview_state import (
    RoundType,
    InterviewPhase,
    InterviewState,
    SessionTurnResult,
    Decision,
    DecisionAction,
)
from schemas.evaluation import AnswerVerdict
from schemas.report import FinalInterviewReport
from orchestrator.session_runner import InterviewSession
from orchestrator.state_machine import InterviewOrchestrator
from question_engine.loader import load_question_bank_from_json
from question_engine.graph import QuestionGraph
from rounds.manager import RoundManager, InterviewFlowConfig
from observability.trace import TraceLogger, TraceEvent, global_tracer
from backend.app.schemas_api import (
    CreateSessionRequest,
    CreateSessionResponse,
    SessionStateResponse,
    ClientQuestion,
)
from storage.base import BaseInterviewRepository
from storage.models import (
    SessionRecord,
    TurnRecord,
    StateRecord,
    ReportRecord,
)
from storage.factory import get_repository


class ActiveSession:
    """
    Encapsulates an active interview session, its locking primitive, connection metadata,
    and repository persistence delegate.
    """
    def __init__(
        self,
        session_id: str,
        runner: InterviewSession,
        tracer: TraceLogger,
        repository: Optional[BaseInterviewRepository] = None,
    ):
        self.session_id = session_id
        self.runner = runner
        self.tracer = tracer
        self.repository = repository or get_repository()
        self.lock = asyncio.Lock()
        self.created_at = time.time()
        self.last_active_at = time.time()
        self.cached_report: Optional[FinalInterviewReport] = None

    def to_safe_state_response(self) -> SessionStateResponse:
        state = self.runner.state
        phase_str = getattr(self.runner.current_phase, "value", str(self.runner.current_phase))
        return SessionStateResponse(
            session_id=self.session_id,
            mode=state.mode,
            round=str(state.round),
            current_turn=state.current_turn,
            phase=phase_str,
            current_topic=state.current_topic,
            is_complete=self.runner.is_complete,
            total_questions_asked=len(state.question_history),
        )

    def get_safe_current_question(self) -> Optional[ClientQuestion]:
        q = self.runner.current_question
        if not q:
            return None
        return ClientQuestion(
            question_id=q.id,
            question_text=q.question_text,
            turn=self.runner.state.current_turn,
            round=str(self.runner.state.round),
            topic=q.topic,
            difficulty=str(q.difficulty.value) if hasattr(q.difficulty, "value") else str(q.difficulty),
        )

    def persist_turn(
        self,
        turn_res: SessionTurnResult,
        answer_text: str,
        input_mode: str = "text",
        stt_confidence: Optional[float] = None,
        audio_duration_seconds: Optional[float] = None,
        idempotency_key: Optional[str] = None,
    ) -> None:
        """
        Atomically persists turn result and current state snapshot.
        """
        turn_num = turn_res.turn
        round_str = str(self.runner.state.round)
        q_id = self.runner.state.question_history[-1].question_id if self.runner.state.question_history else "unknown"
        q_text = self.runner.state.question_history[-1].question_text if self.runner.state.question_history else ""

        verdict_dict = turn_res.verdict.model_dump() if hasattr(turn_res.verdict, "model_dump") else {}
        correctness = float(verdict_dict.get("correctness", 0.0))

        decision_action = turn_res.decision.action if turn_res.decision else "unknown"
        decision_reason = turn_res.decision.reason if turn_res.decision else "turn concluded"

        turn_rec = TurnRecord(
            session_id=self.session_id,
            turn=turn_num,
            round=round_str,
            question_id=q_id,
            question_text=q_text,
            answer_text=answer_text,
            input_mode=input_mode,
            stt_confidence=stt_confidence,
            audio_duration_seconds=audio_duration_seconds,
            decision_action=str(decision_action),
            decision_reason=decision_reason,
            correctness=correctness,
            verdict_json=json.dumps(verdict_dict),
            created_at=time.time(),
        )

        state_rec = StateRecord(
            session_id=self.session_id,
            current_turn=self.runner.state.current_turn,
            current_phase=str(self.runner.current_phase.value if hasattr(self.runner.current_phase, "value") else self.runner.current_phase),
            state_json=self.runner.state.model_dump_json(),
            updated_at=time.time(),
        )

        if hasattr(self.repository, "record_turn_atomic_sync"):
            self.repository.record_turn_atomic_sync(
                self.session_id, turn_rec, state_rec, idempotency_key=idempotency_key
            )
        self.tracer.record(
            TraceEvent(
                session_id=self.session_id,
                turn=turn_num,
                event_type="session_persisted",
                reason=f"Persisted turn {turn_num} and updated state in database.",
                metadata={"turn": turn_num, "phase": state_rec.current_phase},
            )
        )

    def persist_report(self, report: FinalInterviewReport) -> None:
        """
        Persists the FinalInterviewReport and marks session completed.
        """
        self.cached_report = report
        report_rec = ReportRecord(
            session_id=self.session_id,
            report_json=report.model_dump_json(),
            candidate_summary=report.executive_summary,
            hiring_decision=str(report.hiring_assessment.recommendation.value if hasattr(report.hiring_assessment.recommendation, "value") else report.hiring_assessment.recommendation),
            overall_score=report.performance_metrics.overall_score,
            created_at=time.time(),
        )
        if hasattr(self.repository, "save_report_sync"):
            self.repository.save_report_sync(report_rec)
            self.repository.update_session_status_sync(
                session_id=self.session_id,
                status="completed",
                current_phase=str(InterviewPhase.ROUND_COMPLETE.value),
                current_round=str(self.runner.state.round),
                current_turn=self.runner.state.current_turn,
                completed_at=time.time(),
            )
        self.tracer.record(
            TraceEvent(
                session_id=self.session_id,
                turn=self.runner.state.current_turn,
                event_type="report_persisted",
                reason=f"Persisted final report for session {self.session_id} with recommendation {report_rec.hiring_decision}.",
                metadata={"overall_score": report_rec.overall_score, "decision": report_rec.hiring_decision},
            )
        )


class SessionStore:
    """
    Registry and recovery manager for all active interview sessions.
    Seamlessly hydrates from persistent storage if in-memory process was restarted.
    """
    def __init__(
        self,
        seed_data_path: Optional[Path] = None,
        tracer: Optional[TraceLogger] = None,
        repository: Optional[BaseInterviewRepository] = None,
    ):
        self._sessions: Dict[str, ActiveSession] = {}
        self.tracer = tracer or global_tracer
        if seed_data_path:
            self.seed_path = Path(seed_data_path)
        elif Path("data/question-bank-data.json").exists():
            self.seed_path = Path("data/question-bank-data.json")
        else:
            self.seed_path = Path("src/lib/demo/question-bank-data.json")
        self.repository = repository or get_repository()
        self._cached_graph: Optional[QuestionGraph] = None

    def _get_or_load_graph(self) -> QuestionGraph:
        if self._cached_graph is None:
            if not self.seed_path.exists():
                raise FileNotFoundError(f"Question bank data not found at {self.seed_path}")
            self._cached_graph = load_question_bank_from_json(self.seed_path)
        return self._cached_graph

    def create_session(self, req: CreateSessionRequest) -> ActiveSession:
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        graph = self._get_or_load_graph()

        round_sequence = req.round_sequence or [RoundType.TECHNICAL]
        initial_round = round_sequence[0]

        # Determine compatible topics for candidate role
        role_lower = (req.role or "general").lower().strip()
        all_topics = graph.get_topics()

        allowed_topics: List[str] = []
        if "java" in role_lower:
            allowed_topics = [t for t in all_topics if "java" in t.lower() or "spring" in t.lower()]
        elif "react" in role_lower or "frontend" in role_lower:
            allowed_topics = [t for t in all_topics if any(k in t.lower() for k in ["react", "frontend", "mern"])]
        elif "python" in role_lower:
            allowed_topics = [t for t in all_topics if any(k in t.lower() for k in ["python", "machine learning", "ai"])]
        elif ".net" in role_lower or "c#" in role_lower:
            allowed_topics = [t for t in all_topics if ".net" in t.lower() or "c#" in t.lower()]
        elif "android" in role_lower or "mobile" in role_lower:
            allowed_topics = [t for t in all_topics if any(k in t.lower() for k in ["android", "mobile", "flutter", "kotlin"])]
        elif "devops" in role_lower or "cloud" in role_lower:
            allowed_topics = [t for t in all_topics if any(k in t.lower() for k in ["devops", "cloud", "aws", "sre"])]
        elif "data" in role_lower:
            allowed_topics = [t for t in all_topics if any(k in t.lower() for k in ["data", "sql", "database"])]

        if not allowed_topics:
            allowed_topics = [t for t in all_topics if role_lower in t.lower() or t.lower() in role_lower]
        if not allowed_topics:
            allowed_topics = all_topics

        flow_config = InterviewFlowConfig(
            round_sequence=round_sequence,
            max_total_questions=req.max_turns,
            metadata={"role": req.role, "allowed_topics": allowed_topics},
        )

        runner = InterviewSession(
            session_id=session_id,
            round_type=initial_round,
            question_graph=graph,
            topic=req.role or "Database Internals",
            max_turns=req.max_turns,
            flow_config=flow_config,
            tracer=self.tracer,
        )
        runner.state.mode = req.mode

        active = ActiveSession(
            session_id=session_id,
            runner=runner,
            tracer=self.tracer,
            repository=self.repository,
        )
        self._sessions[session_id] = active

        # Persist session and initial state to database
        session_rec = SessionRecord(
            session_id=session_id,
            mode=req.mode,
            role=req.role or "Database Internals",
            status="initialized",
            current_phase="INTRO",
            current_round=initial_round.value if hasattr(initial_round, "value") else str(initial_round),
            current_turn=0,
            max_turns=req.max_turns,
            created_at=active.created_at,
            updated_at=active.created_at,
        )
        state_rec = StateRecord(
            session_id=session_id,
            current_turn=0,
            current_phase="INTRO",
            state_json=runner.state.model_dump_json(),
            updated_at=active.created_at,
        )

        if hasattr(self.repository, "save_session_sync"):
            self.repository.save_session_sync(session_rec)
            self.repository.save_state_sync(state_rec)

        self.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=0,
                event_type="session_created",
                reason=f"Created new interview session {session_id} in {req.mode} mode with {req.max_turns} turns limit.",
                metadata={"mode": req.mode, "role": req.role, "max_turns": req.max_turns},
            )
        )
        return active

    def get_session(self, session_id: str) -> Optional[ActiveSession]:
        # 1. Check in-memory store
        if session_id in self._sessions:
            return self._sessions[session_id]

        # 2. Reconstruct / hydrate from persistent storage
        if not hasattr(self.repository, "get_session_sync"):
            return None

        session_rec = self.repository.get_session_sync(session_id)
        state_rec = self.repository.get_state_sync(session_id)
        if not session_rec or not state_rec:
            self.tracer.record(
                TraceEvent(
                    session_id=session_id,
                    turn=0,
                    event_type="session_recovery_failed",
                    reason=f"Session {session_id} could not be found in storage for recovery.",
                )
            )
            return None

        # Deserialized state is authoritative
        restored_state = InterviewState.model_validate_json(state_rec.state_json)
        graph = self._get_or_load_graph()

        round_val = restored_state.round
        round_type = RoundType(round_val) if isinstance(round_val, str) else round_val

        flow_config = InterviewFlowConfig(
            round_sequence=[round_type],
            max_total_questions=session_rec.max_turns,
        )

        runner = InterviewSession(
            session_id=session_id,
            round_type=round_type,
            question_graph=graph,
            topic=restored_state.current_topic or session_rec.role or "Database Internals",
            max_turns=session_rec.max_turns,
            flow_config=flow_config,
            tracer=self.tracer,
        )
        runner.state = restored_state
        runner.orchestrator = InterviewOrchestrator(runner.state, tracer=self.tracer)

        # Restore current question reference
        if restored_state.current_question_id:
            runner._current_question = graph.get_question(restored_state.current_question_id)

        # Restore historic turn results from turns table
        if hasattr(self.repository, "get_turns_sync"):
            past_turns = self.repository.get_turns_sync(session_id)
            for pt in past_turns:
                turn_q = graph.get_question(pt.question_id)
                turn_res = SessionTurnResult(
                    turn=pt.turn,
                    phase=InterviewPhase(restored_state.current_state),
                    verdict=None,
                    decision=Decision(action=DecisionAction(pt.decision_action), reason=pt.decision_reason) if pt.decision_action != "unknown" else None,
                    next_question=turn_q,
                    is_complete=session_rec.status == "completed",
                    state=restored_state,
                )
                runner.turn_results.append(turn_res)

        active = ActiveSession(
            session_id=session_id,
            runner=runner,
            tracer=self.tracer,
            repository=self.repository,
        )
        active.created_at = session_rec.created_at

        # Check if report was persisted
        if hasattr(self.repository, "get_report_sync"):
            rep_rec = self.repository.get_report_sync(session_id)
            if rep_rec:
                active.cached_report = FinalInterviewReport.model_validate_json(rep_rec.report_json)

        self._sessions[session_id] = active

        self.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=restored_state.current_turn,
                event_type="session_restored",
                reason=f"Restored interview session {session_id} from persistent storage at turn {restored_state.current_turn}.",
                metadata={
                    "current_turn": restored_state.current_turn,
                    "phase": str(restored_state.current_state),
                    "status": session_rec.status,
                },
            )
        )
        return active

    def remove_session(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False


# Global singleton instance for application runtime
global_session_store = SessionStore()
