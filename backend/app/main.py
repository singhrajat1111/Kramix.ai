"""
FastAPI application entrypoint for Kramix V2 Interview Intelligence Platform.
Mounts REST session endpoints, WebSocket live runtime, production CORS, and health/readiness probes.
"""
from __future__ import annotations
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import get_settings
from backend.app.schemas_api import APIErrorResponse
from backend.app.routes_session import router as session_router
from backend.app.routes_ws import router as ws_router
from storage.factory import get_repository
from observability.trace import global_tracer, TraceEvent

logger = logging.getLogger("kramix.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Production application lifespan manager.
    Initializes database storage on startup and terminates connections on shutdown.
    """
    settings = get_settings()
    repo = get_repository()
    try:
        await repo.initialize()
        is_healthy = await repo.check_health()
        global_tracer.record(
            TraceEvent(
                session_id="system",
                turn=0,
                event_type="database_connected",
                reason=f"Database storage initialized successfully in {settings.ENVIRONMENT} mode.",
                metadata={"healthy": is_healthy},
            )
        )
        logger.info(f"Storage repository initialized in {settings.ENVIRONMENT} mode.")
    except Exception as exc:
        global_tracer.record(
            TraceEvent(
                session_id="system",
                turn=0,
                event_type="database_error",
                reason="Failed to initialize database storage on application startup.",
            )
        )
        logger.error(f"Database initialization error on startup: {exc}")

    yield

    # Clean shutdown
    try:
        await repo.close()
        logger.info("Storage repository connections cleanly closed on application shutdown.")
    except Exception as exc:
        logger.error(f"Error closing storage repository on shutdown: {exc}")


settings = get_settings()

app = FastAPI(
    title="Kramix V2 Interview Intelligence Platform",
    description="Production REST & WebSocket runtime for authoritative backend interview orchestration.",
    version="2.0.0",
    lifespan=lifespan,
)

# Hardened CORS configuration from settings (wildcard prohibited with credentials in production)
cors_origins = settings.get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Global safe error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = str(uuid.uuid4())[:8]
    return JSONResponse(
        status_code=exc.status_code,
        content=APIErrorResponse(
            error_code=f"HTTP_{exc.status_code}",
            message=str(exc.detail),
            detail=str(exc.detail),
            request_id=request_id,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = str(uuid.uuid4())[:8]
    logger.error(f"Unhandled exception [req_id={request_id}]: {exc}", exc_info=True)
    # Never leak stack trace, SQL error, or secrets to the client
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=APIErrorResponse(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected internal error occurred. Please contact system support.",
            request_id=request_id,
        ).model_dump(),
    )


# Mount routes
app.include_router(session_router)
app.include_router(ws_router)


@app.get("/health", tags=["system"])
async def health_check():
    """Liveness probe: verifies application process is running."""
    return {
        "status": "ok",
        "service": "kramix-v2-backend",
        "version": "2.0.0",
    }


@app.get("/ready", tags=["system"])
async def readiness_check():
    """Readiness probe: verifies backing database connectivity without leaking credentials."""
    repo = get_repository()
    is_ready = await repo.check_health()
    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service dependencies unavailable.",
        )
    return {
        "status": "ready",
        "database": "connected",
    }
