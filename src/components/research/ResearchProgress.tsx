"use client";

import React from "react";
import { ResearchFlag } from "@/types/research";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";

interface ResearchProgressProps {
  currentFlag: ResearchFlag | null;
  completedFlags: ResearchFlag[];
  percent: number;
  statusMessage: string;
  currentQuery?: string;
  sourcesFoundCount?: number;
}

const FLAGS_ORDER: { flag: ResearchFlag; label: string }[] = [
  { flag: "RESEARCH_COMPANY", label: "Analyze Company Engineering Culture" },
  { flag: "RESEARCH_ROLE", label: "Map Role Expectations & Bar" },
  { flag: "RESEARCH_INTERVIEW_ROUNDS", label: "Discover Interview Stages" },
  { flag: "RESEARCH_SKILLS", label: "Compile Required Technical Skills" },
  { flag: "RESEARCH_QUESTIONS", label: "Mine Question Categories" },
  { flag: "RESEARCH_BEHAVIORAL", label: "Extract Leadership Principles (STAR)" },
  { flag: "RESEARCH_TECHNICAL", label: "Structure Architecture & Coding Focus" },
  { flag: "BUILD_INTERVIEW_PLAN", label: "Synthesize Evidence-Backed Plan" },
];

export function ResearchProgress({
  currentFlag,
  completedFlags,
  percent,
  statusMessage,
  currentQuery,
  sourcesFoundCount,
}: ResearchProgressProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-2xl max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Researching Interview Context</h2>
            <p className="text-xs text-slate-400">{statusMessage || "Running modular investigation flags..."}</p>
          </div>
        </div>

        {typeof sourcesFoundCount === "number" && sourcesFoundCount > 0 && (
          <span className="text-[10px] font-mono font-semibold px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {sourcesFoundCount} sources gathered
          </span>
        )}
      </div>

      {/* Live query display */}
      {currentQuery && (
        <div className="mb-4 rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-400 flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-brand-400 shrink-0">Query:</span>
          <span className="truncate text-slate-300">{currentQuery}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
          <span>Pipeline Progress</span>
          <span className="font-mono text-brand-400">{percent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-accent-purple transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Step Flag List */}
      <div className="space-y-3">
        {FLAGS_ORDER.map(({ flag, label }) => {
          const isDone = completedFlags.includes(flag);
          const isCurrent = currentFlag === flag;

          return (
            <div
              key={flag}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs transition-all ${
                isDone
                  ? "bg-slate-800/40 text-slate-300 border border-slate-800/60"
                  : isCurrent
                  ? "bg-brand-500/15 text-brand-200 border border-brand-500/40 ring-1 ring-brand-500/30 font-medium"
                  : "text-slate-500 opacity-60"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 text-brand-400 animate-spin shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-600 shrink-0" />
              )}
              <span className="flex-1 font-mono">{label}</span>
              {isDone && <span className="text-[10px] text-emerald-400 font-mono">COMPLETE</span>}
              {isCurrent && <span className="text-[10px] text-brand-400 font-mono animate-pulse">RUNNING</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
