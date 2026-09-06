import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  ai: { maxRequests: 30, windowMs: 60 * 1000 },             // 30 req/min for AI completions
  checkout: { maxRequests: 10, windowMs: 60 * 1000 },       // 10 req/min for checkouts
  round: { maxRequests: 10, windowMs: 60 * 1000 },          // 10 req/min for round conclusion
  byok: { maxRequests: 10, windowMs: 60 * 1000 },           // 10 req/min for API key updates
  auth: { maxRequests: 20, windowMs: 60 * 1000 },           // 20 req/min for auth actions
  testConnection: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 req/min for provider health probes
};

interface WindowRecord {
  timestamps: number[];
}

const ipWindows = new Map<string, WindowRecord>();

// Cleanup stale windows periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    ipWindows.forEach((record, key) => {
      record.timestamps = record.timestamps.filter((ts: number) => now - ts < 10 * 60 * 1000);
      if (record.timestamps.length === 0) {
        ipWindows.delete(key);
      }
    });
  }, 5 * 60 * 1000);
  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

function getClientIdentifier(req: NextRequest | { headers?: { get: (k: string) => string | null } } | string): string {
  if (typeof req === "string") return req;
  const forwarded = req?.headers?.get?.("x-forwarded-for");
  const realIp = req?.headers?.get?.("x-real-ip");
  const cfConnectingIp = req?.headers?.get?.("cf-connecting-ip");

  if (cfConnectingIp) return cfConnectingIp.trim();
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export function checkRateLimit(
  req: NextRequest | { headers?: { get: (k: string) => string | null } } | string,
  category: "ai" | "checkout" | "round" | "byok" | "auth" | "testConnection" = "ai"
): { success: boolean; limit: number; remaining: number; resetSeconds: number } {
  const config = LIMITS[category] || LIMITS.ai;
  const ip = getClientIdentifier(req);
  const key = `${category}:${ip}`;
  const now = Date.now();

  let record = ipWindows.get(key);
  if (!record) {
    record = { timestamps: [] };
    ipWindows.set(key, record);
  }

  // Filter timestamps within the rolling window
  record.timestamps = record.timestamps.filter((ts) => now - ts < config.windowMs);

  if (record.timestamps.length >= config.maxRequests) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000));
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      resetSeconds,
    };
  }

  record.timestamps.push(now);
  const remaining = config.maxRequests - record.timestamps.length;
  return {
    success: true,
    limit: config.maxRequests,
    remaining,
    resetSeconds: Math.ceil(config.windowMs / 1000),
  };
}

/**
 * Convenience middleware function for API route handlers.
 * Returns a 429 NextResponse if rate limit exceeded, or null if allowed.
 */
export function enforceRateLimit(
  req: NextRequest,
  category: "ai" | "checkout" | "round" | "byok" | "auth" | "testConnection" = "ai"
): NextResponse | null {
  const check = checkRateLimit(req, category);
  if (!check.success) {
    console.warn(`[RateLimit] Exceeded ${category} rate limit for client. Reset in ${check.resetSeconds}s`);
    return NextResponse.json(
      {
        error: "Too many requests. Please wait a moment before trying again.",
        retryAfter: check.resetSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(check.resetSeconds),
          "X-RateLimit-Limit": String(check.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }
  return null;
}
