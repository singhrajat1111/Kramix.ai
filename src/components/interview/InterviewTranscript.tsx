"use client";

import React from "react";
import { ConversationTurn, InterviewState } from "@/types/interview";
import { MessageSquare, Volume2, Mic, Sparkles } from "lucide-react";

interface InterviewTranscriptProps {
  currentQuestion: string;
  liveSpeech: string;
  state: InterviewState;
  conversationHistory: ConversationTurn[];
  className?: string;
}

export function InterviewTranscript({
  currentQuestion,
  liveSpeech,
  state,
  conversationHistory,
  className = "",
}: InterviewTranscriptProps) {
  const latestInterviewerTurn = [...conversationHistory]
    .reverse()
    .find((t) => t.role === "interviewer");

  return (
    <section
      aria-label="Live Interview Audio Transcript & Prompts"
      className={`rounded-2xl border border-slate-800/90 bg-[#0d121d] p-4 sm:p-5 shadow-2xl space-y-4 ${className}`}
    >
      {/* Active Question / Interlocutor Box */}
      <div
        aria-live="polite"
        className="rounded-xl border border-slate-700/80 bg-surface-100/90 p-4 relative overflow-hidden shadow-sm"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-semibold text-brand-300 flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-brand-400" />
            Interviewer Prompt:
          </span>
          {latestInterviewerTurn?.questionNumber && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Question #{latestInterviewerTurn.questionNumber}
            </span>
          )}
        </div>

        <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed">
          &ldquo;{latestInterviewerTurn?.text || currentQuestion || "Connecting with your interviewer..."}&rdquo;
        </p>
      </div>

      {/* Candidate Live Speech Feedback */}
      <div
        aria-live="polite"
        className="rounded-xl border border-slate-800 bg-surface-200/70 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span className="font-medium flex items-center gap-1.5 text-slate-300">
            <Mic className="h-3.5 w-3.5 text-emerald-400" />
            Your Answer:
          </span>
          {state === "LISTENING" && (
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="flex items-center gap-0.5">
                <span className="h-1.5 w-1 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="h-2.5 w-1 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
              </span>
              <span>Recording live speech...</span>
            </span>
          )}
          {state === "PROCESSING" && (
            <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
              <Sparkles className="h-3 w-3 animate-spin" /> Analyzing response...
            </span>
          )}
        </div>

        <p className="text-xs sm:text-sm text-slate-300 min-h-[42px] leading-relaxed italic">
          {liveSpeech ? (
            liveSpeech
          ) : state === "LISTENING" ? (
            <span className="text-slate-500 not-italic">
              Speak clearly into your microphone, or press <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+Enter</kbd> to submit answer when complete.
            </span>
          ) : (
            <span className="text-slate-600 not-italic">Awaiting interviewer question...</span>
          )}
        </p>
      </div>

      {/* Collapsible conversation turns */}
      {conversationHistory.length > 2 && (
        <details className="text-xs group border-t border-slate-800/80 pt-3">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1.5 select-none focus:outline-none focus:text-brand-300">
            <MessageSquare className="h-3.5 w-3.5 text-brand-400" />
            <span>Full Transcript History ({conversationHistory.length} turns)</span>
          </summary>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {conversationHistory.map((turn) => (
              <div
                key={turn.id}
                className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                  turn.role === "interviewer"
                    ? "bg-slate-800/50 text-slate-300 border-l-2 border-brand-500"
                    : "bg-surface-200/90 text-slate-200 border-l-2 border-emerald-500 ml-3"
                }`}
              >
                <div className="text-[10px] text-slate-500 uppercase font-mono mb-0.5">
                  {turn.role}
                </div>
                {turn.text}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
