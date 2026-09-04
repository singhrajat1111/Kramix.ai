"use client";

import React from "react";
import { InterviewReport } from "@/types/evaluation";
import { Award, CheckCircle2, AlertTriangle, Building2, Calendar, Clock } from "lucide-react";

interface ScoreCardProps {
  report: InterviewReport;
}

export function ScoreCard({ report }: ScoreCardProps) {
  const { scoringBreakdown, overallScore } = report;

  const metrics = [
    { label: "Communication", score: scoringBreakdown.communication, color: "from-brand-500 to-indigo-500" },
    { label: "Technical Knowledge", score: scoringBreakdown.technicalKnowledge, color: "from-blue-500 to-cyan-500" },
    { label: "Problem Solving", score: scoringBreakdown.problemSolving, color: "from-emerald-500 to-teal-500" },
    { label: "Role Relevance", score: scoringBreakdown.roleRelevance, color: "from-purple-500 to-pink-500" },
    { label: "Confidence & Clarity", score: scoringBreakdown.confidenceAndClarity, color: "from-amber-500 to-orange-500" },
  ];

  const getBadgeColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    if (score >= 65) return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    return "text-rose-400 bg-rose-500/15 border-rose-500/30";
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-2xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <span className="text-xs uppercase font-mono text-brand-400 font-semibold tracking-wider">
            Official Simulation Debrief
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">
            {report.targetCompany} — {report.roundName}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              {report.targetRole}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              {report.durationMinutes} minutes elapsed
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {new Date(report.timestamp).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Overall Score Circle */}
        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-100 border border-slate-700/80 shadow-inner">
          <span className="text-[10px] uppercase font-mono text-slate-400">Composite Score</span>
          <div className="text-3xl font-extrabold text-white mt-0.5 flex items-baseline gap-1">
            <span>{overallScore}</span>
            <span className="text-xs text-slate-500 font-normal">/ 100</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border mt-1 ${getBadgeColor(overallScore)}`}>
            {overallScore >= 80 ? "STRONG PASS" : overallScore >= 68 ? "COMPETITIVE" : "NEEDS PRACTICE"}
          </span>
        </div>
      </div>

      {/* Sub-Score Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-slate-800 bg-surface-200/50 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 font-medium truncate">{m.label}</span>
              <span className="font-mono font-bold text-slate-200">{m.score}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${m.color} transition-all duration-500`}
                style={{ width: `${m.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Strengths & Weaknesses High-Level Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
          <h3 className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Demonstrated Strengths
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {report.strengths.map((str, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span className="leading-relaxed">{str}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <h3 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Areas for Growth
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {report.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span className="leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
