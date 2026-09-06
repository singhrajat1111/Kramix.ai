"use client";

import React from "react";
import { Sparkles, X } from "lucide-react";

interface UpgradeBannerProps {
  onUnlock?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export function UpgradeBanner({ onUnlock, onDismiss, compact = false }: UpgradeBannerProps) {
  if (compact) {
    return (
      <div className="relative rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-300 shadow-sm">
        <div className="flex items-center gap-2 pr-6">
          <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
          <p className="leading-snug">
            Practicing on <strong className="text-white">Kramix&apos;s curated knowledge base</strong>.{" "}
            <span className="text-zinc-400 hidden sm:inline">
              Live Mode researches this company&apos;s actual interview patterns in real time.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onUnlock}
            className="rounded bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors shadow-sm"
          >
            Unlock Live Mode — 5 for ₹199 / $3.99
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss banner"
              className="text-zinc-400 hover:text-white p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <p className="text-sm text-zinc-300 pr-6">
        You just practiced on <strong>Kramix&apos;s curated knowledge base</strong>.
        Live Mode researches this company&apos;s actual current interview patterns
        in real time and gives you an LLM-evaluated hiring dossier.
      </p>
      <button
        type="button"
        onClick={onUnlock}
        className="mt-3 rounded bg-indigo-500 hover:bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors shadow-sm"
      >
        Unlock Live Mode — 5 interviews for ₹199 / $3.99
      </button>
    </div>
  );
}
