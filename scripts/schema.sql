-- Kramix.AI Database Schema
-- Run this migration against your PostgreSQL database (e.g. Supabase, Neon, RDS, or local Postgres)

-- 1. Users table (Accounts, Plans, Credits, and Encrypted BYOK)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','payg','subscriber')),
  credits INT DEFAULT 0,
  api_key_encrypted TEXT,       -- encrypted with AES-256-GCM if user brings their own key
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user lookup by email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Processed Webhooks table (Strict Idempotency for Stripe & Razorpay)
CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'razorpay')),
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast event ID check
CREATE INDEX IF NOT EXISTS idx_processed_events_provider ON processed_events(provider);
