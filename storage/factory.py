"""
Storage Repository Factory for Kramix V2.
Instantiates the appropriate repository backend based on configuration.
"""
from __future__ import annotations
import logging
from typing import Optional
from backend.app.config import get_settings
from storage.base import BaseInterviewRepository
from storage.sqlite import SqliteInterviewRepository
from storage.postgres import PostgresInterviewRepository

logger = logging.getLogger("kramix.storage.factory")

_global_repository: Optional[BaseInterviewRepository] = None


def create_repository(database_url: Optional[str] = None) -> BaseInterviewRepository:
    """
    Creates a new repository instance based on database URL.
    """
    url = database_url or get_settings().DATABASE_URL
    if url.startswith("postgres://") or url.startswith("postgresql://") or url.startswith("postgresql+"):
        logger.info("Instantiating PostgreSQL repository backend.")
        return PostgresInterviewRepository(url)
    else:
        logger.info(f"Instantiating SQLite repository backend for {url}.")
        return SqliteInterviewRepository(url)


def get_repository() -> BaseInterviewRepository:
    """
    Returns the global singleton repository instance.
    """
    global _global_repository
    if _global_repository is None:
        _global_repository = create_repository()
    return _global_repository


def set_repository(repo: BaseInterviewRepository) -> None:
    """
    Overrides the global repository (useful in tests).
    """
    global _global_repository
    _global_repository = repo
