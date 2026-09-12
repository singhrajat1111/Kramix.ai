import { AIConfig } from "@/types/ai";
import { getUserByEmail, getUserById } from "./db";
import { decryptApiKey } from "./crypto";
import { detectProviderFromKey } from "./ai/factory";

export type InterviewModeResolution =
  | { mode: "live"; reason: "byok" }
  | { mode: "live"; reason: "credits" }
  | { mode: "live"; reason: "subscriber" }
  | { mode: "demo"; reason: "unauthenticated" | "out_of_credits" };

export interface UserAccessProfile {
  id?: string;
  email?: string;
  plan: "free" | "payg" | "subscriber" | string;
  credits: number;
  hasBYOK?: boolean;
  apiKeyEncrypted?: string | null;
}

/**
 * Authoritative Gating Logic: Demo vs. Live
 *
 * 1. BYOK (Bring Your Own Key):
 *    If the user has provided their own encrypted API key, they ALWAYS receive Live Mode,
 *    regardless of credit balance, because their executions do not consume platform credits.
 *
 * 2. Active Subscriber:
 *    Subscribers have unlimited/included live access.
 *
 * 3. Credit-Funded:
 *    Users on free/payg with credits > 0 receive Live Mode.
 *
 * 4. Demo Fallback:
 *    Unauthenticated users or users with 0 credits and no BYOK gracefully fall back
 *    to Zero-Key Demo Mode.
 */
export function resolveInterviewAccess(user: UserAccessProfile | null): InterviewModeResolution {
  if (!user) {
    return { mode: "demo", reason: "unauthenticated" };
  }

  // 1. BYOK always gets live mode regardless of credit balance
  if (user.hasBYOK || (user.apiKeyEncrypted && user.apiKeyEncrypted.trim().length > 0)) {
    return { mode: "live", reason: "byok" };
  }

  // 2. Active subscriber
  if (user.plan === "subscriber") {
    return { mode: "live", reason: "subscriber" };
  }

  // 3. User with credits
  if (user.credits > 0) {
    return { mode: "live", reason: "credits" };
  }

  // 4. Free plan with 0 credits and no BYOK
  return { mode: "demo", reason: "out_of_credits" };
}

/**
 * Backward-compatible helper returning simple 'demo' | 'live'
 */
export function resolveInterviewMode(user: UserAccessProfile | null): "demo" | "live" {
  return resolveInterviewAccess(user).mode;
}

/**
 * Server-side helper to determine the final AIConfig and active funding source
 * for API routes, safely decrypting server-stored keys on-the-fly.
 */
export async function getEffectiveServerAIConfig(
  clientConfig: AIConfig | undefined,
  sessionUser?: { id?: string; email?: string } | null
): Promise<{
  config: AIConfig;
  fundingSource: "byok" | "credits" | "subscriber" | "demo";
}> {
  // Case A: Client supplied a valid in-memory API key directly
  if (clientConfig && clientConfig.apiKey && clientConfig.provider !== "demo") {
    const resolvedProvider =
      clientConfig.provider === "universal"
        ? detectProviderFromKey(clientConfig.apiKey)
        : clientConfig.provider;
    return {
      config: {
        ...clientConfig,
        provider: resolvedProvider,
      },
      fundingSource: "byok",
    };
  }

  // Case B: Check database user record if authenticated
  if (sessionUser?.id || sessionUser?.email) {
    const dbUser = sessionUser.id
      ? await getUserById(sessionUser.id)
      : await getUserByEmail(sessionUser.email!);

    if (dbUser) {
      // 1. Check if user has an encrypted API key saved at rest
      if (dbUser.api_key_encrypted) {
        const decryptedKey = decryptApiKey(dbUser.api_key_encrypted);
        if (decryptedKey) {
          const detected = detectProviderFromKey(decryptedKey);
          const resolvedProvider =
            clientConfig?.provider &&
            clientConfig.provider !== "demo" &&
            clientConfig.provider !== "universal"
              ? clientConfig.provider
              : detected;
          return {
            config: {
              provider: resolvedProvider,
              apiKey: decryptedKey,
              model: clientConfig?.model,
            },
            fundingSource: "byok",
          };
        }
      }

      // 2. Check subscriber status
      if (dbUser.plan === "subscriber") {
        const serverKey =
          clientConfig?.provider === "groq"
            ? process.env.GROQ_API_KEY
            : clientConfig?.provider === "anthropic"
            ? process.env.ANTHROPIC_API_KEY
            : clientConfig?.provider === "openrouter"
            ? process.env.OPENROUTER_API_KEY
            : clientConfig?.provider === "openai"
            ? process.env.OPENAI_API_KEY
            : process.env.GEMINI_API_KEY;
        return {
          config: serverKey
            ? {
                provider: clientConfig?.provider || "gemini",
                apiKey: serverKey,
                model: clientConfig?.model,
              }
            : clientConfig || { provider: "demo" },
          fundingSource: "subscriber",
        };
      }

      // 3. Check credits balance
      if (dbUser.credits > 0) {
        const serverKey =
          clientConfig?.provider === "groq"
            ? process.env.GROQ_API_KEY
            : clientConfig?.provider === "anthropic"
            ? process.env.ANTHROPIC_API_KEY
            : clientConfig?.provider === "openrouter"
            ? process.env.OPENROUTER_API_KEY
            : clientConfig?.provider === "openai"
            ? process.env.OPENAI_API_KEY
            : process.env.GEMINI_API_KEY;
        return {
          config: serverKey
            ? {
                provider: clientConfig?.provider || "gemini",
                apiKey: serverKey,
                model: clientConfig?.model,
              }
            : clientConfig || { provider: "demo" },
          fundingSource: "credits",
        };
      }
    }
  }

  // Default fallback: Zero-Key Demo Mode
  return {
    config: { provider: "demo" },
    fundingSource: "demo",
  };
}
