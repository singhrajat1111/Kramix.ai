/**
 * Authoritative Avatar System Types for Kramix.ai
 * Phase 7: Multi-mode realistic interviewer avatar abstraction
 */

export type AvatarMode = "MINIMAL" | "PHOTOREALISTIC" | "CUSTOM_ASSET";

export type AuthoritativeAvatarState =
  | "IDLE"
  | "THINKING"
  | "SPEAKING"
  | "LISTENING"
  | "INTERRUPTED"
  | "TRANSITIONING";

export interface InterviewerAvatarConfig {
  mode: AvatarMode;
  interviewerName: string;
  interviewerTitle: string;
  avatarImageUrl?: string | null;
  assetUrl?: string | null;
  audioActivityLevel?: number; // 0 to 100
}

export interface AvatarStateChangePayload {
  previousState: AuthoritativeAvatarState;
  nextState: AuthoritativeAvatarState;
  reason?: string;
  timestamp: number;
}
