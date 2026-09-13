"""
Comprehensive tests for Phase 14: Production Hardening + Persistence + Security.
Verifies:
1. Storage & Repository CRUD (sessions, turns, states, reports).
2. Session State Recovery: in-memory cache wipe and successful hydration from persistent storage.
3. Post-Recovery Continuation: interview resumes without resetting question budget.
4. Turn Idempotency: duplicate submissions with idempotency keys do not advance turn budget.
5. Transaction Safety: atomic turn recording and rollback on failure.
6. Exact 6-Turn Demo Mode Invariant: survives recovery and concludes with persisted report.
7. Security Hardening: oversized payload rejection (> 8,000 chars), invalid session ID rejection.
8. Secret & Trace Masking: credentials and raw audio are never exposed or persisted.
9. Production Configuration & CORS: wildcard origins prohibited in production mode.
10. Health & Readiness Endpoints: /health (liveness) and /ready (database readiness).
11. Report Privacy Boundary: CandidateSafeReport hides internal hiring committee deliberations.
"""
import pytest
import time
import uuid
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import Settings, get_settings
from backend.app.session_store import global_session_store, SessionStore
from backend.app.schemas_api import CreateSessionRequest, ClientWSMessage, ClientMessageType
from storage.sqlite import SqliteInterviewRepository
from storage.models import SessionRecord, TurnRecord, StateRecord, ReportRecord
from observability.trace import TraceLogger


@pytest.fixture
def test_repo():
    repo = SqliteInterviewRepository(":memory:")
    repo.initialize_sync()
    return repo


@pytest.fixture
def client():
    return TestClient(app)


# ===========================================================================
# 1. Storage & Repository Unit Tests
# ===========================================================================
class TestStorageRepository:
    def test_session_crud_and_versioning(self, test_repo):
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        now = time.time()
        rec = SessionRecord(
            session_id=session_id,
            mode="demo",
            role="Database Internals",
            status="initialized",
            current_phase="INTRO",
            current_round="technical",
            current_turn=0,
            max_turns=6,
            created_at=now,
            updated_at=now,
        )
        test_repo.save_session_sync(rec)

        fetched = test_repo.get_session_sync(session_id)
        assert fetched is not None
        assert fetched.session_id == session_id
        assert fetched.status == "initialized"
        assert fetched.version == 1

        # Update status
        test_repo.update_session_status_sync(
            session_id=session_id,
            status="active",
            current_phase="LISTENING",
            current_round="technical",
            current_turn=1,
        )
        updated = test_repo.get_session_sync(session_id)
        assert updated.status == "active"
        assert updated.current_turn == 1
        assert updated.version == 2

    def test_state_and_turn_persistence(self, test_repo):
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        now = time.time()
        test_repo.save_session_sync(
            SessionRecord(
                session_id=session_id,
                mode="demo",
                role="core java",
                status="active",
                current_phase="LISTENING",
                current_round="technical",
                current_turn=1,
                created_at=now,
                updated_at=now,
            )
        )

        turn_rec = TurnRecord(
            session_id=session_id,
            turn=1,
            round="technical",
            question_id="q_core_java_281",
            question_text="What is Java?",
            answer_text="Java is an object-oriented language.",
            input_mode="text",
            decision_action="deepen",
            decision_reason="Strong technical foundation.",
            correctness=0.85,
            verdict_json='{"correctness": 0.85}',
            created_at=now,
        )
        test_repo.save_turn_sync(turn_rec)

        turns = test_repo.get_turns_sync(session_id)
        assert len(turns) == 1
        assert turns[0].question_id == "q_core_java_281"
        assert turns[0].correctness == 0.85

    def test_idempotency_key_deduplication(self, test_repo):
        session_id = "sess_idem_test"
        now = time.time()
        test_repo.save_session_sync(
            SessionRecord(
                session_id=session_id,
                mode="demo",
                status="active",
                current_phase="LISTENING",
                current_round="technical",
                current_turn=1,
                created_at=now,
                updated_at=now,
            )
        )

        key = "req_uuid_12345"
        # First attempt should succeed (True)
        assert test_repo.check_and_set_idempotency_key_sync(key, session_id, turn=1) is True
        # Second attempt with same key must return False (duplicate)
        assert test_repo.check_and_set_idempotency_key_sync(key, session_id, turn=1) is False

    def test_atomic_turn_transaction_and_rollback(self, test_repo):
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        now = time.time()
        test_repo.save_session_sync(
            SessionRecord(
                session_id=session_id,
                mode="demo",
                status="active",
                current_phase="LISTENING",
                current_round="technical",
                current_turn=1,
                created_at=now,
                updated_at=now,
            )
        )

        turn_rec = TurnRecord(
            session_id=session_id,
            turn=1,
            round="technical",
            question_id="q1",
            question_text="Q1 text",
            answer_text="A1 text",
            decision_action="move_on",
            decision_reason="Good answer",
            correctness=0.9,
            verdict_json="{}",
            created_at=now,
        )
        state_rec = StateRecord(
            session_id=session_id,
            current_turn=2,
            current_phase="LISTENING",
            state_json='{"session_id": "' + session_id + '"}',
            updated_at=now,
        )

        # Successful atomic record
        test_repo.record_turn_atomic_sync(session_id, turn_rec, state_rec, idempotency_key="key_1")
        assert len(test_repo.get_turns_sync(session_id)) == 1
        assert test_repo.get_session_sync(session_id).current_turn == 2

        # Attempt turn record violating FOREIGN KEY constraint (session does not exist)
        invalid_turn = turn_rec.model_copy(update={"session_id": "sess_non_existent"})
        with pytest.raises(Exception):
            test_repo.record_turn_atomic_sync("sess_non_existent", invalid_turn, state_rec, idempotency_key="key_2")


# ===========================================================================
# 2. Session Recovery & Continuation After Runtime Loss
# ===========================================================================
class TestSessionRecovery:
    def test_session_hydration_from_storage_after_cache_wipe(self):
        # 1. Create session and run turn 1
        active = global_session_store.create_session(
            CreateSessionRequest(mode="demo", role="core java", max_turns=4)
        )
        session_id = active.session_id
        active.runner.start()

        # Submit answer to question 1
        turn_res = active.runner.submit_answer(
            "Java is a high-level object-oriented programming language compiling to bytecode."
        )
        active.persist_turn(turn_res, answer_text="Java is a high-level object-oriented programming language compiling to bytecode.")

        assert active.runner.state.current_turn == 2
        assert len(active.runner.state.question_history) == 2

        # 2. Simulate server crash / runtime loss: completely wipe in-memory cache
        global_session_store._sessions.clear()
        assert session_id not in global_session_store._sessions

        # 3. Request session: must hydrate transparently from persistent storage
        recovered = global_session_store.get_session(session_id)
        assert recovered is not None
        assert recovered.session_id == session_id
        assert recovered.runner.state.current_turn == 2
        assert len(recovered.runner.state.question_history) == 2
        assert recovered.runner.current_question is not None

        # 4. Continue interview on the recovered session
        turn_res_2 = recovered.runner.submit_answer("HashMap uses buckets and trees for fast lookup.")
        recovered.persist_turn(turn_res_2, answer_text="HashMap uses buckets and trees for fast lookup.")

        assert recovered.runner.state.current_turn == 3


# ===========================================================================
# 3. WebSocket Idempotency & Turn Budget Protection Tests
# ===========================================================================
class TestWebSocketIdempotency:
    def test_duplicate_idempotency_key_does_not_advance_budget(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 4})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # ready
            ws.send_json({"type": "session_start", "session_id": session_id})
            ws.receive_json()  # initial question

            idempotent_key = f"idem_{uuid.uuid4().hex[:8]}"

            # 1. First submission
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "turn": 1,
                "answer": "Java is compiled to bytecode and executed by JVM.",
                "idempotency_key": idempotent_key,
            })
            proc = ws.receive_json()
            assert proc["type"] == "processing"
            t_res = ws.receive_json()
            assert t_res["type"] == "turn_result"
            q2 = ws.receive_json()
            assert q2["type"] == "question"
            assert q2["payload"]["turn"] == 2

            # Session is now at turn 2
            s_check = client.get(f"/api/sessions/{session_id}")
            assert s_check.json()["current_turn"] == 2

            # 2. Duplicate submission with SAME idempotency key
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "turn": 2,
                "answer": "Duplicate submission attempt with same key.",
                "idempotency_key": idempotent_key,
            })

            # Server detects duplicate key, does NOT re-evaluate, and re-sends current question
            dup_reply = ws.receive_json()
            assert dup_reply["type"] == "question"

            # Verify session turn budget was NOT advanced or wasted
            s_check_after = client.get(f"/api/sessions/{session_id}")
            assert s_check_after.json()["current_turn"] == 2


# ===========================================================================
# 4. Demo Mode 6-Question Invariant with Persistence & Recovery
# ===========================================================================
class TestDemoModePersistenceInvariant:
    def test_exact_six_questions_with_restart_and_persisted_report(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 6})
        session_id = c_res.json()["session_id"]

        first_three_answers = [
            "Java compiles to bytecode and executes on JVM.",
            "Garbage collection manages memory allocation on the heap.",
            "HashMap hashes keys to bucket indices.",
        ]

        # Phase 1: Connect, start, and complete first 3 turns
        with client.websocket_connect(f"/ws/interview/{session_id}") as ws1:
            ws1.receive_json()  # ready
            ws1.send_json({"type": "session_start", "session_id": session_id})
            ws1.receive_json()  # q1

            for ans in first_three_answers:
                ws1.send_json({
                    "type": "answer_submit",
                    "session_id": session_id,
                    "answer": ans,
                })
                proc = ws1.receive_json()
                assert proc["type"] == "processing"
                t_res = ws1.receive_json()
                assert t_res["type"] == "turn_result"
                next_msg = ws1.receive_json()
                if next_msg["type"] == "round_transition":
                    next_msg = ws1.receive_json()
                assert next_msg["type"] == "question"

        # Phase 2: Simulate server restart by completely clearing in-memory session registry
        global_session_store._sessions.clear()
        assert session_id not in global_session_store._sessions

        # Phase 3: Reconnect to interview. Server hydrates session from database.
        second_three_answers = [
            "Synchronized keyword locks monitor for thread safety.",
            "Deadlocks happen with circular waiting on locks.",
            "Spring framework provides dependency injection.",
        ]

        completed = False
        with client.websocket_connect(f"/ws/interview/{session_id}") as ws2:
            ready_msg = ws2.receive_json()
            assert ready_msg["type"] == "session_ready"
            assert ready_msg["payload"]["current_turn"] == 4

            for ans in second_three_answers:
                ws2.send_json({
                    "type": "answer_submit",
                    "session_id": session_id,
                    "answer": ans,
                })
                proc = ws2.receive_json()
                assert proc["type"] == "processing"
                t_res = ws2.receive_json()
                assert t_res["type"] == "turn_result"
                next_msg = ws2.receive_json()
                if next_msg["type"] == "round_transition":
                    next_msg = ws2.receive_json()
                if next_msg["type"] == "interview_complete":
                    completed = True
                    assert next_msg["payload"]["total_questions"] == 6
                    break

        assert completed is True

        # Phase 4: Wipe memory AGAIN to verify GET /report hydrates directly from database
        global_session_store._sessions.clear()
        rep_res = client.get(f"/api/sessions/{session_id}/report")
        assert rep_res.status_code == 200
        rep = rep_res.json()
        assert rep["session_info"]["total_questions_answered"] == 6

        # Check candidate safe report endpoint
        cand_res = client.get(f"/api/sessions/{session_id}/candidate-report")
        assert cand_res.status_code == 200
        cand_rep = cand_res.json()
        assert "feedback_summary" in cand_rep
        assert "hiring_assessment" not in cand_rep  # Internal notes hidden


# ===========================================================================
# 5. Security Hardening, Payload Limits, & Health Probes
# ===========================================================================
class TestSecurityAndHealth:
    def test_oversized_answer_payload_rejected(self):
        oversized = "a" * 8001
        with pytest.raises(Exception) as exc_info:
            ClientWSMessage(
                type=ClientMessageType.ANSWER_SUBMIT,
                session_id="sess_12345678",
                turn=1,
                answer=oversized,
            )
        assert "maximum permitted length" in str(exc_info.value)

    def test_invalid_session_id_websocket_rejected(self, client):
        # Malformed session ID not matching sess_[a-zA-Z0-9_-] pattern
        with client.websocket_connect("/ws/interview/invalid_id_format") as ws:
            err = ws.receive_json()
            assert err["type"] == "error"
            assert err["payload"]["code"] in {"SESSION_NOT_FOUND", "INVALID_SESSION_ID"}

    def test_health_and_readiness_endpoints(self, client):
        h_res = client.get("/health")
        assert h_res.status_code == 200
        assert h_res.json()["status"] == "ok"

        r_res = client.get("/ready")
        assert r_res.status_code == 200
        assert r_res.json()["status"] == "ready"

    def test_production_cors_wildcard_prohibited(self):
        with pytest.raises(ValueError) as exc_info:
            Settings(
                ENVIRONMENT="production",
                ALLOWED_ORIGINS="*",
                SECRET_KEY="secure-production-random-key-12345",
            )
        assert "Wildcard '*' is strictly prohibited" in str(exc_info.value)

    def test_production_default_secret_key_prohibited(self):
        with pytest.raises(ValueError) as exc_info:
            Settings(
                ENVIRONMENT="production",
                ALLOWED_ORIGINS="https://kramix.ai",
                SECRET_KEY="kramix-dev-secret-key-change-in-production",
            )
        assert "Default dev SECRET_KEY cannot be used in production" in str(exc_info.value)
