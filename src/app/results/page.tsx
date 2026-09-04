"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StorageManager } from "@/lib/storage/storage-manager";
import { InterviewReport } from "@/types/evaluation";
import { HiringCommitteeDossier, InterviewSession } from "@/types/session";
import { ScoreCard } from "@/components/results/ScoreCard";
import { QuestionReview } from "@/components/results/QuestionReview";
import { PreparationRoadmap } from "@/components/results/PreparationRoadmap";
import { HiringCommitteeDossierView } from "@/components/results/HiringCommitteeDossierView";
import { Sparkles, ArrowRight, HelpCircle, Layers, Award, RotateCcw } from "lucide-react";

export default function ResultsPage() {
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [dossier, setDossier] = useState<HiringCommitteeDossier | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [activeTab, setActiveTab] = useState<"dossier" | "round_debrief">("dossier");
  const [isLoaded, setIsLoaded] = useState(false);

  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  useEffect(() => {
    const loadedReport = StorageManager.getLatestReport();
    const loadedDossier = StorageManager.getLatestDossier();
    const loadedSession = StorageManager.getInterviewSession();
    const aiConfig = StorageManager.getAIConfig();
    setIsDemoMode(aiConfig.provider === "demo" || !aiConfig.apiKey);

    if (loadedReport) setReport(loadedReport);
    if (loadedDossier) setDossier(loadedDossier);
    if (loadedSession) setSession(loadedSession);

    // Default to dossier view if a dossier exists, otherwise round debrief
    if (loadedDossier) {
      setActiveTab("dossier");
    } else {
      setActiveTab("round_debrief");
    }
    setIsLoaded(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="h-6 w-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!report && !dossier) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-surface-100 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-white">No Evaluation Report Found</h1>
        <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
          You haven&apos;t completed an interview simulation session yet. Configure your candidate profile and complete an interview to generate an actionable debrief.
        </p>
        <Link
          href="/setup"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-500 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/20"
        >
          <span>Start Interview Preparation</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header & View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 px-3 py-1 text-[11px] font-semibold text-brand-300">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              <span>Simulation Concluded · Performance Evaluation</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                isDemoMode
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              }`}
            >
              {isDemoMode ? "DEMO MODE" : "LIVE"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            {activeTab === "dossier" ? "Hiring Committee Dossier" : "Round Performance Review"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === "dossier"
              ? "Comprehensive multi-round hiring recommendation and cross-round competency scorecard."
              : "Question-by-question analysis and targeted competency breakdown for this round."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-surface-100 hover:bg-surface-200 px-3.5 py-2 text-xs font-medium text-slate-300 transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Practice Rounds</span>
          </Link>

          <Link
            href="/setup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>New Simulation</span>
          </Link>
        </div>
      </div>

      {/* View Switcher Tabs (if both dossier and round report exist) */}
      {dossier && report && (
        <div className="flex border-b border-slate-800 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("dossier")}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === "dossier"
                ? "border-brand-500 text-brand-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Hiring Committee Dossier</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("round_debrief")}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === "round_debrief"
                ? "border-brand-500 text-brand-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Round Question Review ({report.roundName})</span>
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === "dossier" && dossier ? (
        <HiringCommitteeDossierView dossier={dossier} />
      ) : report ? (
        <div className="space-y-8">
          {/* 1. High Level Scorecard */}
          <ScoreCard report={report} />

          {/* 2. Question by Question Review */}
          <QuestionReview evaluations={report.questionEvaluations} />

          {/* 3. Actionable Preparation Plan */}
          <PreparationRoadmap
            summary={report.actionablePlan.summary}
            priorities={report.actionablePlan.priorities}
            keyTakeaway={report.actionablePlan.keyTakeaway}
          />
        </div>
      ) : null}
    </div>
  );
}
