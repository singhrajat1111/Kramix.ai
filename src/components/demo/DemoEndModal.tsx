"use client";

import React from "react";
import { Key, Mail, Sparkles, AlertCircle, CheckCircle2, ArrowRight, X } from "lucide-react";
import { DEMO_QUESTION_LIMIT } from "@/lib/demo/session-limit";

export interface DemoEndModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onBringOwnKey: () => void;
  onContactAuthor?: (role?: string, company?: string) => void;
  reason?: "limit_reached" | "role_not_covered";
  role?: string;
  company?: string;
  questionsCompleted?: number;
}

export function DemoEndModal({
  isOpen,
  onClose,
  onBringOwnKey,
  onContactAuthor,
  reason = "limit_reached",
  role = "Software Engineer",
  company = "Target Company",
  questionsCompleted = DEMO_QUESTION_LIMIT,
}: DemoEndModalProps) {
  if (!isOpen) return null;

  const defaultContactAuthor = (targetRole: string, targetCompany: string) => {
    const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "singh.rajat70880@gmail.com";
    const subject = encodeURIComponent(`Kramix API Access Request — ${targetRole} @ ${targetCompany}`);
    const body = encodeURIComponent(
      `Hi, I'd like access to Kramix live mode.\nRole: ${targetRole}\nCompany: ${targetCompany}\n\nI'm ready to conduct full adaptive mock interviews!`
    );
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  const handleContactClick = () => {
    if (onContactAuthor) {
      onContactAuthor(role, company);
    } else {
      defaultContactAuthor(role, company);
    }
  };

  const isRoleNotCovered = reason === "role_not_covered";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#0f172a] via-[#0b1120] to-[#080d1a] p-6 shadow-2xl text-slate-100 space-y-5">
        {/* Optional Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Top Icon Badge */}
        <div className="flex items-center gap-2">
          {isRoleNotCovered ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Role Not in Demo Bank</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/15 border border-brand-500/30 text-brand-300">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              <span>Demo Session Complete</span>
            </div>
          )}
        </div>

        {/* Headline & Body Text */}
        <div className="space-y-2">
          <h2 id="demo-modal-title" className="text-xl font-bold text-white tracking-tight">
            {isRoleNotCovered ? "Role Not in Demo Bank Yet" : "That's the demo!"}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {isRoleNotCovered ? (
              <>
                Demo mode doesn&apos;t have a curated bank for{" "}
                <span className="font-semibold text-white">&ldquo;{role}&rdquo;</span> yet — but{" "}
                <strong className="text-brand-300">Live Mode</strong> can research and interview you for{" "}
                <strong className="text-white">ANY</strong> role in real time.
              </>
            ) : (
              <>
                You&apos;ve completed{" "}
                <span className="font-semibold text-white">{questionsCompleted} questions</span> from Kramix&apos;s
                curated bank. To continue with a full, adaptive interview researched for your exact target company
                — bring your own API key, or contact us for access.
              </>
            )}
          </p>
        </div>

        {/* Value Highlights */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 space-y-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Live adaptive follow-ups tuned to {company}</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Comprehensive hiring committee evaluation & dossier</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onBringOwnKey}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs py-2.5 px-4 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Key className="h-4 w-4" />
            <span>Bring Your Own API Key</span>
          </button>
          <button
            type="button"
            onClick={handleContactClick}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-surface-100 hover:bg-surface-200 text-slate-200 hover:text-white font-medium text-xs py-2.5 px-4 transition-colors cursor-pointer"
          >
            <Mail className="h-4 w-4 text-slate-400" />
            <span>Contact Author</span>
          </button>
        </div>
      </div>
    </div>
  );
}
