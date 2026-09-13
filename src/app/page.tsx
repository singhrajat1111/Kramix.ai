"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  Sparkles,
  Terminal,
  Cpu,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Layers,
  Radio,
  Clock,
  User,
  Activity,
} from "lucide-react";

const PRESET_ROLES = [
  {
    id: "core java",
    title: "Core Java Engineer",
    level: "L4 / Senior",
    rounds: ["Technical Deep-Dive", "System Concurrency", "Architecture"],
    icon: Terminal,
    desc: "JVM internals, Garbage Collection, memory model, multithreading, and Spring Boot patterns.",
  },
  {
    id: "distributed systems",
    title: "Distributed Systems Architect",
    level: "Staff / Principal",
    rounds: ["Consensus & Raft", "Partitioning & Sharding", "Fault Tolerance"],
    icon: Cpu,
    desc: "CAP theorem, Paxos/Raft, idempotency, event sourcing, and high-throughput low-latency pipelines.",
  },
  {
    id: "machine learning",
    title: "Machine Learning Engineer",
    level: "Senior / Tech Lead",
    rounds: ["Math Foundations", "Model Optimization", "MLOps & Serving"],
    icon: Zap,
    desc: "Regularization (L1/L2), loss landscapes, attention mechanisms, quantization, and real-time inference.",
  },
  {
    id: "fullstack typescript",
    title: "Fullstack TypeScript Engineer",
    level: "Mid-Senior",
    rounds: ["Frontend Architecture", "API Design", "Security & Performance"],
    icon: Layers,
    desc: "Next.js App Router, React Server Components, state management, WebSockets, and database indexing.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState("core java");
  const [mode, setMode] = useState<"demo" | "api">("demo");
  const [maxTurns, setMaxTurns] = useState(6);
  const [candidateName, setCandidateName] = useState("Candidate");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemReady, setSystemReady] = useState<boolean | null>(null);

  useEffect(() => {
    // Check backend health via same-origin proxy
    fetch("/ready")
      .then((res) => {
        setSystemReady(res.ok);
      })
      .catch(() => {
        setSystemReady(false);
      });
  }, []);

  const handleStartInterview = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const session = await apiClient.createSession({
        mode,
        role: selectedRole,
        max_turns: maxTurns,
        candidate_name: candidateName.trim() || "Candidate",
      });
      router.push(`/interview?sessionId=${session.session_id}`);
    } catch (err: any) {
      console.error("Session creation failed:", err);
      setError(err.message || "Failed to start interview session. Ensure backend is running.");
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Realistic Technical Mock Interviews
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Next-Generation{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Technical Interview
          </span>{" "}
          Experience
        </h1>

        <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Experience hyper-realistic, role-specific technical mock interviews with an adaptive AI interviewer,
          live voice diagnostics, and comprehensive evaluation dossiers.
        </p>
      </div>

      {/* Main Configuration Card */}
      <div className="w-full max-w-4xl glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Select Target Role */}
        <div className="mb-8">
          <label className="block text-sm font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
            Select Target Interview Track
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRESET_ROLES.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-950/30 glow-indigo"
                      : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-lg ${
                          isSelected ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-base leading-snug">{r.title}</h3>
                        <span className="text-xs text-indigo-400 font-mono">{r.level}</span>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />}
                  </div>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{r.desc}</p>

                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-800/60">
                    {r.rounds.map((round, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium"
                      >
                        {round}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Settings & Candidate Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 pt-6 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Candidate Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Rajat Singh"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Execution Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("demo")}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                  mode === "demo"
                    ? "border-emerald-500 bg-emerald-950/40 text-emerald-300 font-semibold shadow-sm"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Demo Mode
              </button>
              <button
                type="button"
                onClick={() => setMode("api")}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                  mode === "api"
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300 font-semibold shadow-sm"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                Live AI
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Question Budget
            </label>
            <div className="flex items-center gap-2">
              {[4, 6, 8].map((budget) => (
                <button
                  key={budget}
                  type="button"
                  onClick={() => setMaxTurns(budget)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                    maxTurns === budget
                      ? "border-indigo-500 bg-indigo-600 text-white font-semibold"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  {budget} Qs
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode Guarantee Explainer */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-8 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              {mode === "demo"
                ? "Demo Mode runs on deterministic question graphs & local rules. Zero external API keys needed."
                : "Live AI Mode engages real-time LLM adaptive probing via backend provider connectors."}
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 font-mono">
            <Clock className="w-3 h-3" />
            <span>~15-20 mins</span>
          </div>
        </div>

        {/* Launch Button */}
        <button
          type="button"
          onClick={handleStartInterview}
          disabled={isCreating}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-base shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-3 group transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Preparing Interview Session...</span>
            </>
          ) : (
            <>
              <span>Start Mock Interview</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>

      {/* Feature Pillar Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl w-full mt-12">
        <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Realistic Evaluation</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Curated technical question banks and intelligent follow-ups tailored to role difficulty.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Multi-Round Simulation</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Technical fundamentals, concurrency, and architecture rounds dynamically orchestrated.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Actionable Feedback</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Detailed scoring across technical accuracy, depth, concept coverage, and hiring verdict.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
