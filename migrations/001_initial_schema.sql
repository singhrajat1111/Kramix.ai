-- Migration 001: Initial Schema for Kramix V2 Persistent Storage
-- PostgreSQL dialect (compatible with standard relational database specifications)

CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    mode VARCHAR(32) NOT NULL DEFAULT 'demo',
    role VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'initialized',
    current_phase VARCHAR(32) NOT NULL DEFAULT 'INTRO',
    current_round VARCHAR(32) NOT NULL DEFAULT 'technical',
    current_turn INTEGER NOT NULL DEFAULT 0,
    max_turns INTEGER NOT NULL DEFAULT 6,
    created_at DOUBLE PRECISION NOT NULL,
    updated_at DOUBLE PRECISION NOT NULL,
    completed_at DOUBLE PRECISION,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS turns (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    turn INTEGER NOT NULL,
    round VARCHAR(32) NOT NULL,
    question_id VARCHAR(64) NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    input_mode VARCHAR(16) NOT NULL DEFAULT 'text',
    stt_confidence DOUBLE PRECISION,
    audio_duration_seconds DOUBLE PRECISION,
    decision_action VARCHAR(32) NOT NULL,
    decision_reason TEXT NOT NULL,
    correctness DOUBLE PRECISION NOT NULL,
    verdict_json TEXT NOT NULL,
    created_at DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_session_turn UNIQUE (session_id, turn)
);

CREATE TABLE IF NOT EXISTS interview_states (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
    current_turn INTEGER NOT NULL DEFAULT 0,
    current_phase VARCHAR(32) NOT NULL DEFAULT 'INTRO',
    state_json TEXT NOT NULL,
    updated_at DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
    report_json TEXT NOT NULL,
    candidate_summary TEXT NOT NULL,
    hiring_decision VARCHAR(32) NOT NULL,
    overall_score DOUBLE PRECISION NOT NULL,
    created_at DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    turn INTEGER NOT NULL,
    created_at DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_turns_session_id ON turns(session_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_session ON idempotency_keys(session_id);
