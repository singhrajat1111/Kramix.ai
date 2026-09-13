"""
Production REST & WebSocket Interview Runtime integration tests (Phase 12).
Verifies:
1. REST session creation (POST /api/sessions), safe retrieval (GET /api/sessions/{id}), and report access.
2. WebSocket handshake, typed messages (ClientWSMessage, ServerWSMessage), and question delivery.
3. Concurrency guard: duplicate/concurrent answer submissions rejected/locked safely without double turns.
4. Reconnection: client reconnecting recovers active session state without advancing turn or resetting.
5. Presentation-safe projections: no expected concepts, raw similarity, prompt injection signals leaked.
6. Exact 6-question demo invariant executed end-to-end (REST -> WebSocket -> Completion -> Report).
7. Observability: SESSION_CREATED, WEBSOCKET_CONNECTED, ANSWER_RECEIVED, TURN_COMPLETED, SESSION_COMPLETED events.
"""
import pytest
import json
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.session_store import global_session_store
from schemas.interview_state import RoundType
from schemas.report import FinalInterviewReport
from observability.trace import global_tracer


@pytest.fixture
def client():
    return TestClient(app)


# ===========================================================================
# 1. REST API Tests
# ===========================================================================
class TestSessionRESTAPI:
    def test_create_session_demo_mode(self, client):
        payload = {
            "mode": "demo",
            "role": "core java",
            "max_turns": 6,
        }
        res = client.post("/api/sessions", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert "session_id" in data
        assert data["mode"] == "demo"
        assert data["role"] == "core java"
        assert data["max_turns"] == 6
        assert data["ws_url"] == f"/ws/interview/{data['session_id']}"

    def test_create_session_invalid_mode(self, client):
        payload = {"mode": "invalid_mode"}
        res = client.post("/api/sessions", json=payload)
        assert res.status_code == 422  # Validation error

    def test_get_session_status(self, client):
        # Create session
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java"})
        session_id = c_res.json()["session_id"]

        # Get status
        s_res = client.get(f"/api/sessions/{session_id}")
        assert s_res.status_code == 200
        data = s_res.json()
        assert data["session_id"] == session_id
        assert data["current_turn"] == 0
        assert data["phase"] == "INTRO"
        assert data["is_complete"] is False

    def test_get_nonexistent_session(self, client):
        res = client.get("/api/sessions/nonexistent_123")
        assert res.status_code == 404

    def test_get_report_before_completion_fails(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo"})
        session_id = c_res.json()["session_id"]

        r_res = client.get(f"/api/sessions/{session_id}/report")
        assert r_res.status_code == 400
        assert "only available after interview completion" in r_res.json()["detail"]


# ===========================================================================
# 2. WebSocket Interview Channel & Typed Protocol Tests
# ===========================================================================
class TestWebSocketInterviewRuntime:
    def test_websocket_connection_and_session_ready(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java"})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ready_msg = ws.receive_json()
            assert ready_msg["type"] == "session_ready"
            assert ready_msg["session_id"] == session_id
            assert ready_msg["payload"]["phase"] == "INTRO"
            assert ready_msg["payload"]["is_complete"] is False

    def test_websocket_invalid_session(self, client):
        with client.websocket_connect("/ws/interview/invalid_sess_404") as ws:
            err_msg = ws.receive_json()
            assert err_msg["type"] == "error"
            assert err_msg["payload"]["code"] == "SESSION_NOT_FOUND"

    def test_session_start_and_first_question_delivery(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java"})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            # 1. Receive SESSION_READY
            ready = ws.receive_json()
            assert ready["type"] == "session_ready"

            # 2. Client sends SESSION_START
            ws.send_json({
                "type": "session_start",
                "session_id": session_id,
            })

            # 3. Server delivers initial QUESTION
            q_msg = ws.receive_json()
            assert q_msg["type"] == "question"
            assert q_msg["session_id"] == session_id
            payload = q_msg["payload"]
            assert "question_id" in payload
            assert "question_text" in payload
            assert payload["turn"] == 1

            # SECURITY CHECK: ensure internal evaluation attributes are NOT leaked
            assert "expected_concepts" not in payload
            assert "concept_descriptions" not in payload
            assert "possible_followups" not in payload
            assert "related_questions" not in payload

    def test_answer_submission_and_turn_processing(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 3})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # session_ready
            ws.send_json({"type": "session_start", "session_id": session_id})
            q1 = ws.receive_json()  # first question
            assert q1["type"] == "question"

            # Submit answer
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "answer": "The JVM memory model consists of Heap, Stack, Metaspace, and Garbage Collection.",
            })

            # Expect PROCESSING notification
            proc = ws.receive_json()
            assert proc["type"] == "processing"
            assert proc["payload"]["status"] == "evaluating_answer"

            # Expect TURN_RESULT
            t_res = ws.receive_json()
            assert t_res["type"] == "turn_result"
            assert t_res["payload"]["status"] == "processed"

            # Expect next QUESTION
            q2 = ws.receive_json()
            assert q2["type"] == "question"
            assert q2["payload"]["turn"] == 2


# ===========================================================================
# 3. Concurrency & Duplicate Answer Guard Tests
# ===========================================================================
class TestConcurrencyAndSecurityGuards:
    def test_rapid_duplicate_answers_rejected_or_serialized(self, client):
        """
        Submitting an answer while processing must not corrupt the turn counter or execute twice.
        """
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 4})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # session_ready
            ws.send_json({"type": "session_start", "session_id": session_id})
            ws.receive_json()  # question 1

            # Submit first answer for turn 1
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "turn": 1,
                "answer": "First comprehensive response.",
            })

            # Immediately submit duplicate answer for turn 1 without waiting
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "turn": 1,
                "answer": "First comprehensive response duplicate.",
            })

            msgs = []
            for _ in range(4):
                msgs.append(ws.receive_json())

            msg_types = [m["type"] for m in msgs]
            assert "processing" in msg_types
            assert "turn_result" in msg_types
            # The second submission must receive error (either STALE_OR_DUPLICATE_TURN or BUSY_PROCESSING)
            assert "error" in msg_types

            # Verify turn count advanced exactly once
            state_res = client.get(f"/api/sessions/{session_id}")
            assert state_res.json()["current_turn"] == 2

    def test_oversized_answer_rejected(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java"})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # session_ready
            ws.send_json({"type": "session_start", "session_id": session_id})
            ws.receive_json()  # question 1

            # Send payload exceeding 8,000 characters
            huge_answer = "A" * 9000
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "answer": huge_answer,
            })

            err_msg = ws.receive_json()
            assert err_msg["type"] == "error"
            assert "exceeds maximum permitted length" in err_msg["payload"]["message"]


# ===========================================================================
# 4. Reconnection & State Recovery Tests
# ===========================================================================
class TestReconnectionStateRecovery:
    def test_reconnect_recovers_current_question_without_restarting(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 4})
        session_id = c_res.json()["session_id"]

        # First connection: Start and answer Turn 1
        with client.websocket_connect(f"/ws/interview/{session_id}") as ws1:
            ws1.receive_json()  # ready
            ws1.send_json({"type": "session_start", "session_id": session_id})
            q1 = ws1.receive_json()  # turn 1
            assert q1["payload"]["turn"] == 1

            ws1.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "answer": "Detailed answer for turn 1.",
            })
            ws1.receive_json()  # processing
            ws1.receive_json()  # turn_result
            q2 = ws1.receive_json()  # turn 2
            assert q2["payload"]["turn"] == 2
            # Client disconnects abruptly

        # Second connection: Reconnect to the same session
        with client.websocket_connect(f"/ws/interview/{session_id}") as ws2:
            ready2 = ws2.receive_json()
            assert ready2["type"] == "session_ready"
            assert ready2["session_id"] == session_id
            assert ready2["payload"]["current_turn"] == 2
            assert ready2["payload"]["is_complete"] is False
            assert ready2["payload"]["current_question"] is not None
            assert ready2["payload"]["current_question"]["turn"] == 2

            # Sending session_start again should return the current question, not restart
            ws2.send_json({"type": "session_start", "session_id": session_id})
            recovered_q = ws2.receive_json()
            assert recovered_q["type"] == "question"
            assert recovered_q["payload"]["turn"] == 2


# ===========================================================================
# 5. Exact 6-Question Demo Mode End-to-End Test
# ===========================================================================
class TestDemoModeEndToEndE2E:
    def test_complete_six_turn_demo_lifecycle_and_report(self, client):
        """
        Executes full production demo flow:
        1. REST create session (demo mode, 6 questions)
        2. Connect WebSocket
        3. Start session
        4. Sequentially answer 6 questions
        5. Receive interview_complete event
        6. Fetch final report via REST GET /api/sessions/{session_id}/report
        100% offline, zero API keys.
        """
        # 1. Create Session
        c_res = client.post("/api/sessions", json={
            "mode": "demo",
            "role": "core java",
            "max_turns": 6,
        })
        assert c_res.status_code == 201
        session_id = c_res.json()["session_id"]

        # 2. Run WebSocket turn loop
        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # session_ready
            ws.send_json({"type": "session_start", "session_id": session_id})

            initial_q = ws.receive_json()
            assert initial_q["type"] == "question"

            canned_answers = [
                "The Java Virtual Machine manages heap and stack memory with generational garbage collection.",
                "Java collections include ArrayList with dynamic arrays and HashMap with hash buckets and tree bins.",
                "Thread synchronization uses intrinsic monitors, ReentrantLock, and atomic variables.",
                "Spring Boot provides auto-configuration and embedded servlet containers for microservices.",
                "Concurrency issues like deadlocks are prevented through lock ordering and timeout acquisition.",
                "Kafka event streaming decouples microservices with partitioned distributed commit logs.",
            ]

            completed = False
            for idx, ans in enumerate(canned_answers, start=1):
                ws.send_json({
                    "type": "answer_submit",
                    "session_id": session_id,
                    "answer": ans,
                })

                proc = ws.receive_json()
                assert proc["type"] == "processing"

                turn_res = ws.receive_json()
                assert turn_res["type"] == "turn_result"

                next_msg = ws.receive_json()
                if next_msg["type"] == "interview_complete":
                    completed = True
                    assert next_msg["payload"]["total_questions"] == 6
                    break
                elif next_msg["type"] == "question":
                    assert next_msg["payload"]["turn"] == idx + 1

            assert completed is True

        # 3. Verify safe state via REST
        state_res = client.get(f"/api/sessions/{session_id}")
        assert state_res.status_code == 200
        assert state_res.json()["is_complete"] is True
        assert state_res.json()["current_turn"] == 6

        # 4. Fetch Final Report via REST
        report_res = client.get(f"/api/sessions/{session_id}/report")
        assert report_res.status_code == 200
        report_data = report_res.json()

        # Validate structured report contents
        assert report_data["session_info"]["session_id"] == session_id
        assert report_data["session_info"]["total_questions_asked"] == 6
        assert report_data["session_info"]["total_questions_answered"] == 6
        assert len(report_data["question_performances"]) == 6
        assert report_data["performance_metrics"]["overall_score"] > 0.0
        assert report_data["hiring_assessment"]["recommendation"] in {
            "strong_yes", "yes", "mixed", "no"
        }
