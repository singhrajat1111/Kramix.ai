import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLLMProvider } from "@/lib/ai/factory";
import { InterviewDirector } from "@/lib/director/interview-director";
import { getEffectiveServerAIConfig } from "@/lib/access";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parseSafeJSON, validateCandidateSpeech, ValidationError } from "@/lib/security/validation";
import { AIConfig } from "@/types/ai";
import { CandidateProfile } from "@/types/candidate";
import { InterviewRoundInfo, ResearchPlan } from "@/types/research";
import { CandidateAnswer } from "@/types/interview";

export async function POST(req: NextRequest) {
  // Rate limit: 30 requests/minute
  const rateLimitResponse = enforceRateLimit(req, "ai");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawText = await req.text();
    const body = parseSafeJSON<{
      config?: AIConfig;
      candidate?: CandidateProfile;
      researchPlan?: ResearchPlan;
      selectedRound?: InterviewRoundInfo;
      candidateResponses?: CandidateAnswer[];
      elapsedSeconds?: number;
    }>(rawText, 100_000);

    const { config, candidate, researchPlan, selectedRound, candidateResponses, elapsedSeconds } = body;

    if (!candidate || !researchPlan || !selectedRound) {
      return NextResponse.json({ error: "Missing required evaluation payload entities" }, { status: 400 });
    }

    // Sanitize candidate responses to protect evaluation against prompt injection
    const sanitizedResponses: CandidateAnswer[] = (candidateResponses || []).slice(0, 50).map((r) => ({
      ...r,
      candidateSpeech: validateCandidateSpeech(r.candidateSpeech, 8000),
    }));

    const session = await getServerSession(authOptions);
    const { config: effectiveConfig } = await getEffectiveServerAIConfig(
      config,
      session?.user
    );

    const provider = getLLMProvider(effectiveConfig);
    const director = new InterviewDirector(candidate, researchPlan, selectedRound, provider);

    // Populate responses and elapsed time in director
    director.updateElapsedSeconds(Math.min(Math.max(0, elapsedSeconds || 600), 7200)); // cap at 2 hours max
    if (sanitizedResponses.length > 0) {
      for (const resp of sanitizedResponses) {
        await director.processCandidateAnswer(resp.candidateSpeech);
      }
    }

    const report = await director.generateFinalEvaluation();
    return NextResponse.json(report);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Evaluation failed" },
      { status: 500 }
    );
  }
}
