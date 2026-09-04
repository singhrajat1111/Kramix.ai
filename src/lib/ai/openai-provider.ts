import { ChatMessage, LLMProvider, ModelCompletionResponse } from "@/types/ai";

export class OpenAIProvider implements LLMProvider {
  type = "openai" as const;
  name = "OpenAI (GPT-4o / GPT-4o-mini)";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = "gpt-4o-mini") {
    this.apiKey = apiKey || "";
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().startsWith("sk-"));
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    if (!this.isConfigured()) {
      return { success: false, message: "OpenAI API key is missing or invalid format (should start with sk-)." };
    }
    const start = Date.now();
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${this.apiKey.trim()}`,
        },
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.error?.message || `HTTP ${res.status}: Connection failed`,
          latencyMs,
        };
      }

      return { success: true, message: "OpenAI connection verified successfully.", latencyMs };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to contact OpenAI API endpoint",
      };
    }
  }

  async generateCompletion(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<ModelCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error("OpenAI API key is not configured");
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI request failed with status ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    return {
      content,
      provider: "openai",
      model: this.model,
      finishReason: data.choices?.[0]?.finish_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async generateStructuredJSON<T>(messages: ChatMessage[], schemaDescription?: string): Promise<T> {
    const jsonInstruction: ChatMessage = {
      role: "system",
      content: `CRITICAL: You must return valid, parseable JSON ONLY with no surrounding markdown backticks or commentary.${
        schemaDescription ? ` Schema requirements:\n${schemaDescription}` : ""
      }`,
    };

    const res = await this.generateCompletion([jsonInstruction, ...messages], { temperature: 0.2 });
    let text = res.content.trim();
    if (text.startsWith("```json")) {
      text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse structured JSON from OpenAI response: ${text.slice(0, 200)}...`);
    }
  }
}
