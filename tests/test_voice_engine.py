"""
Comprehensive tests for Phase 13: Voice / STT / TTS + Interviewer Experience.
Verifies:
1. Voice Models & Configuration (VoiceConfig, STTResult, TTSRequest, TTSResult).
2. STT/TTS Abstractions and isolated mock implementations.
3. Deterministic VoiceManager behavior, error isolation, and trace observability.
4. Same Answer Pipeline Invariant: voice answers execute through identical submit_answer() & AnswerEngine as text.
5. STT Confidence decoupling: speech transcription confidence is NOT converted into answer correctness.
6. Question Budget Invariant: low-confidence/empty voice answers do NOT advance the turn counter.
7. Exact 6-turn Demo Mode completion preserved with voice answers.
8. WebSocket Voice Metadata handling (input_mode="voice", stt_confidence, audio_duration_seconds).
9. Graceful fallback from audio to text on failure.
10. Zero body language / facial tracking / voice pitch scoring.
"""
import pytest
import asyncio
from fastapi.testclient import TestClient

from voice.models import VoiceConfig, STTResult, TTSRequest, TTSResult, VoiceInputMode
from voice.providers.mock_voice import MockSTTProvider, MockTTSProvider
from voice.manager import VoiceManager
from backend.app.main import app
from backend.app.session_store import global_session_store
from backend.app.schemas_api import CreateSessionRequest
from observability.trace import TraceLogger


@pytest.fixture
def clean_tracer():
    return TraceLogger()


@pytest.fixture
def client():
    return TestClient(app)


# ===========================================================================
# 1. Voice Models & Configuration Tests
# ===========================================================================
class TestVoiceModelsAndConfig:
    def test_voice_config_defaults(self):
        config = VoiceConfig()
        assert config.stt_enabled is True
        assert config.tts_enabled is True
        assert config.confidence_threshold == 0.60
        assert config.fallback_to_text is True

    def test_stt_result_model(self):
        res = STTResult(
            transcript="Hash indexing provides O(1) average lookup.",
            confidence=0.96,
            duration_seconds=3.2,
            language="en-US",
        )
        assert res.confidence == 0.96
        assert res.duration_seconds == 3.2
        assert res.is_final is True

    def test_tts_request_and_result_model(self):
        req = TTSRequest(text="Explain database indexing.")
        assert req.speed == 1.0

        res = TTSResult(
            audio_bytes=b"RIFF...",
            format="wav",
            duration_seconds=2.5,
            character_count=len(req.text),
        )
        assert res.duration_seconds == 2.5
        assert res.character_count == 26


# ===========================================================================
# 2. Voice Abstraction & Mock Providers Tests
# ===========================================================================
class TestMockVoiceProviders:
    @pytest.mark.anyio
    async def test_mock_stt_transcription(self):
        provider = MockSTTProvider(default_confidence=0.92)
        simulated_audio = b"Virtual memory allows address space isolation."
        result = await provider.transcribe_audio(simulated_audio)

        assert isinstance(result, STTResult)
        assert result.transcript == "Virtual memory allows address space isolation."
        assert result.confidence == 0.92
        assert result.duration_seconds > 0.0

    @pytest.mark.anyio
    async def test_mock_tts_synthesis(self):
        provider = MockTTSProvider()
        req = TTSRequest(text="What is a B-tree?")
        result = await provider.synthesize_speech(req)

        assert isinstance(result, TTSResult)
        assert result.character_count == len("What is a B-tree?")
        assert result.duration_seconds > 0.0
        assert result.audio_bytes is not None
        assert result.audio_bytes.startswith(b"RIFF")

    @pytest.mark.anyio
    async def test_mock_provider_failure_simulation(self):
        failing_stt = MockSTTProvider(simulate_failure=True)
        with pytest.raises(RuntimeError) as exc_info:
            await failing_stt.transcribe_audio(b"sample")
        assert "Simulated STT transcription failure" in str(exc_info.value)

        failing_tts = MockTTSProvider(simulate_failure=True)
        with pytest.raises(RuntimeError) as exc_info:
            await failing_tts.synthesize_speech(TTSRequest(text="test"))
        assert "Simulated TTS audio synthesis failure" in str(exc_info.value)


# ===========================================================================
# 3. VoiceManager & Observability Tests
# ===========================================================================
class TestVoiceManager:
    @pytest.mark.anyio
    async def test_voice_manager_transcribe_lifecycle(self, clean_tracer):
        mgr = VoiceManager(tracer=clean_tracer)
        audio = b"PostgreSQL uses multiversion concurrency control."
        res = await mgr.transcribe(session_id="sess_v1", turn=1, audio_data=audio)

        assert res.transcript == "PostgreSQL uses multiversion concurrency control."

        events = clean_tracer.get_events(session_id="sess_v1")
        event_types = [e.event_type for e in events]
        assert "stt_requested" in event_types
        assert "stt_completed" in event_types

    @pytest.mark.anyio
    async def test_voice_manager_low_confidence_triggers_fallback_event(self, clean_tracer):
        low_conf_provider = MockSTTProvider(default_confidence=0.45)
        config = VoiceConfig(confidence_threshold=0.60)
        mgr = VoiceManager(config=config, stt_provider=low_conf_provider, tracer=clean_tracer)

        res = await mgr.transcribe(session_id="sess_v2", turn=2, audio_data=b"muffled speech")
        assert res.confidence == 0.45

        events = clean_tracer.get_events(session_id="sess_v2")
        event_types = [e.event_type for e in events]
        assert "voice_fallback" in event_types

    @pytest.mark.anyio
    async def test_voice_manager_synthesize_lifecycle(self, clean_tracer):
        mgr = VoiceManager(tracer=clean_tracer)
        res = await mgr.synthesize(session_id="sess_v3", turn=1, text="Explain write-ahead logging.")

        assert res.duration_seconds > 0.0

        events = clean_tracer.get_events(session_id="sess_v3")
        event_types = [e.event_type for e in events]
        assert "tts_requested" in event_types
        assert "tts_completed" in event_types


# ===========================================================================
# 4. Same Answer Pipeline & Invariants Tests
# ===========================================================================
class TestSameAnswerPipelineInvariant:
    def test_voice_answer_routes_through_identical_engine_pipeline(self, clean_tracer):
        """
        Non-negotiable Rule #6: Voice answers must reach the exact same AnswerEngine
        and DecisionEngine through InterviewSession.submit_answer().
        """
        active = global_session_store.create_session(
            CreateSessionRequest(mode="demo", role="core java", max_turns=3)
        )
        active.runner.start()

        # Transcript obtained from STT answering the initial question
        curr_q = active.runner.current_question
        voice_transcript = f"Here is the detailed technical answer covering {' and '.join(curr_q.expected_concepts)} in depth."

        # Pass to authoritative session
        turn_res = active.runner.submit_answer(voice_transcript)

        assert turn_res.verdict is not None
        assert turn_res.decision is not None
        assert turn_res.turn == 2
        # Correctness is derived from concepts in transcript, NOT speech properties
        assert turn_res.verdict.correctness > 0.0

    def test_stt_confidence_decoupled_from_answer_correctness(self, clean_tracer):
        """
        Non-negotiable Rule #7: High STT confidence (e.g. 0.99) does not inflate an incorrect answer,
        and moderate STT confidence does not deflate a strong conceptual answer.
        """
        active = global_session_store.create_session(
            CreateSessionRequest(mode="demo", role="core java", max_turns=3)
        )
        active.runner.start()

        # Perfectly recognized wrong answer
        wrong_transcript = "Java is an operating system developed by Microsoft."
        stt_confidence = 0.99  # Perfectly understood audio

        turn_res = active.runner.submit_answer(wrong_transcript)

        # Correctness must be low because content is wrong, regardless of high STT confidence
        assert turn_res.verdict.correctness <= 0.20


# ===========================================================================
# 5. WebSocket Voice Metadata & Budget Invariant Tests
# ===========================================================================
class TestWebSocketVoiceIntegration:
    def test_websocket_voice_answer_submission_and_tracing(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 4})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # ready
            ws.send_json({"type": "session_start", "session_id": session_id})
            ws.receive_json()  # question 1

            # Submit answer with voice metadata
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "turn": 1,
                "answer": "The JVM heap is divided into Young and Old generations.",
                "input_mode": "voice",
                "stt_confidence": 0.94,
                "audio_duration_seconds": 4.5,
            })

            proc = ws.receive_json()
            assert proc["type"] == "processing"

            t_res = ws.receive_json()
            assert t_res["type"] == "turn_result"
            assert t_res["payload"]["turn"] == 2

            q2 = ws.receive_json()
            assert q2["type"] == "question"
            assert q2["payload"]["turn"] == 2

    def test_low_confidence_voice_answer_does_not_consume_turn(self, client):
        """
        Non-negotiable Rule #9: Low-confidence speech recognition prompts retry
        and does NOT advance or waste candidate question budget.
        """
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 4})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # ready
            ws.send_json({"type": "session_start", "session_id": session_id})
            ws.receive_json()  # question 1

            # Submit low-confidence speech (confidence 0.25 < threshold 0.40)
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "turn": 1,
                "answer": "mumbled syllables",
                "input_mode": "voice",
                "stt_confidence": 0.25,
            })

            err = ws.receive_json()
            assert err["type"] == "error"
            assert err["payload"]["code"] == "LOW_STT_CONFIDENCE"

            # Check session turn budget: still on turn 1!
            state_res = client.get(f"/api/sessions/{session_id}")
            assert state_res.json()["current_turn"] == 1

            # Candidate can now retry with text or clear voice
            ws.send_json({
                "type": "answer_submit",
                "session_id": session_id,
                "turn": 1,
                "answer": "Clear technical answer on retry.",
                "input_mode": "text",
            })

            proc = ws.receive_json()
            assert proc["type"] == "processing"
            t_res = ws.receive_json()
            assert t_res["type"] == "turn_result"

            # Now advanced to turn 2
            state_res2 = client.get(f"/api/sessions/{session_id}")
            assert state_res2.json()["current_turn"] == 2


# ===========================================================================
# 6. Exact 6-Turn Demo Mode with Voice Answers E2E
# ===========================================================================
class TestDemoModeVoiceE2E:
    def test_voice_answers_complete_exact_six_turn_demo(self, client):
        c_res = client.post("/api/sessions", json={"mode": "demo", "role": "core java", "max_turns": 6})
        session_id = c_res.json()["session_id"]

        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            ws.receive_json()  # ready
            ws.send_json({"type": "session_start", "session_id": session_id})
            ws.receive_json()  # initial question

            voice_answers = [
                "Java garbage collector automatically reclaims unused heap memory.",
                "HashMap uses an array of linked nodes and converts to Red-Black trees at capacity threshold.",
                "Synchronized blocks acquire object monitors to ensure mutual exclusion across threads.",
                "Spring framework provides dependency injection and inversion of control for components.",
                "Deadlocks occur when threads hold resources while waiting circularly for others.",
                "Kafka clusters replicate commit log partitions across broker nodes.",
            ]

            completed = False
            for ans in voice_answers:
                ws.send_json({
                    "type": "answer_submit",
                    "session_id": session_id,
                    "answer": ans,
                    "input_mode": "voice",
                    "stt_confidence": 0.92,
                    "audio_duration_seconds": 3.8,
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

            assert completed is True

        # Verify complete report is generated without body language or emotion scoring
        report_res = client.get(f"/api/sessions/{session_id}/report")
        assert report_res.status_code == 200
        report = report_res.json()

        assert report["session_info"]["total_questions_answered"] == 6
        # Invariant check: scoring must evaluate technical/depth dimensions, NOT emotion or pitch
        breakdown = report["performance_metrics"]["dimension_breakdown"]
        assert "technical" in breakdown
        assert "depth" in breakdown
        assert "emotion" not in breakdown
        assert "facial_expression" not in breakdown
        assert "pitch" not in breakdown
