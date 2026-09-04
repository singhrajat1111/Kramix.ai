"use client";

import React from "react";
import { HiringCommitteeDossier, HiringRecommendation } from "@/types/session";
import {
  Award,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  FileCheck2,
  Briefcase,
  ShieldCheck,
  ChevronRight,
  BookOpen,
} from "lucide-react";

interface HiringCommitteeDossierViewProps {
  dossier: HiringCommitteeDossier;
}

export function HiringCommitteeDossierView({ dossier }: HiringCommitteeDossierViewProps) {
  const getRecommendationBadge = (rec: HiringRecommendation) => {
    switch (rec) {
      case "STRONG HIRE":
        return {
          bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
          indicator: "bg-emerald-400 shadow-emerald-500/50",
          title: "Strong Hire",
          desc: "Consistently exceeded technical thresholds with clear architectural mastery and disciplined trade-off communication.",
        };
      case "LEAN HIRE":
        return {
          bg: "bg-sky-500/15 border-sky-500/40 text-sky-300",
          indicator: "bg-sky-400 shadow-sky-500/50",
          title: "Lean Hire",
          desc: "Demonstrated solid technical competence across required areas with minor gaps easily bridgeable on the job.",
        };
      case "LEAN NO HIRE":
        return {
          bg: "bg-amber-500/15 border-amber-500/40 text-amber-300",
          indicator: "bg-amber-400 shadow-amber-500/50",
          title: "Lean No Hire",
          desc: "Showed foundational capability but exhibited recurring gaps in high-throughput system design or edge-case isolation.",
        };
      case "STRONG NO HIRE":
      default:
        return {
          bg: "bg-rose-500/15 border-rose-500/40 text-rose-300",
          indicator: "bg-rose-400 shadow-rose-500/50",
          title: "Strong No Hire",
          desc: "Significant disconnect observed between target role expectations and demonstrated technical depth or communication.",
        };
    }
  };

  const recMeta = getRecommendationBadge(dossier.finalRecommendation);
  const scorecard = dossier.scorecard;

  const scoreItems = [
    { label: "Technical Competency", score: scorecard.technicalCompetency },
    { label: "Problem Solving", score: scorecard.problemSolving },
    { label: "System Design & Architecture", score: scorecard.systemDesign },
    { label: "Engineering Communication", score: scorecard.communication },
    { label: "Role Relevance", score: scorecard.roleRelevance },
    { label: "Behavioral & Leadership", score: scorecard.behavioral },
    { label: "Confidence & Clarity", score: scorecard.confidence },
  ].filter((item) => item.score !== undefined);

  return (
    <div className="space-y-8">
      {/* Header Dossier Metadata */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d121d] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 blur-[100px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-brand-400 font-bold">
              KRAMIX.AI · FINAL INTERVIEW DOSSIER
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Hiring Committee Calibration
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Cross-round synthesis for {dossier.targetRole} at {dossier.targetCompany} ({dossier.experienceLevel})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-slate-700/80 text-xs text-slate-300 font-mono">
              <Clock className="h-3.5 w-3.5 text-brand-400" />
              <span>{dossier.totalDurationMinutes}m total</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-slate-700/80 text-xs text-slate-300 font-mono">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>{dossier.roundsCompleted}/{dossier.totalRoundsPlanned} rounds</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-slate-700/80 text-xs text-slate-300 font-mono">
              <FileCheck2 className="h-3.5 w-3.5 text-sky-400" />
              <span>{dossier.questionsAnswered} questions</span>
            </div>
          </div>
        </div>

        {/* Committee Recommendation Banner */}
        <div className="mt-6 rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg ${recMeta.bg}">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full shadow-md ${recMeta.indicator}`} />
              <span className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400">
                Committee Recommendation
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white uppercase">
              {recMeta.title}
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              {recMeta.desc}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end justify-center border-t sm:border-t-0 sm:border-l border-slate-800/80 pt-3 sm:pt-0 sm:pl-6 shrink-0">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
              Composite Calibration
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-4xl font-black text-white font-mono">
                {scorecard.compositeScore}
              </span>
              <span className="text-sm font-semibold text-slate-500 font-mono">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Committee Scorecard & Round-by-Round Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hiring Committee Scorecard */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Hiring Committee Scorecard</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Deterministic Aggregation</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {scoreItems.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{item.label}</span>
                  <span className="font-mono font-bold text-white">{item.score} / 100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      item.score! >= 85
                        ? "bg-emerald-400"
                        : item.score! >= 75
                        ? "bg-sky-400"
                        : item.score! >= 60
                        ? "bg-amber-400"
                        : "bg-rose-400"
                    }`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Round-by-Round Performance Timeline */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Round-by-Round Performance</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {dossier.roundPerformances.length} Rounds Evaluated
              </span>
            </div>

            <div className="space-y-3">
              {dossier.roundPerformances.map((rp) => (
                <div
                  key={rp.roundNumber}
                  className="rounded-xl border border-slate-800/80 bg-surface-100/40 p-3.5 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-200 text-slate-400 border border-slate-700">
                        Round {rp.roundNumber}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{rp.roundTitle}</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{rp.keyTakeaway}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono">
                      <span
                        className={`text-sm font-bold ${
                          rp.score >= 85
                            ? "text-emerald-400"
                            : rp.score >= 75
                            ? "text-sky-400"
                            : rp.score >= 60
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {rp.score}
                      </span>
                      <span className="text-[10px] text-slate-500">/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights */}
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-mono text-emerald-400 uppercase block font-semibold">
                Best Performing Round
              </span>
              <span className="font-bold text-slate-200 truncate block mt-0.5">
                {dossier.bestRound.title} ({dossier.bestRound.score}/100)
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-mono text-amber-400 uppercase block font-semibold">
                Most Challenging Round
              </span>
              <span className="font-bold text-slate-200 truncate block mt-0.5">
                {dossier.mostChallengingRound.title} ({dossier.mostChallengingRound.score}/100)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hiring Committee Narrative */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d121d] p-6 sm:p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-800/80 pb-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-brand-400 font-bold">
            Executive Synthesis
          </span>
          <h3 className="text-lg font-bold text-white mt-1">Hiring Committee Narrative</h3>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            {dossier.narrative.executiveAssessment}
          </p>
        </div>

        {/* Strengths & Concerns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Demonstrated Strengths</span>
            </div>
            <div className="space-y-2">
              {dossier.narrative.strengths.map((str, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-300 leading-relaxed flex items-start gap-2"
                >
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{str}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Areas of Concern</span>
            </div>
            <div className="space-y-2">
              {dossier.narrative.concerns.map((con, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-300 leading-relaxed flex items-start gap-2"
                >
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{con}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Role Fit & Trajectory */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="rounded-xl border border-slate-800 bg-surface-100/40 p-4 text-xs space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
              Role Suitability Assessment
            </span>
            <p className="text-slate-300 leading-relaxed">{dossier.narrative.roleFit}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-surface-100/40 p-4 text-xs space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
              Improvement & Calibration Trajectory
            </span>
            <p className="text-slate-300 leading-relaxed">{dossier.narrative.improvementTrajectory}</p>
          </div>
        </div>

        {/* Evidence Notes */}
        {dossier.narrative.evidenceNotes && dossier.narrative.evidenceNotes.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand-400" />
              <span>Question-Level Grounded Evidence:</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {dossier.narrative.evidenceNotes.map((ev, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-slate-800/80 bg-surface-100/30 text-[11px] text-slate-300 flex items-start gap-2"
                >
                  <span
                    className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                      ev.impact === "positive" ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <div>
                    <strong className="text-white block font-mono text-[10px]">
                      {ev.roundTitle} {ev.questionNumber ? `(Q${ev.questionNumber})` : ""}
                    </strong>
                    <span className="text-slate-400">{ev.observation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Consolidated Preparation Roadmap */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d121d] p-6 sm:p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-800/80 pb-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-brand-400 font-bold">
            Targeted Action Plan
          </span>
          <h3 className="text-lg font-bold text-white mt-1">Cross-Round Preparation Roadmap</h3>
          <p className="text-xs text-slate-400 mt-1">
            Focus drills addressing recurring concerns across your simulated interview sessions.
          </p>
        </div>

        <div className="space-y-4">
          {dossier.preparationRoadmap.priorities.map((p) => (
            <div
              key={p.priorityNumber}
              className="rounded-xl border border-slate-800 bg-surface-100/50 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30">
                  PRIORITY {p.priorityNumber}
                </span>
                <span className="text-xs text-slate-400">High Leverage Drill</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white">{p.title}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.reason}</p>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Recommended Practice Drills:
                </span>
                <ul className="space-y-1 text-xs text-slate-400">
                  {p.practiceDrill.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {p.suggestedQuestion && (
                <div className="rounded-lg bg-[#0d121d] border border-slate-800/80 p-3 text-xs">
                  <span className="text-[10px] font-mono uppercase text-brand-400 font-bold block mb-1">
                    Simulation Drill Prompt:
                  </span>
                  <p className="text-slate-300 italic">&ldquo;{p.suggestedQuestion}&rdquo;</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Simulation Disclaimer */}
      <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-500">
        <p>
          <strong className="text-slate-400">Simulation-Based Recommendation:</strong> This evaluation is synthesized by Kramix.ai based on simulated interview responses and company research. It reflects engineering readiness indicators and does not constitute an official hiring decision by {dossier.targetCompany}.
        </p>
      </div>
    </div>
  );
}
