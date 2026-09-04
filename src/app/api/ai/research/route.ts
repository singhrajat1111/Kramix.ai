import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/factory";
import { ResearchPlanner } from "@/lib/research/research-planner";
import { AIConfig } from "@/types/ai";
import { CandidateProfile } from "@/types/candidate";

export async function POST(req: NextRequest) {
  try {
    const { config, candidate } = (await req.json()) as {
      config: AIConfig;
      candidate: CandidateProfile;
    };

    if (!candidate || !candidate.targetRole || !candidate.targetCompanies?.[0]) {
      return NextResponse.json({ error: "Missing candidate target role or company" }, { status: 400 });
    }

    const provider = getLLMProvider(config || { provider: "demo" });
    const planner = new ResearchPlanner(candidate, provider);
    const plan = await planner.runPipeline();

    return NextResponse.json(plan);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research pipeline execution failed" },
      { status: 500 }
    );
  }
}
