"use client";

import React, { useState, useEffect } from "react";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Send,
  PhoneOff,
  Keyboard,
  Clock,
  Volume2,
  VolumeX,
  RotateCcw,
  Square,
  CornerDownLeft,
} from "lucide-react";
import { InterviewState } from "@/types/interview";

interface InterviewControlsProps {
  state: InterviewState;
  isMuted: boolean;
  isVideoOff: boolean;
  isVoiceMuted: boolean;
  elapsedSeconds: number;
  maxDurationMinutes?: number;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleVoice: () => void;
  onRepeatPrompt: () => void;
  onFinishAnswer: () => void;
  onSubmitManualText: (text: string) => void;
  onEndInterview: () => void;
  onStopInterviewer?: () => void;
  className?: string;
}

export function InterviewControls({
  state,
  isMuted,
  isVideoOff,
  isVoiceMuted,
  elapsedSeconds,
  onToggleMute,
  onToggleVideo,
  onToggleVoice,
  onRepeatPrompt,
  onFinishAnswer,
  onSubmitManualText,
  onEndInterview,
  onStopInterviewer,
  maxDurationMinutes = 25,
  className = "",
}: InterviewControlsProps) {
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [manualText, setManualText] = useState("");
  const [showEndModal, setShowEndModal] = useState(false);

  const totalBudgetSec = maxDurationMinutes * 60;
  const remainingSec = Math.max(0, totalBudgetSec - elapsedSeconds);
  const isNearLimit = remainingSec <= 180 && remainingSec > 0;
  const isTimeComplete = remainingSec === 0;

  const isListening = state === "LISTENING";
  const isProcessing = state === "PROCESSING";
  const isSpeaking =
    state === "QUESTION" ||
    state === "ASKING" ||
    state === "INTRO" ||
    state === "RESPONDING";

  // Global Keyboard shortcut: Ctrl + Enter / Cmd + Enter to Finish Answer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (isListening && !isProcessing) {
          e.preventDefault();
          onFinishAnswer();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening, isProcessing, onFinishAnswer]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    onSubmitManualText(manualText);
    setManualText("");
    setShowTextFallback(false);
  };

  return (
    <nav
      aria-label="Interview Session Controls"
      className={`rounded-2xl border border-slate-800/90 bg-[#0d121d] p-3.5 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 sm:gap-4 ${className}`}
    >
      {/* Left Section: Timer & State Badge */}
      <div className="flex items-center gap-3">
        <div
          role="timer"
          aria-label={`Time remaining: ${formatTime(remainingSec)}`}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono transition-colors shadow-sm ${
            isTimeComplete
              ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
              : isNearLimit
              ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
              : "border-slate-800 bg-surface-200/90 text-slate-300"
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span>{isTimeComplete ? "Time Complete" : `${formatTime(remainingSec)} left`}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
          <span className="capitalize">{state.toLowerCase().replace("_", " ")}</span>
        </div>
      </div>

      {/* Center Section: Primary Action Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Toggle Mic */}
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          aria-pressed={isMuted}
          className={`p-2.5 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            isMuted
              ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
              : "bg-surface-100 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600"
          }`}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        {/* Toggle Camera */}
        <button
          type="button"
          onClick={onToggleVideo}
          aria-label={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          aria-pressed={isVideoOff}
          className={`p-2.5 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            isVideoOff
              ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
              : "bg-surface-100 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600"
          }`}
          title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
        >
          {isVideoOff ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        </button>

        {/* Toggle Interviewer Voice Output */}
        <button
          type="button"
          onClick={onToggleVoice}
          aria-label={isVoiceMuted ? "Unmute AI Voice" : "Mute AI Voice (Text-only display)"}
          aria-pressed={isVoiceMuted}
          className={`p-2.5 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            isVoiceMuted
              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
              : "bg-surface-100 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600"
          }`}
          title={isVoiceMuted ? "Unmute AI Voice" : "Mute AI Voice"}
        >
          {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        {/* Repeat Last Prompt */}
        <button
          type="button"
          onClick={onRepeatPrompt}
          aria-label="Repeat Last Interviewer Question"
          className="p-2.5 rounded-xl border border-slate-700 bg-surface-100 text-slate-300 hover:text-white hover:border-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
          title="Repeat Question"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        {/* Toggle Manual Keyboard Text Fallback */}
        <button
          type="button"
          onClick={() => setShowTextFallback(!showTextFallback)}
          aria-label="Type Answer Manually via Keyboard"
          aria-pressed={showTextFallback}
          className={`p-2.5 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            showTextFallback
              ? "bg-brand-500/20 text-brand-300 border-brand-500/40"
              : "bg-surface-100 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600"
          }`}
          title="Type Response via Keyboard"
        >
          <Keyboard className="h-4 w-4" />
        </button>

        {/* Barge-in / Stop AI Button (Active when Interviewer speaks) */}
        {isSpeaking && onStopInterviewer && (
          <button
            type="button"
            onClick={onStopInterviewer}
            aria-label="Stop AI speaking and begin your answer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/20 hover:bg-amber-500/30 px-3.5 py-2 text-xs font-semibold text-amber-300 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Interrupt Interviewer & Start Answering"
          >
            <Square className="h-3 w-3 fill-current" />
            <span>Stop AI</span>
          </button>
        )}

        {/* Primary CTA: Finish Answer with Ctrl+Enter shortcut */}
        <button
          type="button"
          onClick={onFinishAnswer}
          disabled={!isListening || isProcessing}
          aria-label="Finish speaking and submit answer (Ctrl + Enter)"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <Send className="h-3.5 w-3.5" />
          <span>{isProcessing ? "Processing..." : "Finish Answer"}</span>
          <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.5 text-[9px] font-mono bg-brand-700/80 rounded border border-brand-400/30 text-brand-200">
            Ctrl+↵
          </kbd>
        </button>
      </div>

      {/* Right Section: Conclude Round */}
      <div>
        <button
          type="button"
          onClick={() => setShowEndModal(true)}
          aria-label="Conclude Interview Round"
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-medium text-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Conclude</span>
        </button>
      </div>

      {/* Manual Text Fallback Drawer */}
      {showTextFallback && (
        <form
          onSubmit={handleManualSubmit}
          className="w-full rounded-xl border border-brand-500/40 bg-surface-100/95 p-4 shadow-2xl mt-2 space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5 text-brand-400" />
              Manual Text Response (Keyboard Input)
            </span>
            <span className="text-[11px] text-slate-500">
              Press Ctrl+Enter or click Submit Response
            </span>
          </div>

          <textarea
            rows={3}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleManualSubmit(e);
              }
            }}
            placeholder="Type your structured answer here. Useful if microphone access is restricted or noisy..."
            className="w-full rounded-lg border border-slate-700 bg-surface-200/90 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTextFallback(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!manualText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <span>Submit Response</span>
              <CornerDownLeft className="h-3 w-3" />
            </button>
          </div>
        </form>
      )}

      {/* Conclude Round Confirmation Modal */}
      {showEndModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d121d] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Conclude Interview Round?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Wrapping up this round will trigger the automated evaluation pipeline to score your answers, extract strengths and weaknesses, and calculate your cross-round progress.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Resume Interview
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndModal(false);
                  onEndInterview();
                }}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                Yes, End & Evaluate
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
