"use client";

import React from "react";
import { InterviewerAvatarEngine } from "./InterviewerAvatarEngine";
import { AuthoritativeAvatarState, AvatarMode } from "@/types/avatar";

export type AvatarState =
  | "IDLE"
  | "THINKING"
  | "SPEAKING"
  | "LISTENING"
  | "INTERRUPTED"
  | "TRANSITIONING";

export interface InterviewerAvatarProps {
  state: AvatarState;
  mode?: AvatarMode;
  interviewerName?: string;
  interviewerTitle?: string;
  avatarImageUrl?: string | null;
  assetUrl?: string | null;
  audioActivityLevel?: number; // 0 to 100
  onModeChange?: (mode: AvatarMode) => void;
  className?: string;
}

/**
 * Backward-compatible facade for InterviewerAvatarEngine.
 * Implements Phase 7 multi-mode realistic avatar architecture.
 */
export function InterviewerAvatar({
  state,
  mode = "PHOTOREALISTIC",
  interviewerName = "Rajat",
  interviewerTitle = "Lead AI Interviewer · Kramix.ai",
  avatarImageUrl = null,
  assetUrl = "/avatar.png",
  audioActivityLevel = 0,
  onModeChange,
  className = "",
}: InterviewerAvatarProps) {
  return (
    <InterviewerAvatarEngine
      state={state as AuthoritativeAvatarState}
      mode={mode}
      interviewerName={interviewerName}
      interviewerTitle={interviewerTitle}
      avatarImageUrl={avatarImageUrl}
      assetUrl={assetUrl}
      audioActivityLevel={audioActivityLevel}
      onModeChange={onModeChange}
      className={className}
    />
  );
}

export { InterviewerAvatarEngine };
