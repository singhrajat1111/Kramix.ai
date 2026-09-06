"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StorageManager } from "@/lib/storage/storage-manager";
import { getLLMProvider } from "@/lib/ai/factory";
import { ResearchPlanner } from "@/lib/research/research-planner";
import { CandidateProfile, DEFAULT_CANDIDATE_PROFILE } from "@/types/candidate";
import { InterviewRoundInfo, ResearchFlag, ResearchPlan, ResearchProgressState } from "@/types/research";
import { InterviewSession, InterviewRoundSession } from "@/types/session";
import { ResearchProgress } from "@/components/research/ResearchProgress";
import { RoundSelector } from "@/components/research/RoundSelector";
import { RouteGuard } from "@/components/common/RouteGuard";
import { RefreshCw } from "lucide-react";

export default function ResearchPage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateProfile>(DEFAULT_CANDIDATE_PROFILE);
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ResearchProgressState>({
    currentFlag: "RESEARCH_COMPANY",
    completedFlags: [],
    percent: 0,
    statusMessage: "Initializing research pipeline...",
  });

  useEffect(() => {
    const loadedCandidate = StorageManager.getCandidateProfile();
    setCandidate(loadedCandidate);

    const cachedPlan = StorageManager.getResearchPlan();
    // If cached plan matches current role & company, use it directly
    if (
      cachedPlan &&
      cachedPlan.targetCompany === loadedCandidate.targetCompanies[0] &&
      cachedPlan.targetRole === loadedCandidate.targetRole
    ) {
      setPlan(cachedPlan);
      setLoading(false);
    } else {
      executeResearch(loadedCandidate);
    }
  }, []);

  const executeResearch = async (activeCandidate: CandidateProfile) => {
    setLoading(true);
    setPlan(null);

    const aiConfig = StorageManager.getAIConfig();
    const provider = getLLMProvider(aiConfig);
    const planner = new ResearchPlanner(activeCandidate, provider);

    try {
      const generatedPlan = await planner.runPipeline((state) => {
        setProgress(state);
      });

      setPlan(generatedPlan);
      StorageManager.saveResearchPlan(generatedPlan);
    } catch (e) {
      console.error("Research pipeline failure", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRound = (round: InterviewRoundInfo, mode: "FULL_SIMULATION" | "PRACTICE_ROUND") => {
    if (!plan) return;

    const roundsSession: InterviewRoundSession[] = plan.rounds.map((r, i) => ({
      roundId: r.id,
      roundNumber: i + 1,
      title: r.name,
      category: r.category,
      description: r.description,
      competencies: r.focusAreas,
      estimatedDuration: r.typicalDurationMinutes,
      difficulty: plan.blueprint?.difficultyRange || "Senior",
      status:
        (mode === "FULL_SIMULATION" && i === 0) || (mode === "PRACTICE_ROUND" && r.id === round.id)
          ? "IN_PROGRESS"
          : "NOT_STARTED",
      questionsAsked: 0,
      answers: [],
    }));

    const targetRound = mode === "FULL_SIMULATION" ? plan.rounds[0] || round : round;
    const targetIndex =
      mode === "FULL_SIMULATION"
        ? 0
        : plan.rounds.findIndex((r) => r.id === round.id);

    const session: InterviewSession = {
      sessionId: `session_${Date.now()}`,
      candidateProfile: candidate,
      targetCompany: plan.targetCompany,
      targetRole: plan.targetRole,
      experienceLevel: candidate.experienceLevel || "Mid Level",
      interviewPlan: plan,
      simulationMode: mode,
      currentRoundIndex: targetIndex >= 0 ? targetIndex : 0,
      rounds: roundsSession,
      roundResults: [],
      totalQuestions: (plan.blueprint?.questionBudget || 4) * roundsSession.length,
      totalAnsweredQuestions: 0,
      sessionStartedAt: Date.now(),
      overallProgress: 0,
    };

    StorageManager.saveInterviewSession(session);
    StorageManager.saveSelectedRound(targetRound);
    router.push("/device-check");
  };

  return (
    <RouteGuard>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <span className="text-xs uppercase font-mono font-semibold text-brand-400">Step 2 of 4</span>
            <h1 className="text-2xl font-bold text-white mt-1">
              Research & Interview Structure
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Flag-based company intelligence and interview round identification.
            </p>
          </div>

          {!loading && plan && (
            <button
              type="button"
              onClick={() => executeResearch(candidate)}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-surface-100 hover:bg-surface-200 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Re-run Research</span>
            </button>
          )}
        </div>

        {loading && (
          <div className="py-8">
            <ResearchProgress
              currentFlag={progress.currentFlag}
              completedFlags={progress.completedFlags as ResearchFlag[]}
              percent={progress.percent}
              statusMessage={progress.statusMessage}
              currentQuery={progress.currentQuery}
              sourcesFoundCount={progress.sourcesFoundCount}
            />
          </div>
        )}

        {!loading && plan && (
          <RoundSelector researchPlan={plan} onSelectRound={handleSelectRound} />
        )}
      </div>
    </RouteGuard>
  );
}
