# Kramix V2 — AI Technical Interview Intelligence Platform

Kramix V2 is an architectural interview intelligence platform designed for high-signal, multi-turn technical assessments. It executes structured interviews using deterministic graph-based question selection, nuanced concept-coverage evaluation, explainable routing decisions, and hiring committee dossiers.

---

## 1. System Architecture

```text
React + TypeScript Frontend (Client Presentation)
        ↓
REST / WebSocket Protocols
        ↓
FastAPI Application Runtime (`backend/app/`)
        ↓
ActiveSession Store & Locking (`backend/app/session_store.py`)
        ↓
InterviewSession Coordinator (`orchestrator/session_runner.py`)
        ↓
Round Strategies (`rounds/`)
        ↓
Question Graph Engine (`question_engine/`)
        ↓
Answer Engine (`answer_engine/`)
        ↓
Decision Engine (`decision_engine/`)
        ↓
State Machine (`orchestrator/state_machine.py`)
        ↓
Final Report Engine (`scoring/report_engine.py`)

Supporting Systems:
* ProviderManager (`providers/`): External LLM integration & advisory fallback
* RAG & CandidateContext (`rag/`, `memory/`): Resume & project context retrieval
* Voice I/O (`voice/`): Browser STT/TTS transcript transport
* Observability (`observability/`): Structured audit trace logging
* Persistence Repository (`storage/`): PostgreSQL (production) & SQLite (development)
```

---

## 2. Core Execution Modes

### Demo Mode (Offline / Zero-Key)
* **API Key Free**: Zero live LLM calls, zero network API keys required.
* **Deterministic Invariant**: Exactly 6 answered questions across structured rounds.
* **Autonomous**: Driven entirely by curated Question Graphs and the deterministic Answer Engine.

### API Mode (Provider-Augmented)
* **Advisory LLM Integration**: Uses OpenAI, Gemini, or Anthropic for auxiliary question proposals and evaluation nuance.
* **Deterministic Authority**: All LLM question proposals pass through `QuestionValidator`. The deterministic engine remains 100% authoritative over correctness, state transitions, and scoring.
* **Graceful Degradation**: External provider failures automatically fall back to deterministic graph routing without stalling the interview.

---

## 3. Local Development & Setup

### Prerequisites
* Python 3.10+ (Tested on Python 3.14)
* Node.js v18+ (for TypeScript client verification)

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment variables:
| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection URL (PostgreSQL / Supabase / SQLite) | `sqlite:///./kramix_dev.db` |
| `SUPABASE_URL` | Supabase project URL (`https://<project-ref>.supabase.co`) | `None` |
| `SUPABASE_KEY` | Supabase public/anon API key | `None` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret API key (server-side only) | `None` |
| `ENVIRONMENT` | Runtime environment (`development`, `testing`, `production`) | `development` |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS origins | `http://localhost:3000,http://localhost:5173` |
| `SECRET_KEY` | Cryptographic secret for signing sessions | (change in production) |
| `CONFIDENCE_THRESHOLD` | Minimum voice STT confidence | `0.60` |

### Running the Backend Server
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4. API & WebSocket Runtime

### REST Endpoints
* `GET /health`: Liveness probe (`{"status": "healthy"}`).
* `GET /ready`: Readiness probe verifying database connectivity (`{"status": "ready", "database": "connected"}`).
* `POST /api/sessions`: Creates an interview session (`{"mode": "demo" | "api", "role": "..."}`).
* `GET /api/sessions/{id}`: Presentation-safe session snapshot.
* `GET /api/sessions/{id}/report`: Full internal hiring committee assessment (confidential).
* `GET /api/sessions/{id}/candidate-report`: Redacted candidate-facing constructive feedback.

### WebSocket Endpoint
* `ws://<host>:<port>/ws/interview/{session_id}`: Real-time bi-directional interview channel.
  - Client events: `session_start`, `answer_submit`, `session_end`, `heartbeat`.
  - Server events: `session_ready`, `question`, `processing`, `turn_result`, `round_transition`, `interview_complete`, `error`.

---

## 5. Storage & Persistence

* **Dual-Engine Repository Abstraction**: Both `PostgresInterviewRepository` and `SqliteInterviewRepository` implement the identical `BaseInterviewRepository` interface.
* **Relational Schema**: Managed via `migrations/001_initial_schema.sql` and `migrations/runner.py`:
  - `sessions`: Session metadata, phase, round, turn, and completion versioning.
  - `turns`: Turn question, answer, input mode, timing, correctness, and decision reason.
  - `interview_states`: Full snapshot of `InterviewState` JSON.
  - `reports`: Persisted final reports and candidate summaries.
  - `idempotency_keys`: Strict deduplication preventing duplicate turn evaluation.
* **Atomic Recovery**: Server restarts restore session state from persistent storage (`SESSION_RESTORED`) without advancing the turn budget or corrupting interview state.

---

## 6. Voice & RAG Subsystems

* **Voice Transport**: Voice functions purely as an I/O transport layer (`voice/`). STT transcripts route through the identical `InterviewSession.submit_answer()` pipeline as text. Audio confidence is tracked separately from answer correctness.
* **RAG & Candidate Context**: Resumes (`rag/`) are parsed, chunked, and embedded. Extracted candidate project claims remain unverified signals and never override deterministic correctness scoring.

---

## 7. Testing & Quality Assurance

Run the complete test suite:
```bash
python -m pytest tests/ -v
```

Verified baseline: **160 passing tests** across 16 test suites covering:
* Schema contracts & validation
* State machine & valid transitions
* Question graph navigation & topic isolation
* Answer engine concept coverage & prompt injection defense
* Decision engine routing rules
* Demo mode exact 6-turn lifecycle
* Observability & structured audit trace logging
* Provider abstraction & fallback
* RAG chunking & vector retrieval
* Multi-round strategy progression
* Report engine & hiring committee scoring
* Production REST & WebSocket runtime
* Voice STT/TTS pipeline & fallback
* Persistence, recovery, and security hardening
* Concurrency, data isolation, and golden interview fixtures

---

## 8. Production Deployment Prerequisites

Before deploying to a public production environment:
1. **Authentication & Authorization Gateway**: Configure an API gateway or reverse proxy (e.g., JWT/OAuth2 session tokens) in front of `GET /api/sessions/{id}/report` to protect confidential hiring committee notes.
2. **Production PostgreSQL**: Deploy a live PostgreSQL instance with connection pooling (`DATABASE_URL=postgresql+asyncpg://...`).
3. **Strict CORS**: Ensure `ALLOWED_ORIGINS` explicitly lists exact production frontend domains (wildcard `*` is automatically rejected in `ENVIRONMENT=production`).
4. **Secret Key**: Set a cryptographically secure random string for `SECRET_KEY`.
