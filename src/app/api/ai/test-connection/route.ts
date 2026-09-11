import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider, detectProviderFromKey } from "@/lib/ai/factory";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readSafeJsonBody } from "@/lib/security/validation";
import { AIConfig } from "@/types/ai";

export async function POST(req: NextRequest) {
  // Rate limit: 10 test connection requests / minute
  const rateLimitResponse = enforceRateLimit(req, "testConnection");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { data: body, error: bodyError } = await readSafeJsonBody<AIConfig>(req, 5000);
    if (bodyError || !body) {
      return NextResponse.json({ success: false, message: bodyError || "Invalid JSON payload" }, { status: 400 });
    }

    if (!body.apiKey && body.provider !== "demo") {
      return NextResponse.json(
        { success: false, message: "Please provide an API key to test connection." },
        { status: 400 }
      );
    }

    let provider = getLLMProvider(body);
    let result = await provider.testConnection();

    // If universal mode failed and provider was guessed, attempt the other major provider as fallback
    if (!result.success && body.provider === "universal" && body.apiKey) {
      const detected = detectProviderFromKey(body.apiKey);
      const alternate = detected === "gemini" ? "openai" : "gemini";
      const fallbackProvider = getLLMProvider({ ...body, provider: alternate });
      const fallbackResult = await fallbackProvider.testConnection();
      if (fallbackResult.success) {
        provider = fallbackProvider;
        result = fallbackResult;
      }
    }

    // Sanitize message to guarantee no raw keys or query parameters leak
    const cleanMessage = result.message
      ? result.message.replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]")
      : "Connection test completed";

    return NextResponse.json({
      ...result,
      provider: provider.type,
      providerName: provider.name,
      message: cleanMessage,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error testing AI provider connection",
      },
      { status: 500 }
    );
  }
}
