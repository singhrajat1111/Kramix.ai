"use client";

import React from "react";
import { QuestionEvaluation } from "@/types/evaluation";
import { CheckCircle2, AlertCircle, Sparkles, HelpCircle } from "lucide-react";

interface QuestionReviewProps {
  evaluations: QuestionEvaluation[];
}

export function QuestionReview({ evaluations }: QuestionReviewProps) {
  if (!evaluations || evaluations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl space-y-6">
      <div className="border-b border-slate-800/80 pb-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-brand-400" />
          Question-by-Question Deep Dive
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Detailed review of each inquiry, evaluating your reasoning, omissions, and targeted improvements.
        </p>
      </div>

      <div className="space-y-4">
        {evaluations.map((ev, index) => (
          <div
            key={ev.questionId || index}
            className="rounded-xl border border-slate-800/90 bg-surface-100/60 p-5 space-y-4 hover:border-slate-700 transition-colors"
          >
            {/* Question Header & Score */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-semibold border border-brand-500/30">
                  Q{index + 1}
                </span>
                <span className="text-xs text-slate-400 font-medium">{ev.topicTag || "Technical Exploration"}</span>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className="text-xs text-slate-400 font-mono">Performance:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  {ev.scoreOutOfTen.toFixed(1)} / 10
                </span>
              </div>
            </div>

            {/* Question Prompt */}
            <div>
              <p className="text-sm font-medium text-slate-100 leading-snug">
                &ldquo;{ev.questionText}&rdquo;
              </p>
            </div>

            {/* Candidate summary answer */}
            {ev.candidateAnswer && (
              <div className="rounded-lg bg-surface-200/80 border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed italic">
                <span className="not-italic text-slate-500 font-medium block text-[10px] uppercase font-mono mb-1">
                  Candidate Response Summary:
                </span>
                {ev.candidateAnswer}
              </div>
            )}

            {/* What Went Well vs What Could Improve */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                <span className="font-semibold text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  What Went Well
                </span>
                <ul className="space-y-1 text-slate-300">
                  {ev.whatWentWell.map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
                <span className="font-semibold text-amber-300 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                  What Could Improve
                </span>
                <ul className="space-y-1 text-slate-300">
                  {ev.whatCouldImprove.map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Ideal Direction */}
            {ev.idealDirection && (
              <div className="rounded-lg border border-brand-500/25 bg-brand-500/5 p-3 text-xs">
                <span className="font-semibold text-brand-300 flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                  Recommended Ideal Direction
                </span>
                <p className="text-slate-300 leading-relaxed">{ev.idealDirection}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
