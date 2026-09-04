"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StorageManager } from "@/lib/storage/storage-manager";
import { AIConfig } from "@/types/ai";
import { CandidateProfile, DEFAULT_CANDIDATE_PROFILE } from "@/types/candidate";
import { ProviderSelector } from "@/components/setup/ProviderSelector";
import { CandidateForm } from "@/components/setup/CandidateForm";

export default function SetupPage() {
  const router = useRouter();
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: "demo" });
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>(DEFAULT_CANDIDATE_PROFILE);
  const [activeSession, setActiveSession] = useState<import("@/types/session").InterviewSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from storage to survive page refreshes
    setAiConfig(StorageManager.getAIConfig());
    setCandidateProfile(StorageManager.getCandidateProfile());
    const session = StorageManager.getInterviewSession();
    if (session && !session.sessionCompletedAt && session.overallProgress < 100) {
      setActiveSession(session);
    }
    setIsLoaded(true);
  }, []);

  const handleAIConfigChange = (newConfig: AIConfig) => {
    setAiConfig(newConfig);
    StorageManager.saveAIConfig(newConfig);
  };

  const handleStartOver = () => {
    StorageManager.clearInterviewSession();
    StorageManager.clearActiveSession();
    setActiveSession(null);
  };

  const handleResume = () => {
    if (!activeSession) return;
    const currentRound = activeSession.rounds[activeSession.currentRoundIndex];
    if (currentRound) {
      StorageManager.saveSelectedRound({
        id: currentRound.roundId,
        roundNumber: currentRound.roundNumber,
        name: currentRound.title,
        category: currentRound.category,
        description: currentRound.description,
        typicalDurationMinutes: currentRound.estimatedDuration,
        focusAreas: currentRound.competencies,
        sampleQuestions: [],
      });
    }
    router.push("/interview");
  };

  const handleProfileSubmit = (newProfile: CandidateProfile) => {
    setCandidateProfile(newProfile);
    StorageManager.saveCandidateProfile(newProfile);
    // Move to research phase
    router.push("/research");
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="h-6 w-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div>
        <span className="text-xs uppercase font-mono font-semibold text-brand-400">Step 1 of 4</span>
        <h1 className="text-2xl font-bold text-white mt-1">Configure Interview & Candidate</h1>
        <p className="text-xs text-slate-400 mt-1">
          Select your AI provider and specify the company and role you are preparing for.
        </p>
      </div>

      {/* Active Session In-Progress Banner */}
      {activeSession && (
        <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-brand-500/5">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase font-bold text-brand-400">
              Interview In Progress · Round {activeSession.currentRoundIndex + 1} of {activeSession.rounds.length}
            </span>
            <h3 className="text-sm font-bold text-white">
              {activeSession.rounds[activeSession.currentRoundIndex]?.title || "Active Round"}
            </h3>
            <p className="text-xs text-slate-300">
              {activeSession.targetCompany} · {activeSession.targetRole}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleStartOver}
              className="text-xs text-slate-400 hover:text-white px-3.5 py-2 rounded-lg border border-slate-700 bg-surface-100 transition-colors"
            >
              Start Over
            </button>
            <button
              type="button"
              onClick={handleResume}
              className="text-xs font-semibold text-white px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 shadow-md shadow-brand-500/25 transition-all hover:scale-[1.02]"
            >
              Resume Interview
            </button>
          </div>
        </div>
      )}

      {/* AI Provider Config */}
      <ProviderSelector config={aiConfig} onChange={handleAIConfigChange} />

      {/* Candidate Profile Form */}
      <CandidateForm initialProfile={candidateProfile} onSubmit={handleProfileSubmit} />
    </div>
  );
}
