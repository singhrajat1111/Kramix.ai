"""
WebSocket Interview Runtime Route.
Handles live bidirectional communication between candidate UI and InterviewSession.

CRITICAL INVARIANTS:
1. InterviewSession remains the single authority.
2. Per-session lock prevents concurrent/duplicate answer evaluation.
3. Client reconnects recover state without advancing turn or resetting the session.
4. Presentation-safe projections: never expose expected concepts, prompt injection flags, or internal actions.
5. Exact 6-question demo invariant is strictly preserved.
"""
from __future__ import annotations
import json
import logging
import re
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError

from backend.app.schemas_api import (
    ClientWSMessage,
    ServerWSMessage,
    ClientMessageType,
    ServerMessageType,
    ClientQuestion,
    ClientTurnResult,
)
from backend.app.session_store import global_session_store, ActiveSession
from schemas.interview_state import InterviewPhase
from observability.trace import TraceEvent

logger = logging.getLogger("kramix.ws")
router = APIRouter(tags=["websocket"])

SESSION_ID_REGEX = re.compile(r"^sess_[a-zA-Z0-9_-]{6,64}$")


@router.websocket("/ws/interview/{session_id}")
async def websocket_interview_endpoint(websocket: WebSocket, session_id: str):
    """
    Live interview runtime channel.
    Coordinates question delivery, answer submission, processing states, and completion.
    """
    await websocket.accept()

    active: Optional[ActiveSession] = global_session_store.get_session(session_id)
    if not active:
        err_msg = ServerWSMessage(
            type=ServerMessageType.ERROR,
            session_id=session_id,
            payload={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' does not exist."},
        )
        await websocket.send_text(err_msg.model_dump_json())
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Validate session_id format
    if not SESSION_ID_REGEX.match(session_id):
        err_msg = ServerWSMessage(
            type=ServerMessageType.ERROR,
            session_id=session_id,
            payload={"code": "INVALID_SESSION_ID", "message": "Invalid session ID format."},
        )
        await websocket.send_text(err_msg.model_dump_json())
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    phase_str = getattr(active.runner.current_phase, "value", str(active.runner.current_phase))
    active.tracer.record(
        TraceEvent(
            session_id=session_id,
            turn=active.runner.state.current_turn,
            event_type="websocket_connected",
            reason=f"Client connected via WebSocket to session {session_id}.",
            metadata={"phase": phase_str},
        )
    )

    # 1. Send SESSION_READY on connect with current state & question (supports seamless reconnection)
    current_q = active.get_safe_current_question()
    ready_payload = {
        "session_id": session_id,
        "mode": active.runner.state.mode,
        "current_turn": active.runner.state.current_turn,
        "phase": phase_str,
        "round": str(active.runner.state.round),
        "is_complete": active.runner.is_complete,
        "current_question": current_q.model_dump() if current_q else None,
    }
    await websocket.send_text(
        ServerWSMessage(
            type=ServerMessageType.SESSION_READY,
            session_id=session_id,
            turn=active.runner.state.current_turn,
            payload=ready_payload,
        ).model_dump_json()
    )

    try:
        while True:
            raw_text = await websocket.receive_text()

            # 2. Parse & validate client message
            try:
                raw_json = json.loads(raw_text)
                msg = ClientWSMessage.model_validate(raw_json)
            except (json.JSONDecodeError, ValidationError) as val_err:
                err_reply = ServerWSMessage(
                    type=ServerMessageType.ERROR,
                    session_id=session_id,
                    turn=active.runner.state.current_turn,
                    payload={"code": "INVALID_MESSAGE", "message": str(val_err)},
                )
                await websocket.send_text(err_reply.model_dump_json())
                continue

            # 3. Handle message types
            if msg.type == ClientMessageType.HEARTBEAT:
                # No-op ping/pong
                continue

            elif msg.type == ClientMessageType.SESSION_START:
                # Begin interview if in INTRO phase
                async with active.lock:
                    if active.runner.current_phase == InterviewPhase.INTRO:
                        initial_q = active.runner.start()
                        safe_q = ClientQuestion(
                            question_id=initial_q.id,
                            question_text=initial_q.question_text,
                            turn=active.runner.state.current_turn,
                            round=str(active.runner.state.round),
                            topic=initial_q.topic,
                            difficulty=str(initial_q.difficulty.value) if hasattr(initial_q.difficulty, "value") else str(initial_q.difficulty),
                        )
                        await websocket.send_text(
                            ServerWSMessage(
                                type=ServerMessageType.QUESTION,
                                session_id=session_id,
                                turn=active.runner.state.current_turn,
                                payload=safe_q.model_dump(),
                            ).model_dump_json()
                        )
                    else:
                        # Already started: re-send current question (reconnection / duplicate start guard)
                        safe_q = active.get_safe_current_question()
                        if safe_q:
                            await websocket.send_text(
                                ServerWSMessage(
                                    type=ServerMessageType.QUESTION,
                                    session_id=session_id,
                                    turn=active.runner.state.current_turn,
                                    payload=safe_q.model_dump(),
                                ).model_dump_json()
                            )

            elif msg.type == ClientMessageType.ANSWER_SUBMIT:
                answer_content = (msg.answer or "").strip()
                if not answer_content:
                    err_reply = ServerWSMessage(
                        type=ServerMessageType.ERROR,
                        session_id=session_id,
                        turn=active.runner.state.current_turn,
                        payload={"code": "EMPTY_ANSWER", "message": "Candidate answer cannot be empty."},
                    )
                    await websocket.send_text(err_reply.model_dump_json())
                    continue

                # Acquire per-session lock to prevent double-processing or turn racing
                async with active.lock:
                    if active.runner.is_complete:
                        err_reply = ServerWSMessage(
                            type=ServerMessageType.ERROR,
                            session_id=session_id,
                            turn=active.runner.state.current_turn,
                            payload={"code": "INTERVIEW_ALREADY_COMPLETED", "message": "Cannot submit answer; interview has concluded."},
                        )
                        await websocket.send_text(err_reply.model_dump_json())
                        continue

                    if msg.turn is not None and msg.turn != active.runner.state.current_turn:
                        err_reply = ServerWSMessage(
                            type=ServerMessageType.ERROR,
                            session_id=session_id,
                            turn=active.runner.state.current_turn,
                            payload={
                                "code": "STALE_OR_DUPLICATE_TURN",
                                "message": f"Submitted answer for turn {msg.turn}, but current active turn is {active.runner.state.current_turn}.",
                            },
                        )
                        await websocket.send_text(err_reply.model_dump_json())
                        continue

                    if active.runner.current_phase != InterviewPhase.LISTENING:
                        # Ignore rapid duplicate submission while processing or transitioning
                        err_reply = ServerWSMessage(
                            type=ServerMessageType.ERROR,
                            session_id=session_id,
                            turn=active.runner.state.current_turn,
                            payload={"code": "BUSY_PROCESSING", "message": "Session is currently processing a turn."},
                        )
                        await websocket.send_text(err_reply.model_dump_json())
                        continue

                    # Check turn idempotency if client provides idempotency_key
                    if msg.idempotency_key and hasattr(active.repository, "check_and_set_idempotency_key_sync"):
                        is_new = active.repository.check_and_set_idempotency_key_sync(
                            msg.idempotency_key, session_id, active.runner.state.current_turn
                        )
                        if not is_new:
                            active.tracer.record(
                                TraceEvent(
                                    session_id=session_id,
                                    turn=active.runner.state.current_turn,
                                    event_type="idempotent_hit",
                                    reason=f"Duplicate idempotency key '{msg.idempotency_key}' detected on turn {active.runner.state.current_turn}; suppressing duplicate evaluation.",
                                )
                            )
                            # Re-send current question without advancing turn counter
                            safe_q = active.get_safe_current_question()
                            if safe_q:
                                await websocket.send_text(
                                    ServerWSMessage(
                                        type=ServerMessageType.QUESTION,
                                        session_id=session_id,
                                        turn=active.runner.state.current_turn,
                                        payload=safe_q.model_dump(),
                                    ).model_dump_json()
                                )
                            continue

                    # If voice input mode has explicitly low confidence, notify candidate to retry or type
                    if msg.input_mode == "voice" and msg.stt_confidence is not None and msg.stt_confidence < 0.40:
                        active.tracer.record(
                            TraceEvent(
                                session_id=session_id,
                                turn=active.runner.state.current_turn,
                                event_type="voice_fallback",
                                reason=f"Low voice transcription confidence ({msg.stt_confidence:.2f}); prompting candidate to retry.",
                                metadata={"confidence": msg.stt_confidence},
                            )
                        )
                        err_reply = ServerWSMessage(
                            type=ServerMessageType.ERROR,
                            session_id=session_id,
                            turn=active.runner.state.current_turn,
                            payload={
                                "code": "LOW_STT_CONFIDENCE",
                                "message": "Voice audio was unclear. Please speak again or type your answer.",
                            },
                        )
                        await websocket.send_text(err_reply.model_dump_json())
                        continue

                    # Acknowledge candidate answer with PROCESSING event
                    await websocket.send_text(
                        ServerWSMessage(
                            type=ServerMessageType.PROCESSING,
                            session_id=session_id,
                            turn=active.runner.state.current_turn,
                            payload={"status": "evaluating_answer"},
                        ).model_dump_json()
                    )

                    trace_meta = {
                        "length": len(answer_content),
                        "input_mode": msg.input_mode,
                    }
                    if msg.stt_confidence is not None:
                        trace_meta["stt_confidence"] = msg.stt_confidence
                    if msg.audio_duration_seconds is not None:
                        trace_meta["audio_duration_seconds"] = msg.audio_duration_seconds

                    active.tracer.record(
                        TraceEvent(
                            session_id=session_id,
                            turn=active.runner.state.current_turn,
                            event_type="answer_received",
                            reason=f"Received candidate answer on turn {active.runner.state.current_turn} via {msg.input_mode}.",
                            metadata=trace_meta,
                        )
                    )

                    # Execute authoritative turn evaluation in InterviewSession
                    prior_round = str(active.runner.state.round)
                    turn_res = active.runner.submit_answer(answer_content)

                    # Atomically persist turn result and updated state to database
                    active.persist_turn(
                        turn_res=turn_res,
                        answer_text=answer_content,
                        input_mode=msg.input_mode,
                        stt_confidence=msg.stt_confidence,
                        audio_duration_seconds=msg.audio_duration_seconds,
                        idempotency_key=msg.idempotency_key,
                    )

                    # Send safe turn acknowledgment
                    phase_str = getattr(turn_res.phase, "value", str(turn_res.phase))
                    await websocket.send_text(
                        ServerWSMessage(
                            type=ServerMessageType.TURN_RESULT,
                            session_id=session_id,
                            turn=turn_res.turn,
                            payload=ClientTurnResult(
                                turn=turn_res.turn,
                                phase=phase_str,
                                status="processed",
                                round=str(active.runner.state.round),
                            ).model_dump(),
                        ).model_dump_json()
                    )

                    active.tracer.record(
                        TraceEvent(
                            session_id=session_id,
                            turn=turn_res.turn,
                            event_type="turn_completed",
                            reason=f"Turn {turn_res.turn} processing concluded; phase is {phase_str}.",
                            metadata={"is_complete": turn_res.is_complete},
                        )
                    )

                    # Check for round transition event
                    new_round = str(active.runner.state.round)
                    if prior_round != new_round:
                        await websocket.send_text(
                            ServerWSMessage(
                                type=ServerMessageType.ROUND_TRANSITION,
                                session_id=session_id,
                                turn=active.runner.state.current_turn,
                                payload={
                                    "previous_round": prior_round,
                                    "new_round": new_round,
                                    "message": f"Progressed from {prior_round} to {new_round} round.",
                                },
                            ).model_dump_json()
                        )

                    # Check completion status
                    if turn_res.is_complete or active.runner.is_complete:
                        # Automatically pre-synthesize final report and persist to storage
                        if not active.cached_report:
                            active.cached_report = active.runner.generate_report()
                        active.persist_report(active.cached_report)

                        await websocket.send_text(
                            ServerWSMessage(
                                type=ServerMessageType.INTERVIEW_COMPLETE,
                                session_id=session_id,
                                turn=active.runner.state.current_turn,
                                payload={
                                    "completion_status": "completed",
                                    "total_questions": len(active.runner.state.question_history),
                                    "report_available": True,
                                    "report_url": f"/api/sessions/{session_id}/report",
                                },
                            ).model_dump_json()
                        )

                        active.tracer.record(
                            TraceEvent(
                                session_id=session_id,
                                turn=active.runner.state.current_turn,
                                event_type="session_completed",
                                reason=f"Interview session {session_id} completed successfully after {active.runner.state.current_turn} turns.",
                                metadata={"questions_asked": len(active.runner.state.question_history)},
                            )
                        )

                    elif turn_res.next_question:
                        # Deliver next question safely
                        next_q = turn_res.next_question
                        safe_next = ClientQuestion(
                            question_id=next_q.id,
                            question_text=next_q.question_text,
                            turn=active.runner.state.current_turn,
                            round=str(active.runner.state.round),
                            topic=next_q.topic,
                            difficulty=str(next_q.difficulty.value) if hasattr(next_q.difficulty, "value") else str(next_q.difficulty),
                        )
                        await websocket.send_text(
                            ServerWSMessage(
                                type=ServerMessageType.QUESTION,
                                session_id=session_id,
                                turn=active.runner.state.current_turn,
                                payload=safe_next.model_dump(),
                            ).model_dump_json()
                        )

            elif msg.type == ClientMessageType.SESSION_END:
                # Early termination requested
                async with active.lock:
                    if not active.runner.is_complete:
                        if not active.cached_report:
                            active.cached_report = active.runner.generate_report()

                    await websocket.send_text(
                        ServerWSMessage(
                            type=ServerMessageType.INTERVIEW_COMPLETE,
                            session_id=session_id,
                            turn=active.runner.state.current_turn,
                            payload={
                                "completion_status": "terminated_early",
                                "total_questions": len(active.runner.state.question_history),
                                "report_available": True,
                                "report_url": f"/api/sessions/{session_id}/report",
                            },
                        ).model_dump_json()
                    )
                break

    except WebSocketDisconnect:
        active.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=active.runner.state.current_turn,
                event_type="websocket_disconnected",
                reason=f"WebSocket disconnected for session {session_id}.",
                metadata={"turn": active.runner.state.current_turn},
            )
        )
    except Exception as exc:
        logger.error(f"WebSocket runtime error on session {session_id}: {exc}", exc_info=True)
        active.tracer.record(
            TraceEvent(
                session_id=session_id,
                turn=active.runner.state.current_turn,
                event_type="api_error",
                reason=f"WebSocket encounter unexpected error: {str(exc)}",
                metadata={"error": str(exc)},
            )
        )
