export type LLMProviderType = "openai" | "gemini" | "openrouter" | "universal" | "demo";

export interface AIConfig {
  provider: LLMProviderType;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useDemoFallback?: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface ModelCompletionResponse {
  content: string;
  provider: LLMProviderType;
  model: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMProvider {
  type: LLMProviderType;
  name: string;
  isConfigured(): boolean;
  testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }>;
  generateCompletion(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<ModelCompletionResponse>;
  generateStructuredJSON<T>(messages: ChatMessage[], schemaDescription?: string): Promise<T>;
}
