import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLLMProvider } from "@/lib/ai/factory";
import { ResearchPlanner } from "@/lib/research/research-planner";
import { getEffectiveServerAIConfig } from "@/lib/access";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parseSafeJSON, sanitizeString, ValidationError } from "@/lib/security/validation";
import { AIConfig } from "@/types/ai";
import { CandidateProfile } from "@/types/candidate";

export async function POST(req: NextRequest) {
  // Rate limit: 30 requests/minute
  const rateLimitResponse = enforceRateLimit(req, "ai");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawText = await req.text();
    const body = parseSafeJSON<{
      config?: AIConfig;
      candidate?: CandidateProfile;
    }>(rawText, 50_000);

    const { config, candidate } = body;

    if (!candidate || !candidate.targetRole || !candidate.targetCompanies?.[0]) {
      return NextResponse.json({ error: "Missing candidate target role or company" }, { status: 400 });
    }

    // Sanitize candidate input strings
    const sanitizedCandidate: CandidateProfile = {
      ...candidate,
      targetRole: sanitizeString(candidate.targetRole, 150),
      targetCompanies: candidate.targetCompanies.slice(0, 5).map((c) => sanitizeString(c, 150)),
      experienceLevel: (sanitizeString(candidate.experienceLevel || "Senior", 50) || "Senior") as CandidateProfile["experienceLevel"],
    };

    const session = await getServerSession(authOptions);
    const { config: effectiveConfig } = await getEffectiveServerAIConfig(
      config,
      session?.user
    );

    const provider = getLLMProvider(effectiveConfig);
    const planner = new ResearchPlanner(sanitizedCandidate, provider);
    const plan = await planner.runPipeline();

    return NextResponse.json(plan);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research pipeline execution failed" },
      { status: 500 }
    );
  }
}
