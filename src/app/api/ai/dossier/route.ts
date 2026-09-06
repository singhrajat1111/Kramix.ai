import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLLMProvider } from "@/lib/ai/factory";
import { HiringCommitteeEngine } from "@/lib/committee/hiring-committee-engine";
import { getEffectiveServerAIConfig } from "@/lib/access";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parseSafeJSON, ValidationError } from "@/lib/security/validation";
import { AIConfig } from "@/types/ai";
import { InterviewSession } from "@/types/session";

export async function POST(req: NextRequest) {
  // Rate limit: 30 requests/minute
  const rateLimitResponse = enforceRateLimit(req, "ai");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawText = await req.text();
    const body = parseSafeJSON<{
      config?: AIConfig;
      session?: InterviewSession;
    }>(rawText, 100_000);

    const { config, session: interviewSession } = body;

    if (!interviewSession || !interviewSession.rounds || !Array.isArray(interviewSession.rounds)) {
      return NextResponse.json(
        { error: "Invalid interview session payload" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const { config: effectiveConfig } = await getEffectiveServerAIConfig(
      config,
      session?.user
    );

    const provider = getLLMProvider(effectiveConfig);
    const dossier = await HiringCommitteeEngine.generateDossier(interviewSession, provider);

    return NextResponse.json(dossier);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Dossier generation API failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to synthesize hiring committee dossier" },
      { status: 500 }
    );
  }
}
