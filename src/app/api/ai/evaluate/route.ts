import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/factory";
import { InterviewDirector } from "@/lib/director/interview-director";
import { AIConfig } from "@/types/ai";
import { CandidateProfile } from "@/types/candidate";
import { InterviewRoundInfo, ResearchPlan } from "@/types/research";
import { CandidateAnswer } from "@/types/interview";

export async function POST(req: NextRequest) {
  try {
    const { config, candidate, researchPlan, selectedRound, candidateResponses, elapsedSeconds } = (await req.json()) as {
      config: AIConfig;
      candidate: CandidateProfile;
      researchPlan: ResearchPlan;
      selectedRound: InterviewRoundInfo;
      candidateResponses: CandidateAnswer[];
      elapsedSeconds: number;
    };

    const provider = getLLMProvider(config || { provider: "demo" });
    const director = new InterviewDirector(candidate, researchPlan, selectedRound, provider);

    // Populate responses and elapsed time in director
    director.updateElapsedSeconds(elapsedSeconds || 600);
    if (candidateResponses && candidateResponses.length > 0) {
      for (const resp of candidateResponses) {
        await director.processCandidateAnswer(resp.candidateSpeech);
      }
    }

    const report = await director.generateFinalEvaluation();
    return NextResponse.json(report);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Evaluation failed" },
      { status: 500 }
    );
  }
}
