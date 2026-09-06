import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/factory";
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

    const provider = getLLMProvider(body);
    const result = await provider.testConnection();

    // Sanitize message to guarantee no raw keys or query parameters leak
    const cleanMessage = result.message
      ? result.message.replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]")
      : "Connection test completed";

    return NextResponse.json({ ...result, message: cleanMessage });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error testing AI provider connection",
      },
      { status: 500 }
    );
  }
}
