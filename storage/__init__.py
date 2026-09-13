"""
Kramix V2 Persistent Storage and Repository Layer.
"""
from storage.models import (
    SessionRecord,
    TurnRecord,
    StateRecord,
    ReportRecord,
    IdempotencyRecord,
)
from storage.base import BaseInterviewRepository
from storage.sqlite import SqliteInterviewRepository
from storage.postgres import PostgresInterviewRepository
from storage.factory import create_repository, get_repository, set_repository
from storage.supabase import get_supabase_client, is_supabase_configured

__all__ = [
    "SessionRecord",
    "TurnRecord",
    "StateRecord",
    "ReportRecord",
    "IdempotencyRecord",
    "BaseInterviewRepository",
    "SqliteInterviewRepository",
    "PostgresInterviewRepository",
    "create_repository",
    "get_repository",
    "set_repository",
    "get_supabase_client",
    "is_supabase_configured",
]
