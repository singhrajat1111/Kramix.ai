import { AIConfig, LLMProvider } from "@/types/ai";
import { OpenAIProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import { DemoProvider } from "./demo-provider";

export type DetectedLiveProvider = "gemini" | "openai" | "openrouter";

/**
 * Universal key pattern detector.
 * Identifies provider based on key signatures:
 * - Google Gemini: AIzaSy... (or Google Cloud API key format)
 * - OpenRouter: sk-or-v1-...
 * - OpenAI: sk-... (including sk-proj-...)
 */
export function detectProviderFromKey(apiKey?: string): DetectedLiveProvider {
  if (!apiKey) return "gemini";
  const key = apiKey.trim();
  if (key.startsWith("AIza")) {
    return "gemini";
  }
  if (key.startsWith("sk-or-")) {
    return "openrouter";
  }
  if (key.startsWith("sk-")) {
    return "openai";
  }
  // Default heuristic fallback
  if (key.length >= 35 && !key.startsWith("sk-")) {
    return "gemini";
  }
  return "openai";
}

export function getLLMProvider(config: AIConfig): LLMProvider {
  const resolvedProvider =
    config.provider === "universal" || !config.provider
      ? detectProviderFromKey(config.apiKey)
      : config.provider;

  switch (resolvedProvider) {
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model || "gpt-4o-mini");
    case "gemini":
      return new GeminiProvider(config.apiKey, config.model || "gemini-1.5-flash");
    case "openrouter":
      return new OpenRouterProvider(config.apiKey, config.model || "google/gemini-flash-1.5");
    case "demo":
    default:
      return new DemoProvider();
  }
}
