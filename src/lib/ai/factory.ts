import { AIConfig, LLMProvider } from "@/types/ai";
import { OpenAIProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";
import { DemoProvider } from "./demo-provider";

export function getLLMProvider(config: AIConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model || "gpt-4o-mini");
    case "gemini":
      return new GeminiProvider(config.apiKey, config.model || "gemini-1.5-flash");
    case "demo":
    default:
      return new DemoProvider();
  }
}
