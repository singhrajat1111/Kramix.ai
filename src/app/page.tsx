"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Cpu, CheckCircle2, Video, Search, BrainCircuit } from "lucide-react";

export default function HomePage() {
  const steps = [
    {
      title: "1. Position & Company Context",
      desc: "Specify your target role and company. Kramix extracts relevant technologies, requirements, and engineering expectations.",
      icon: Search,
    },
    {
      title: "2. Flag-Based Company Research",
      desc: "Our research pipeline maps verified interview rounds, system design questions, and leadership tenets before you start.",
      icon: BrainCircuit,
    },
    {
      title: "3. Realistic AI Interview Room",
      desc: "Sit in front of an adaptive AI interviewer with live audio-reactive feedback, vocal prompts, and follow-up probes.",
      icon: Video,
    },
    {
      title: "4. Actionable Hiring Committee Report",
      desc: "Receive multidimensional scoring, question-by-question critiques, and a tailored Priority 1/2/3 study roadmap.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-brand-600/20 via-accent-purple/15 to-transparent blur-[120px] pointer-events-none" />

      {/* Hero Section */}
      <div className="relative mx-auto max-w-5xl px-4 pt-16 pb-12 sm:px-6 lg:px-8 text-center space-y-6 my-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-300">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          <span>Next-Generation Realistic Interview Simulator</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          &ldquo;I am actually sitting in an interview.&rdquo;
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Kramix researches your target company, role, and historical interview patterns to construct an authentic, adaptive technical interview. Not a chatbot — a realistic interviewer.
        </p>

        {/* Hero CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/setup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-brand-500/25 transition-all hover:scale-105"
          >
            <span>Start Interview Preparation</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/setup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-surface-100 hover:bg-surface-200 px-6 py-3.5 text-sm font-medium text-slate-300 transition-colors"
          >
            <Cpu className="h-4 w-4 text-amber-400" />
            <span>Try Instant Demo Mode</span>
          </Link>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Real-time Voice & Webcam
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Modular Company Research
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Deterministic Director Orchestration
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Zero Server Secrets / 100% Client-Safe
          </span>
        </div>
      </div>

      {/* 4-Step Pipeline Visualizer */}
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Architected for High Fidelity
          </h2>
          <p className="text-xl font-bold text-white mt-1">The Kramix Interview Journey</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-800 bg-[#0d121d] p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="h-10 w-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{s.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
