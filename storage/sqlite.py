"""
SQLite implementation of BaseInterviewRepository for Kramix V2.
Provides complete relational persistence, atomic transactions, foreign keys,
and unique constraints for local development and deterministic zero-dependency tests.
"""
from __future__ import annotations
import asyncio
import logging
import sqlite3
import time
from typing import Optional, List
from storage.base import BaseInterviewRepository
from storage.models import (
    SessionRecord,
    TurnRecord,
    StateRecord,
    ReportRecord,
    IdempotencyRecord,
)

logger = logging.getLogger("kramix.storage.sqlite")


class SqliteInterviewRepository(BaseInterviewRepository):
    """
    SQLite-backed repository with thread-safe connection locking,
    foreign key enforcement, and atomic transaction boundaries.
    """

    def __init__(self, db_path: str = ":memory:"):
        # Strip sqlite:/// prefix if present
        if db_path.startswith("sqlite:///"):
            self.db_path = db_path.replace("sqlite:///", "")
        elif db_path.startswith("sqlite://"):
            self.db_path = db_path.replace("sqlite://", "")
        else:
            self.db_path = db_path

        self._conn: Optional[sqlite3.Connection] = None
        self._lock = asyncio.Lock()

    def initialize_sync(self) -> None:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA foreign_keys = ON;")
            if self.db_path != ":memory:":
                self._conn.execute("PRAGMA journal_mode = WAL;")
            self._create_tables()

    async def initialize(self) -> None:
        async with self._lock:
            self.initialize_sync()

    def _create_tables(self) -> None:
        cur = self._conn.cursor()
        cur.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            mode TEXT NOT NULL DEFAULT 'demo',
            role TEXT,
            status TEXT NOT NULL DEFAULT 'initialized',
            current_phase TEXT NOT NULL DEFAULT 'INTRO',
            current_round TEXT NOT NULL DEFAULT 'technical',
            current_turn INTEGER NOT NULL DEFAULT 0,
            max_turns INTEGER NOT NULL DEFAULT 6,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            completed_at REAL,
            version INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS turns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
            turn INTEGER NOT NULL,
            round TEXT NOT NULL,
            question_id TEXT NOT NULL,
            question_text TEXT NOT NULL,
            answer_text TEXT NOT NULL,
            input_mode TEXT NOT NULL DEFAULT 'text',
            stt_confidence REAL,
            audio_duration_seconds REAL,
            decision_action TEXT NOT NULL,
            decision_reason TEXT NOT NULL,
            correctness REAL NOT NULL,
            verdict_json TEXT NOT NULL,
            created_at REAL NOT NULL,
            CONSTRAINT uq_session_turn UNIQUE (session_id, turn)
        );

        CREATE TABLE IF NOT EXISTS interview_states (
            session_id TEXT PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
            current_turn INTEGER NOT NULL DEFAULT 0,
            current_phase TEXT NOT NULL DEFAULT 'INTRO',
            state_json TEXT NOT NULL,
            updated_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reports (
            session_id TEXT PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
            report_json TEXT NOT NULL,
            candidate_summary TEXT NOT NULL,
            hiring_decision TEXT NOT NULL,
            overall_score REAL NOT NULL,
            created_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
            turn INTEGER NOT NULL,
            created_at REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_turns_session_id ON turns(session_id);
        CREATE INDEX IF NOT EXISTS idx_idempotency_session ON idempotency_keys(session_id);
        """)
        self._conn.commit()

    async def close(self) -> None:
        async with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None

    async def check_health(self) -> bool:
        if self._conn is None:
            return False
        try:
            async with self._lock:
                cur = self._conn.cursor()
                cur.execute("SELECT 1;")
                return cur.fetchone()[0] == 1
        except Exception as err:
            logger.error(f"Health check failed for SQLite: {err}")
            return False

    def save_session_sync(self, session: SessionRecord) -> None:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("""
        INSERT INTO sessions (
            session_id, mode, role, status, current_phase, current_round,
            current_turn, max_turns, created_at, updated_at, completed_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            status = excluded.status,
            current_phase = excluded.current_phase,
            current_round = excluded.current_round,
            current_turn = excluded.current_turn,
            updated_at = excluded.updated_at,
            completed_at = excluded.completed_at,
            version = sessions.version + 1;
        """, (
            session.session_id, session.mode, session.role, session.status,
            session.current_phase, session.current_round, session.current_turn,
            session.max_turns, session.created_at, session.updated_at,
            session.completed_at, session.version
        ))
        self._conn.commit()

    async def save_session(self, session: SessionRecord) -> None:
        async with self._lock:
            self.save_session_sync(session)

    def get_session_sync(self, session_id: str) -> Optional[SessionRecord]:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM sessions WHERE session_id = ?;", (session_id,))
        row = cur.fetchone()
        if not row:
            return None
        return SessionRecord(
            session_id=row["session_id"],
            mode=row["mode"],
            role=row["role"],
            status=row["status"],
            current_phase=row["current_phase"],
            current_round=row["current_round"],
            current_turn=row["current_turn"],
            max_turns=row["max_turns"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            completed_at=row["completed_at"],
            version=row["version"],
        )

    async def get_session(self, session_id: str) -> Optional[SessionRecord]:
        async with self._lock:
            return self.get_session_sync(session_id)

    def update_session_status_sync(
        self,
        session_id: str,
        status: str,
        current_phase: str,
        current_round: str,
        current_turn: int,
        completed_at: Optional[float] = None,
    ) -> None:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("""
        UPDATE sessions SET
            status = ?,
            current_phase = ?,
            current_round = ?,
            current_turn = ?,
            updated_at = ?,
            completed_at = COALESCE(?, completed_at),
            version = version + 1
        WHERE session_id = ?;
        """, (
            status, current_phase, current_round, current_turn,
            time.time(), completed_at, session_id
        ))
        self._conn.commit()

    async def update_session_status(
        self,
        session_id: str,
        status: str,
        current_phase: str,
        current_round: str,
        current_turn: int,
        completed_at: Optional[float] = None,
    ) -> None:
        async with self._lock:
            self.update_session_status_sync(
                session_id, status, current_phase, current_round, current_turn, completed_at
            )

    def save_turn_sync(self, turn: TurnRecord) -> None:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("""
        INSERT INTO turns (
            session_id, turn, round, question_id, question_text,
            answer_text, input_mode, stt_confidence, audio_duration_seconds,
            decision_action, decision_reason, correctness, verdict_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id, turn) DO UPDATE SET
            answer_text = excluded.answer_text,
            decision_action = excluded.decision_action,
            decision_reason = excluded.decision_reason,
            correctness = excluded.correctness,
            verdict_json = excluded.verdict_json;
        """, (
            turn.session_id, turn.turn, turn.round, turn.question_id,
            turn.question_text, turn.answer_text, turn.input_mode,
            turn.stt_confidence, turn.audio_duration_seconds,
            turn.decision_action, turn.decision_reason, turn.correctness,
            turn.verdict_json, turn.created_at
        ))
        self._conn.commit()

    async def save_turn(self, turn: TurnRecord) -> None:
        async with self._lock:
            self.save_turn_sync(turn)

    def get_turns_sync(self, session_id: str) -> List[TurnRecord]:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM turns WHERE session_id = ? ORDER BY turn ASC;", (session_id,))
        rows = cur.fetchall()
        return [
            TurnRecord(
                session_id=r["session_id"],
                turn=r["turn"],
                round=r["round"],
                question_id=r["question_id"],
                question_text=r["question_text"],
                answer_text=r["answer_text"],
                input_mode=r["input_mode"],
                stt_confidence=r["stt_confidence"],
                audio_duration_seconds=r["audio_duration_seconds"],
                decision_action=r["decision_action"],
                decision_reason=r["decision_reason"],
                correctness=r["correctness"],
                verdict_json=r["verdict_json"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    async def get_turns(self, session_id: str) -> List[TurnRecord]:
        async with self._lock:
            return self.get_turns_sync(session_id)

    def save_state_sync(self, state: StateRecord) -> None:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("""
        INSERT INTO interview_states (session_id, current_turn, current_phase, state_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            current_turn = excluded.current_turn,
            current_phase = excluded.current_phase,
            state_json = excluded.state_json,
            updated_at = excluded.updated_at;
        """, (state.session_id, state.current_turn, state.current_phase, state.state_json, state.updated_at))
        self._conn.commit()

    async def save_state(self, state: StateRecord) -> None:
        async with self._lock:
            self.save_state_sync(state)

    def get_state_sync(self, session_id: str) -> Optional[StateRecord]:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM interview_states WHERE session_id = ?;", (session_id,))
        row = cur.fetchone()
        if not row:
            return None
        return StateRecord(
            session_id=row["session_id"],
            current_turn=row["current_turn"],
            current_phase=row["current_phase"],
            state_json=row["state_json"],
            updated_at=row["updated_at"],
        )

    async def get_state(self, session_id: str) -> Optional[StateRecord]:
        async with self._lock:
            return self.get_state_sync(session_id)

    def save_report_sync(self, report: ReportRecord) -> None:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("""
        INSERT INTO reports (session_id, report_json, candidate_summary, hiring_decision, overall_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            report_json = excluded.report_json,
            candidate_summary = excluded.candidate_summary,
            hiring_decision = excluded.hiring_decision,
            overall_score = excluded.overall_score,
            created_at = excluded.created_at;
        """, (
            report.session_id, report.report_json, report.candidate_summary,
            report.hiring_decision, report.overall_score, report.created_at
        ))
        self._conn.commit()

    async def save_report(self, report: ReportRecord) -> None:
        async with self._lock:
            self.save_report_sync(report)

    def get_report_sync(self, session_id: str) -> Optional[ReportRecord]:
        self.initialize_sync()
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM reports WHERE session_id = ?;", (session_id,))
        row = cur.fetchone()
        if not row:
            return None
        return ReportRecord(
            session_id=row["session_id"],
            report_json=row["report_json"],
            candidate_summary=row["candidate_summary"],
            hiring_decision=row["hiring_decision"],
            overall_score=row["overall_score"],
            created_at=row["created_at"],
        )

    async def get_report(self, session_id: str) -> Optional[ReportRecord]:
        async with self._lock:
            return self.get_report_sync(session_id)

    def check_and_set_idempotency_key_sync(
        self,
        key: str,
        session_id: str,
        turn: int,
    ) -> bool:
        self.initialize_sync()
        try:
            cur = self._conn.cursor()
            cur.execute("""
            INSERT INTO idempotency_keys (key, session_id, turn, created_at)
            VALUES (?, ?, ?, ?);
            """, (key, session_id, turn, time.time()))
            self._conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    async def check_and_set_idempotency_key(
        self,
        key: str,
        session_id: str,
        turn: int,
    ) -> bool:
        async with self._lock:
            return self.check_and_set_idempotency_key_sync(key, session_id, turn)

    def record_turn_atomic_sync(
        self,
        session_id: str,
        turn_record: TurnRecord,
        state_record: StateRecord,
        idempotency_key: Optional[str] = None,
    ) -> None:
        self.initialize_sync()
        cur = self._conn.cursor()
        try:
            # 1. Insert turn record
            cur.execute("""
            INSERT INTO turns (
                session_id, turn, round, question_id, question_text,
                answer_text, input_mode, stt_confidence, audio_duration_seconds,
                decision_action, decision_reason, correctness, verdict_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id, turn) DO UPDATE SET
                answer_text = excluded.answer_text,
                decision_action = excluded.decision_action,
                decision_reason = excluded.decision_reason,
                correctness = excluded.correctness,
                verdict_json = excluded.verdict_json;
            """, (
                turn_record.session_id, turn_record.turn, turn_record.round,
                turn_record.question_id, turn_record.question_text,
                turn_record.answer_text, turn_record.input_mode,
                turn_record.stt_confidence, turn_record.audio_duration_seconds,
                turn_record.decision_action, turn_record.decision_reason,
                turn_record.correctness, turn_record.verdict_json, turn_record.created_at
            ))

            # 2. Update state record
            cur.execute("""
            INSERT INTO interview_states (session_id, current_turn, current_phase, state_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                current_turn = excluded.current_turn,
                current_phase = excluded.current_phase,
                state_json = excluded.state_json,
                updated_at = excluded.updated_at;
            """, (
                state_record.session_id, state_record.current_turn,
                state_record.current_phase, state_record.state_json, state_record.updated_at
            ))

            # 3. Update session turn & phase
            cur.execute("""
            UPDATE sessions SET
                current_turn = ?,
                current_phase = ?,
                current_round = ?,
                updated_at = ?,
                version = version + 1
            WHERE session_id = ?;
            """, (
                state_record.current_turn, state_record.current_phase,
                turn_record.round, time.time(), session_id
            ))

            # 4. Record idempotency key if provided
            if idempotency_key:
                cur.execute("""
                INSERT INTO idempotency_keys (key, session_id, turn, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(key) DO NOTHING;
                """, (idempotency_key, session_id, turn_record.turn, time.time()))

            self._conn.commit()
        except Exception as exc:
            self._conn.rollback()
            logger.error(f"Atomic turn transaction rolled back for session {session_id}: {exc}")
            raise

    async def record_turn_atomic(
        self,
        session_id: str,
        turn_record: TurnRecord,
        state_record: StateRecord,
        idempotency_key: Optional[str] = None,
    ) -> None:
        async with self._lock:
            self.record_turn_atomic_sync(session_id, turn_record, state_record, idempotency_key)
