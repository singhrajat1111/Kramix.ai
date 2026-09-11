import { Pool } from "pg";
import fs from "fs";
import path from "path";

export interface UserRecord {
  id: string;
  email: string;
  plan: "free" | "payg" | "subscriber";
  credits: number;
  api_key_encrypted: string | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Database Connection Pool (PostgreSQL)
// ---------------------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL;

function assertDatabaseConfigured(): void {
  if (process.env.NODE_ENV === "production" && !databaseUrl) {
    throw new Error(
      "FATAL CONFIGURATION ERROR: DATABASE_URL must be configured in production environment. Kramix disallows local file-based database fallback in production."
    );
  }
}

let pool: Pool | null = null;
if (databaseUrl) {
  // Warn developers if connecting directly to a Supabase direct host (which may lack IPv4 routes on serverless hosts like Netlify)
  if (
    databaseUrl.includes(".supabase.co") &&
    !databaseUrl.includes("pooler.supabase.com")
  ) {
    console.warn(
      "NOTICE: DATABASE_URL uses direct Supabase host. On IPv4-only serverless runtimes (e.g. Netlify), consider using the Supabase connection pooler URL (pooler.supabase.com) to avoid IPv6 connectivity errors."
    );
  }

  const requiresSsl =
    process.env.NODE_ENV === "production" ||
    databaseUrl.includes("supabase.co") ||
    databaseUrl.includes("supabase.com") ||
    databaseUrl.includes("pooler.supabase.com") ||
    databaseUrl.includes("sslmode=require");

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000, // 5s connection timeout for serverless environments
  });
}

// ---------------------------------------------------------------------------
// In-Memory / File-based Dev Fallback Store (when DATABASE_URL is not set in dev/test)
// ---------------------------------------------------------------------------
interface DevStoreData {
  users: Record<string, UserRecord>;
  processedEvents: Record<string, { provider: string; processedAt: string }>;
}

const DEV_DB_FILE = path.join(process.cwd(), ".dev_kramix_db.json");

function loadDevStore(): DevStoreData {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local dev database cannot be used in production.");
  }
  try {
    if (fs.existsSync(DEV_DB_FILE)) {
      const raw = fs.readFileSync(DEV_DB_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Could not load local dev database file, using clean state", err);
  }
  return { users: {}, processedEvents: {} };
}

function saveDevStore(store: DevStoreData): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  try {
    fs.writeFileSync(DEV_DB_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Non-fatal in read-only or serverless environments
  }
}

// Initialize tables in PostgreSQL if available
let tablesInitialized = false;
async function ensureTablesExist(): Promise<void> {
  if (!pool || tablesInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        plan TEXT DEFAULT 'free' CHECK (plan IN ('free','payg','subscriber')),
        credits INT DEFAULT 0,
        api_key_encrypted TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        processed_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    tablesInitialized = true;
  } catch (err) {
    console.error("Database table initialization notice:", err);
  }
}

// ---------------------------------------------------------------------------
// User Repository Methods
// ---------------------------------------------------------------------------

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const cleanEmail = email.trim().toLowerCase();

  if (pool) {
    try {
      await ensureTablesExist();
      const res = await pool.query(
        "SELECT id, email, plan, credits, api_key_encrypted, created_at FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [cleanEmail]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        email: row.email,
        plan: row.plan,
        credits: Number(row.credits || 0),
        api_key_encrypted: row.api_key_encrypted,
        created_at: new Date(row.created_at),
      };
    } catch (err) {
      console.error("Database query error in getUserByEmail:", err);
      if (process.env.NODE_ENV !== "production") {
        const store = loadDevStore();
        const found = Object.values(store.users).find(
          (u) => u.email.toLowerCase() === cleanEmail
        );
        return found || null;
      }
      throw err;
    }
  }

  // Dev fallback
  const store = loadDevStore();
  const found = Object.values(store.users).find(
    (u) => u.email.toLowerCase() === cleanEmail
  );
  return found || null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  if (pool) {
    try {
      await ensureTablesExist();
      const res = await pool.query(
        "SELECT id, email, plan, credits, api_key_encrypted, created_at FROM users WHERE id = $1 LIMIT 1",
        [id]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        email: row.email,
        plan: row.plan,
        credits: Number(row.credits || 0),
        api_key_encrypted: row.api_key_encrypted,
        created_at: new Date(row.created_at),
      };
    } catch (err) {
      console.error("Database query error in getUserById:", err);
      if (process.env.NODE_ENV !== "production") {
        const store = loadDevStore();
        return store.users[id] || null;
      }
      throw err;
    }
  }

  // Dev fallback
  const store = loadDevStore();
  return store.users[id] || null;
}

export async function upsertUser(
  email: string,
  initialPlan: "free" | "payg" | "subscriber" = "free",
  initialCredits = 0
): Promise<UserRecord> {
  const cleanEmail = email.trim().toLowerCase();

  if (pool) {
    try {
      await ensureTablesExist();
      const res = await pool.query(
        `INSERT INTO users (email, plan, credits)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE
         SET email = EXCLUDED.email
         RETURNING id, email, plan, credits, api_key_encrypted, created_at`,
        [cleanEmail, initialPlan, initialCredits]
      );
      const row = res.rows[0];
      return {
        id: row.id,
        email: row.email,
        plan: row.plan,
        credits: Number(row.credits || 0),
        api_key_encrypted: row.api_key_encrypted,
        created_at: new Date(row.created_at),
      };
    } catch (err) {
      console.error("Database query error in upsertUser:", err);
      if (process.env.NODE_ENV !== "production") {
        const store = loadDevStore();
        let existing = Object.values(store.users).find(
          (u) => u.email.toLowerCase() === cleanEmail
        );
        if (!existing) {
          const id = `dev-user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          existing = {
            id,
            email: cleanEmail,
            plan: initialPlan,
            credits: initialCredits,
            api_key_encrypted: null,
            created_at: new Date(),
          };
          store.users[id] = existing;
          saveDevStore(store);
        }
        return existing;
      }
      throw err;
    }
  }

  // Dev fallback
  const store = loadDevStore();
  let existing = Object.values(store.users).find(
    (u) => u.email.toLowerCase() === cleanEmail
  );
  if (!existing) {
    const id = `dev-user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    existing = {
      id,
      email: cleanEmail,
      plan: initialPlan,
      credits: initialCredits,
      api_key_encrypted: null,
      created_at: new Date(),
    };
    store.users[id] = existing;
    saveDevStore(store);
  }
  return existing;
}

export async function updateUserCredits(
  userId: string,
  delta: number
): Promise<UserRecord | null> {
  if (pool) {
    await ensureTablesExist();
    // For decrements (delta < 0), require that current credits >= -delta to prevent race condition / double-spending
    const query =
      delta < 0
        ? `UPDATE users
           SET credits = credits + $1
           WHERE id = $2 AND credits >= $3
           RETURNING id, email, plan, credits, api_key_encrypted, created_at`
        : `UPDATE users
           SET credits = credits + $1
           WHERE id = $2
           RETURNING id, email, plan, credits, api_key_encrypted, created_at`;

    const params = delta < 0 ? [delta, userId, Math.abs(delta)] : [delta, userId];
    const res = await pool.query(query, params);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      email: row.email,
      plan: row.plan,
      credits: Number(row.credits || 0),
      api_key_encrypted: row.api_key_encrypted,
      created_at: new Date(row.created_at),
    };
  }

  // Dev fallback
  const store = loadDevStore();
  const user = store.users[userId];
  if (!user) return null;
  // Guard against overdrafting in dev store as well
  if (delta < 0 && (user.credits || 0) + delta < 0) {
    return null;
  }
  user.credits = Math.max(0, (user.credits || 0) + delta);
  saveDevStore(store);
  return user;
}

export async function updateUserPlan(
  userId: string,
  plan: "free" | "payg" | "subscriber"
): Promise<UserRecord | null> {
  if (pool) {
    await ensureTablesExist();
    const res = await pool.query(
      `UPDATE users
       SET plan = $1
       WHERE id = $2
       RETURNING id, email, plan, credits, api_key_encrypted, created_at`,
      [plan, userId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      email: row.email,
      plan: row.plan,
      credits: Number(row.credits || 0),
      api_key_encrypted: row.api_key_encrypted,
      created_at: new Date(row.created_at),
    };
  }

  // Dev fallback
  const store = loadDevStore();
  const user = store.users[userId];
  if (!user) return null;
  user.plan = plan;
  saveDevStore(store);
  return user;
}

export async function updateUserEncryptedKey(
  userId: string,
  encryptedKey: string | null
): Promise<UserRecord | null> {
  if (pool) {
    await ensureTablesExist();
    const res = await pool.query(
      `UPDATE users
       SET api_key_encrypted = $1
       WHERE id = $2
       RETURNING id, email, plan, credits, api_key_encrypted, created_at`,
      [encryptedKey, userId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      email: row.email,
      plan: row.plan,
      credits: Number(row.credits || 0),
      api_key_encrypted: row.api_key_encrypted,
      created_at: new Date(row.created_at),
    };
  }

  // Dev fallback
  const store = loadDevStore();
  const user = store.users[userId];
  if (!user) return null;
  user.api_key_encrypted = encryptedKey;
  saveDevStore(store);
  return user;
}

// ---------------------------------------------------------------------------
// Webhook Idempotency
// Returns true if event is NEW and recorded.
// Returns false if event was ALREADY processed.
// ---------------------------------------------------------------------------
export async function recordProcessedWebhook(
  eventId: string,
  provider: "stripe" | "razorpay"
): Promise<boolean> {
  if (!eventId) return false;

  if (pool) {
    await ensureTablesExist();
    try {
      const res = await pool.query(
        `INSERT INTO processed_events (event_id, provider)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [eventId, provider]
      );
      return res.rowCount !== null && res.rowCount > 0;
    } catch (err) {
      console.error("Failed to record webhook event:", err);
      return false;
    }
  }

  // Dev fallback
  const store = loadDevStore();
  if (store.processedEvents[eventId]) {
    return false; // already processed
  }
  store.processedEvents[eventId] = {
    provider,
    processedAt: new Date().toISOString(),
  };
  saveDevStore(store);
  return true;
}
