"use client";

import React, { useState } from "react";
import { InterviewRoundInfo, ResearchPlan, SourceTier, EvidenceClassification } from "@/types/research";
import {
  ArrowRight,
  Clock,
  CheckCircle2,
  ShieldCheck,
  FileText,
  ExternalLink,
  AlertTriangle,
  Flame,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";

interface RoundSelectorProps {
  researchPlan: ResearchPlan;
  onSelectRound: (round: InterviewRoundInfo, mode: "FULL_SIMULATION" | "PRACTICE_ROUND") => void;
}

export function RoundSelector({ researchPlan, onSelectRound }: RoundSelectorProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    researchPlan.rounds[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<"rounds" | "brief" | "claims" | "sources">("rounds");

  const selectedRound = researchPlan.rounds.find((r) => r.id === selectedRoundId) || researchPlan.rounds[0];

  const getTierBadge = (tier?: SourceTier) => {
    if (tier === 1) {
      return (
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Tier 1 · Official
        </span>
      );
    }
    if (tier === 2) {
      return (
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
          Tier 2 · Industry
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
        Tier 3 · Community
      </span>
    );
  };

  const getClassificationBadge = (classification?: EvidenceClassification) => {
    switch (classification) {
      case "VERIFIED":
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            VERIFIED
          </span>
        );
      case "SUPPORTED":
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
            SUPPORTED
          </span>
        );
      case "INFERRED":
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
            INFERRED
          </span>
        );
      case "UNKNOWN":
      default:
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
            UNKNOWN
          </span>
        );
    }
  };

  const brief = researchPlan.candidateBriefSummary;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-brand-400 font-mono font-semibold">
                Research & Evidence Synthesis
              </span>
              {researchPlan.isLiveSearch ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE RESEARCH
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                  DEMO RESEARCH
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-white mt-1">
              {researchPlan.targetCompany} — {researchPlan.targetRole}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {researchPlan.companyOverview.summary}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 border ${
                researchPlan.isRealResearch
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/30"
              }`}
            >
              <ShieldCheck className={`h-3 w-3 ${researchPlan.isRealResearch ? "text-emerald-400" : "text-amber-400"}`} />
              {researchPlan.isRealResearch
                ? "Grounded Evidence Available"
                : "Curated Knowledge Baseline"}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {researchPlan.sources.length} sources analyzed · {researchPlan.claims?.length || 0} claims audited
            </span>
          </div>
        </div>

        {/* Culture & Focus Tags */}
        <div className="pt-4 flex flex-wrap gap-2 items-center text-xs">
          <span className="text-slate-400 font-medium">Core Values:</span>
          {researchPlan.companyOverview.cultureValues.map((val) => (
            <span
              key={val}
              className="rounded-md bg-surface-100 border border-slate-700/80 px-2.5 py-0.5 text-slate-300 font-medium"
            >
              {val}
            </span>
          ))}
        </div>
      </div>

      {/* Conflicting Sources Alert if Detected */}
      {researchPlan.conflictsDetected && researchPlan.conflictsDetected.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-[11px]">Conflicting Evidence Detected</span>
            <p className="leading-relaxed text-amber-200/90">{researchPlan.conflictsDetected[0]}</p>
          </div>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("rounds")}
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "rounds"
              ? "border-brand-500 text-brand-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Interview Rounds ({researchPlan.rounds.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("brief")}
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "brief"
              ? "border-brand-500 text-brand-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Executive Brief</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "claims"
              ? "border-brand-500 text-brand-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Info className="h-3.5 w-3.5" />
          <span>Evidence Provenance ({researchPlan.claims?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "sources"
              ? "border-brand-500 text-brand-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Source Cards ({researchPlan.sources.length})</span>
        </button>
      </div>

      {/* TAB 1: ROUNDS */}
      {activeTab === "rounds" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Select the interview stage you wish to simulate. Kramix constructs an evidence-grounded blueprint for this specific round.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {researchPlan.rounds.map((round) => {
              const isSelected = round.id === selectedRoundId;
              return (
                <div
                  key={round.id}
                  onClick={() => setSelectedRoundId(round.id)}
                  className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/40 shadow-lg shadow-brand-500/10"
                      : "border-slate-800 bg-[#0d121d] hover:border-slate-700 hover:bg-[#111726]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-brand-300 border border-slate-700">
                        Round {round.roundNumber}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {round.typicalDurationMinutes} mins
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-white">{round.name}</h3>
                      {round.classification && getClassificationBadge(round.classification)}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{round.description}</p>

                    <div className="space-y-2">
                      <span className="text-[11px] font-medium text-slate-300 block">Focus Areas:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {round.focusAreas.map((area) => (
                          <span
                            key={area}
                            className="text-[10px] rounded bg-surface-200 border border-slate-800 px-2 py-0.5 text-slate-300"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    {round.evidenceNote && (
                      <span className="text-[10px] text-slate-500 italic truncate max-w-[240px]">
                        {round.evidenceNote}
                      </span>
                    )}
                    <span
                      className={`font-semibold flex items-center gap-1 ml-auto ${
                        isSelected ? "text-brand-400" : "text-slate-500"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" /> Selected
                        </>
                      ) : (
                        "Select"
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CANDIDATE EXECUTIVE BRIEF */}
      {activeTab === "brief" && brief && (
        <div className="space-y-5 rounded-xl border border-slate-800 bg-[#0d121d] p-6">
          <div className="border-b border-slate-800/80 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-400" />
              Your Kramix Interview Brief
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {brief.executiveSummary}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* What Appears Important */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                What Appears Critical
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {brief.whatAppearsImportant.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-brand-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Focus */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-sky-400" />
                Technical Competencies
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {brief.technicalFocus.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40 text-xs space-y-1">
            <span className="font-semibold text-slate-300">Structure & Confidence:</span>
            <p className="text-slate-400 leading-relaxed">{brief.likelyStructureNotes}</p>
            <p className="text-slate-500 text-[11px] pt-1">{brief.confidenceSummary}</p>
          </div>
        </div>
      )}

      {/* TAB 3: EVIDENCE CLAIMS */}
      {activeTab === "claims" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Kramix audits every company and role claim against verifiable sources. We never present LLM conjecture as verified facts.
          </p>
          <div className="space-y-3">
            {(researchPlan.claims || []).map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-slate-800 bg-[#0d121d] p-4.5 text-xs space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[10px] font-mono font-bold text-brand-400">
                      [{claim.area}]
                    </span>
                    <span className="font-semibold text-slate-200">{claim.claim}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getClassificationBadge(claim.classification)}
                    <span className="text-[10px] font-mono text-slate-500">
                      Confidence: {claim.confidence}
                    </span>
                  </div>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed">
                  <strong className="text-slate-300">Why Kramix believes this:</strong> {claim.rationale}
                </p>

                {claim.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="text-slate-500 font-medium">Sources:</span>
                    {claim.sources.map((s, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-slate-800 border border-slate-700/60 px-2 py-0.5 text-slate-300 truncate max-w-[200px]"
                        title={s.title}
                      >
                        {s.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SOURCE CARDS */}
      {activeTab === "sources" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            All gathered external sources ranked by provenance tier (Tier 1: Official, Tier 2: Industry, Tier 3: Community).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {researchPlan.sources.map((src, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-800 bg-[#0d121d] p-4 text-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {getTierBadge(src.tier)}
                    <span className="text-[10px] font-mono text-slate-500 capitalize">
                      {src.reliability}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white mb-1 leading-snug">{src.title}</h4>
                  {src.snippet && (
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                      &ldquo;{src.snippet}&rdquo;
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="truncate max-w-[200px]">{src.domain || src.sourceType}</span>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300"
                    >
                      <span>View</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Continue Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-800 bg-[#0d121d]/80 rounded-xl p-5 shadow-lg">
        <div className="text-xs text-slate-400">
          Selected Stage: <strong className="text-white">{selectedRound.name}</strong> ({selectedRound.typicalDurationMinutes} mins)
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onSelectRound(selectedRound, "PRACTICE_ROUND")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-surface-100 hover:bg-surface-200 px-5 py-2.5 text-xs font-semibold text-slate-200 transition-all"
          >
            <span>Practice This Round Only</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectRound(researchPlan.rounds[0] || selectedRound, "FULL_SIMULATION")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-500 px-6 py-2.5 text-xs font-semibold text-white shadow-xl shadow-brand-500/25 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Start Full Simulation ({researchPlan.rounds.length} Rounds)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
