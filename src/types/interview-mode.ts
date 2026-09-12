import { AIConfig } from "./ai";

/**
 * Kramix.AI — Authoritative Interview Mode
 *
 * This is the single source of truth for determining whether an interview
 * runs in Demo mode (static question bank) or AI mode (dynamic LLM generation).
 *
 * ALL mode decisions throughout the application MUST use resolveInterviewMode().
 * Do NOT independently check apiKey or provider elsewhere.
 */

export type InterviewMode = "demo" | "ai";

/**
 * Resolves the interview mode from the user's AI configuration.
 *
 * Priority:
 *  1. If provider is explicitly "demo" → DEMO
 *  2. If no API key is provided → DEMO
 *  3. Otherwise → AI (dynamic question generation)
 */
export function resolveInterviewMode(aiConfig: AIConfig): InterviewMode {
  if (aiConfig.provider === "demo") return "demo";
  if (!aiConfig.apiKey || !aiConfig.apiKey.trim()) return "demo";
  return "ai";
}
