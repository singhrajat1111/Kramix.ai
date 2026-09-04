import { ChatMessage, LLMProvider, ModelCompletionResponse } from "@/types/ai";

export class GeminiProvider implements LLMProvider {
  type = "gemini" as const;
  name = "Google Gemini (1.5 Flash / Pro)";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = "gemini-1.5-flash") {
    this.apiKey = apiKey || "";
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    if (!this.isConfigured()) {
      return { success: false, message: "Google Gemini API key is missing or invalid." };
    }
    const start = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}?key=${this.apiKey.trim()}`;
      const res = await fetch(url);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.error?.message || `HTTP ${res.status}: Gemini connection failed`,
          latencyMs,
        };
      }

      return { success: true, message: "Google Gemini connection verified successfully.", latencyMs };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to contact Gemini API",
      };
    }
  }

  async generateCompletion(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<ModelCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error("Gemini API key is not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey.trim()}`;

    // Separate system instruction from conversational turns
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const systemInstruction = systemMessages.length > 0
      ? { parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }] }
      : undefined;

    const contents = conversationMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 1024,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini request failed with status ${res.status}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || "";

    return {
      content,
      provider: "gemini",
      model: this.model,
      finishReason: candidate?.finishReason,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }

  async generateStructuredJSON<T>(messages: ChatMessage[], schemaDescription?: string): Promise<T> {
    const jsonInstruction: ChatMessage = {
      role: "system",
      content: `CRITICAL: You must return valid, parseable JSON ONLY with no markdown backticks, explanations, or commentary.${
        schemaDescription ? ` Schema requirements:\n${schemaDescription}` : ""
      }`,
    };

    const res = await this.generateCompletion([jsonInstruction, ...messages], { temperature: 0.1 });
    let text = res.content.trim();
    if (text.startsWith("```json")) {
      text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse structured JSON from Gemini response: ${text.slice(0, 200)}...`);
    }
  }
}
