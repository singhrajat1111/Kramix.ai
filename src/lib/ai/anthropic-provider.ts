import { ChatMessage, LLMProvider, ModelCompletionResponse } from "@/types/ai";

export class AnthropicProvider implements LLMProvider {
  type = "anthropic" as const;
  name = "Anthropic (Claude 3.5 Haiku / Sonnet)";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = "claude-3-5-haiku-20241022") {
    this.apiKey = apiKey || "";
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().startsWith("sk-ant-"));
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    if (!this.apiKey || !this.apiKey.trim()) {
      return { success: false, message: "Anthropic API key is missing." };
    }
    const start = Date.now();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.error?.message || `HTTP ${res.status}: Anthropic authentication failed`,
          latencyMs,
        };
      }

      return {
        success: true,
        message: "Anthropic Claude connection verified successfully.",
        latencyMs,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to contact Anthropic API endpoint",
      };
    }
  }

  async generateCompletion(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<ModelCompletionResponse> {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error("Anthropic API key is not configured");
    }

    // Anthropic extracts system prompt to top-level parameter
    const systemMessages = messages.filter((m) => m.role === "system");
    const systemPrompt = systemMessages.map((m) => m.content).join("\n\n");

    const nonSystem = messages.filter((m) => m.role !== "system");
    // Merge consecutive messages with the same role (Anthropic requirement)
    const formattedMessages: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of nonSystem) {
      const role = msg.role === "assistant" ? "assistant" : "user";
      if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === role) {
        formattedMessages[formattedMessages.length - 1].content += `\n\n${msg.content}`;
      } else {
        formattedMessages.push({ role, content: msg.content });
      }
    }

    if (formattedMessages.length === 0) {
      formattedMessages.push({ role: "user", content: "Hello" });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.7,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: formattedMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic request failed with status ${res.status}`);
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";

    return {
      content,
      provider: "anthropic",
      model: this.model,
      finishReason: data.stop_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
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
      throw new Error(`Failed to parse structured JSON from Anthropic response: ${text.slice(0, 200)}...`);
    }
  }
}
