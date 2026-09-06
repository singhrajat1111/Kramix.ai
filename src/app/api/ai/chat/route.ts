import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLLMProvider } from "@/lib/ai/factory";
import { getEffectiveServerAIConfig } from "@/lib/access";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parseSafeJSON, sanitizeString, ValidationError } from "@/lib/security/validation";
import { AIConfig, ChatMessage } from "@/types/ai";

export async function POST(req: NextRequest) {
  // Rate limit: 30 requests/minute
  const rateLimitResponse = enforceRateLimit(req, "ai");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawText = await req.text();
    const body = parseSafeJSON<{
      config?: AIConfig;
      messages?: ChatMessage[];
    }>(rawText, 50_000);

    const { config, messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing or invalid messages array" }, { status: 400 });
    }

    if (messages.length > 50) {
      return NextResponse.json({ error: "Messages array exceeds maximum allowed length (50)" }, { status: 400 });
    }

    // Sanitize message content to prevent prompt injection and control sequence exploits
    const sanitizedMessages: ChatMessage[] = messages.map((m) => ({
      role: m.role === "assistant" || m.role === "system" ? m.role : "user",
      content: sanitizeString(m.content, 8000),
    }));

    const session = await getServerSession(authOptions);
    const { config: effectiveConfig } = await getEffectiveServerAIConfig(
      config,
      session?.user
    );

    const provider = getLLMProvider(effectiveConfig);
    const response = await provider.generateCompletion(sanitizedMessages);
    return NextResponse.json(response);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI completion failed" },
      { status: 500 }
    );
  }
}
