"use client";

import React from "react";
import Link from "next/link";
import { PreparationPriority } from "@/types/evaluation";
import { Compass, CheckSquare, HelpCircle, ArrowRight, Printer, RotateCcw } from "lucide-react";

interface PreparationRoadmapProps {
  summary: string;
  priorities: PreparationPriority[];
  keyTakeaway: string;
}

export function PreparationRoadmap({
  summary,
  priorities,
  keyTakeaway,
}: PreparationRoadmapProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Compass className="h-4 w-4 text-brand-400" />
            Actionable Preparation Roadmap
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">{summary}</p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-surface-100 hover:bg-surface-200 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors no-print"
        >
          <Printer className="h-3.5 w-3.5 text-slate-400" />
          <span>Export / Print</span>
        </button>
      </div>

      {/* Priorities List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {priorities.map((item) => (
          <div
            key={item.priorityNumber}
            className="rounded-xl border border-slate-800 bg-surface-100/70 p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  Priority {item.priorityNumber}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white">{item.topic}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.reason}</p>

              {/* Action items */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <CheckSquare className="h-3 w-3 text-brand-400" /> Recommended Drills:
                </span>
                <ul className="space-y-1 text-xs text-slate-400">
                  {item.recommendedPractice.map((prac, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-brand-400">•</span>
                      <span>{prac}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suggested Questions */}
              {item.suggestedQuestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <HelpCircle className="h-3 w-3 text-emerald-400" /> Next Practice Question:
                  </span>
                  <div className="text-xs text-slate-300 italic rounded bg-surface-200/90 border border-slate-800 p-2.5">
                    &ldquo;{item.suggestedQuestions[0]}&rdquo;
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Key Takeaway Banner */}
      {keyTakeaway && (
        <div className="rounded-xl border border-brand-500/30 bg-gradient-to-r from-brand-600/10 via-brand-500/10 to-accent-purple/10 p-5 text-xs flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-brand-400 animate-pulse shrink-0" />
          <p className="text-slate-200 leading-relaxed font-medium">
            <strong className="text-brand-300">Key Recommendation: </strong>
            {keyTakeaway}
          </p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
        <Link
          href="/setup"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-surface-100 hover:bg-surface-200 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Setup Different Role / Company</span>
        </Link>

        <Link
          href="/research"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-500 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:translate-x-0.5"
        >
          <span>Practice Another Round</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
