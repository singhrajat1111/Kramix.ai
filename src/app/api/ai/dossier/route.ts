import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/factory";
import { HiringCommitteeEngine } from "@/lib/committee/hiring-committee-engine";
import { AIConfig } from "@/types/ai";
import { InterviewSession } from "@/types/session";

export async function POST(req: NextRequest) {
  try {
    const { config, session } = (await req.json()) as {
      config: AIConfig;
      session: InterviewSession;
    };

    if (!session || !session.rounds) {
      return NextResponse.json(
        { error: "Invalid interview session payload" },
        { status: 400 }
      );
    }

    const provider = getLLMProvider(config || { provider: "demo" });
    const dossier = await HiringCommitteeEngine.generateDossier(session, provider);

    return NextResponse.json(dossier);
  } catch (err: unknown) {
    console.error("Dossier generation API failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to synthesize hiring committee dossier" },
      { status: 500 }
    );
  }
}
