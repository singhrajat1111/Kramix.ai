"""
Abstract base repository interface for Kramix V2 persistent storage.
Decouples interview engines and FastAPI routes from specific database technologies.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional, List
from storage.models import (
    SessionRecord,
    TurnRecord,
    StateRecord,
    ReportRecord,
    IdempotencyRecord,
)


class BaseInterviewRepository(ABC):
    """
    Contract for interview session, turn, state, and report persistence.
    """

    @abstractmethod
    async def initialize(self) -> None:
        """Initializes database connections, schemas, or pools."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Closes all active database connections cleanly."""
        pass

    @abstractmethod
    async def check_health(self) -> bool:
        """Verifies database connectivity and readiness."""
        pass

    @abstractmethod
    async def save_session(self, session: SessionRecord) -> None:
        """Inserts or updates a session header record."""
        pass

    @abstractmethod
    async def get_session(self, session_id: str) -> Optional[SessionRecord]:
        """Retrieves a session record by ID."""
        pass

    @abstractmethod
    async def update_session_status(
        self,
        session_id: str,
        status: str,
        current_phase: str,
        current_round: str,
        current_turn: int,
        completed_at: Optional[float] = None,
    ) -> None:
        """Updates session lifecycle progress."""
        pass

    @abstractmethod
    async def save_turn(self, turn: TurnRecord) -> None:
        """Persists a completed interview turn."""
        pass

    @abstractmethod
    async def get_turns(self, session_id: str) -> List[TurnRecord]:
        """Retrieves all historical turn records for a session in order."""
        pass

    @abstractmethod
    async def save_state(self, state: StateRecord) -> None:
        """Persists or updates the serialized InterviewState snapshot."""
        pass

    @abstractmethod
    async def get_state(self, session_id: str) -> Optional[StateRecord]:
        """Retrieves the latest serialized InterviewState snapshot for a session."""
        pass

    @abstractmethod
    async def save_report(self, report: ReportRecord) -> None:
        """Persists the FinalInterviewReport after session completion."""
        pass

    @abstractmethod
    async def get_report(self, session_id: str) -> Optional[ReportRecord]:
        """Retrieves the persisted FinalInterviewReport if available."""
        pass

    @abstractmethod
    async def check_and_set_idempotency_key(
        self,
        key: str,
        session_id: str,
        turn: int,
    ) -> bool:
        """
        Checks if idempotency key exists.
        Returns True if newly recorded (safe to proceed), False if duplicate (should return cached).
        """
        pass

    @abstractmethod
    async def record_turn_atomic(
        self,
        session_id: str,
        turn_record: TurnRecord,
        state_record: StateRecord,
        idempotency_key: Optional[str] = None,
    ) -> None:
        """
        Atomically persists turn record, updates interview state, and logs idempotency key.
        Rolls back all changes if any operation fails.
        """
        pass
