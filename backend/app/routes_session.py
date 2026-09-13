"""
REST API routes for session lifecycle and final report access.
Delegates to SessionStore and ReportEngine without inlining business logic.
Implements report caching, persistent retrieval, and candidate-safe privacy views.
"""
from __future__ import annotations
import time
from fastapi import APIRouter, HTTPException, status
from backend.app.schemas_api import (
    CreateSessionRequest,
    CreateSessionResponse,
    SessionStateResponse,
    CandidateSafeReport,
)
from backend.app.session_store import global_session_store
from schemas.report import FinalInterviewReport

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=CreateSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(req: CreateSessionRequest) -> CreateSessionResponse:
    """
    Creates an authoritative interview session and returns WebSocket connection details.
    """
    try:
        active = global_session_store.create_session(req)
        return CreateSessionResponse(
            session_id=active.session_id,
            mode=req.mode,
            role=req.role,
            status="initialized",
            ws_url=f"/ws/interview/{active.session_id}",
            max_turns=req.max_turns,
            created_at=active.created_at,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create interview session: {str(exc)}",
        )


@router.get("/{session_id}", response_model=SessionStateResponse)
async def get_session(session_id: str) -> SessionStateResponse:
    """
    Returns a presentation-safe snapshot of active session status.
    Hydrates from persistent storage if session is not currently in memory.
    """
    active = global_session_store.get_session(session_id)
    if not active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found.",
        )
    return active.to_safe_state_response()


@router.get("/{session_id}/report", response_model=FinalInterviewReport)
async def get_session_report(session_id: str) -> FinalInterviewReport:
    """
    Returns the comprehensive FinalInterviewReport synthesized by ReportEngine.
    Retrieves persisted report if available; only allowed after interview completion.
    """
    active = global_session_store.get_session(session_id)
    if not active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found.",
        )

    # 1. Check in-memory cached report
    if active.cached_report:
        return active.cached_report

    # 2. Check persisted report in repository
    if hasattr(active.repository, "get_report_sync"):
        persisted = active.repository.get_report_sync(session_id)
        if persisted:
            active.cached_report = FinalInterviewReport.model_validate_json(persisted.report_json)
            return active.cached_report

    # 3. Check if interview is completed
    if not active.runner.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Final report is only available after interview completion.",
        )

    # 4. Generate report, persist, and return
    duration = time.time() - active.created_at
    report = active.runner.generate_report(duration_seconds=duration)
    active.persist_report(report)
    return report


@router.get("/{session_id}/candidate-report", response_model=CandidateSafeReport)
async def get_candidate_safe_report(session_id: str) -> CandidateSafeReport:
    """
    Privacy Boundary View: Returns public candidate projection hiding internal hiring committee deliberations.
    """
    full_report = await get_session_report(session_id)

    # Distinguish candidate-safe summary from internal evaluation
    return CandidateSafeReport(
        session_id=full_report.session_info.session_id,
        role=full_report.session_info.role,
        duration_seconds=full_report.session_info.duration_seconds,
        overall_score=full_report.performance_metrics.overall_score,
        feedback_summary=full_report.executive_summary,
        key_strengths=full_report.key_strengths,
        growth_areas=full_report.key_weaknesses,
    )
