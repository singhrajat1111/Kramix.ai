import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/factory";
import { AIConfig, ChatMessage } from "@/types/ai";

export async function POST(req: NextRequest) {
  try {
    const { config, messages } = (await req.json()) as {
      config: AIConfig;
      messages: ChatMessage[];
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing or invalid messages array" }, { status: 400 });
    }

    const provider = getLLMProvider(config || { provider: "demo" });
    const response = await provider.generateCompletion(messages);
    return NextResponse.json(response);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI completion failed" },
      { status: 500 }
    );
  }
}
