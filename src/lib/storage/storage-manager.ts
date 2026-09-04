import { CandidateProfile, DEFAULT_CANDIDATE_PROFILE } from "@/types/candidate";
import { AIConfig } from "@/types/ai";
import { ResearchPlan } from "@/types/research";
import { InterviewReport } from "@/types/evaluation";
import { InterviewRoundInfo } from "@/types/research";
import { InterviewSession, HiringCommitteeDossier } from "@/types/session";

const STORAGE_KEYS = {
  AI_CONFIG: "kramix_ai_config_v1",
  CANDIDATE_PROFILE: "kramix_candidate_profile_v1",
  RESEARCH_PLAN: "kramix_research_plan_v1",
  SELECTED_ROUND: "kramix_selected_round_v1",
  LATEST_REPORT: "kramix_latest_report_v1",
  ACTIVE_SESSION: "kramix_active_session_v1",
  INTERVIEW_SESSION: "kramix_interview_session_v1",
  LATEST_DOSSIER: "kramix_latest_dossier_v1",
} as const;

export class StorageManager {
  private static isClient(): boolean {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  }

  // AI Configuration (Session-scoped to prevent long-term API key exposure)
  static getAIConfig(): AIConfig {
    if (!this.isClient()) {
      return { provider: "demo" };
    }
    try {
      // Check ephemeral sessionStorage first
      if (typeof sessionStorage !== "undefined") {
        const sessionData = sessionStorage.getItem(STORAGE_KEYS.AI_CONFIG);
        if (sessionData) return JSON.parse(sessionData);
      }

      // Check legacy localStorage, migrate to sessionStorage, and delete from localStorage
      const localData = localStorage.getItem(STORAGE_KEYS.AI_CONFIG);
      if (localData) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(STORAGE_KEYS.AI_CONFIG, localData);
        }
        localStorage.removeItem(STORAGE_KEYS.AI_CONFIG);
        return JSON.parse(localData);
      }

      return { provider: "demo" };
    } catch {
      return { provider: "demo" };
    }
  }

  static saveAIConfig(config: AIConfig): void {
    if (!this.isClient()) return;
    try {
      // Save strictly to sessionStorage so keys vanish when tab closes
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(config));
      }
      // Ensure key is scrubbed from long-lived localStorage
      localStorage.removeItem(STORAGE_KEYS.AI_CONFIG);
    } catch (e) {
      console.error("Failed to save AI config to session storage", e);
    }
  }

  // Candidate Profile
  static getCandidateProfile(): CandidateProfile {
    if (!this.isClient()) return DEFAULT_CANDIDATE_PROFILE;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CANDIDATE_PROFILE);
      if (!data) return DEFAULT_CANDIDATE_PROFILE;
      return JSON.parse(data);
    } catch {
      return DEFAULT_CANDIDATE_PROFILE;
    }
  }

  static saveCandidateProfile(profile: CandidateProfile): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CANDIDATE_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.error("Failed to save candidate profile", e);
    }
  }

  // Research Plan
  static getResearchPlan(): ResearchPlan | null {
    if (!this.isClient()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RESEARCH_PLAN);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static saveResearchPlan(plan: ResearchPlan): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.RESEARCH_PLAN, JSON.stringify(plan));
    } catch (e) {
      console.error("Failed to save research plan", e);
    }
  }

  // Selected Round
  static getSelectedRound(): InterviewRoundInfo | null {
    if (!this.isClient()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SELECTED_ROUND);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static saveSelectedRound(round: InterviewRoundInfo): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_ROUND, JSON.stringify(round));
    } catch (e) {
      console.error("Failed to save selected round", e);
    }
  }

  // Latest Evaluation Report
  static getLatestReport(): InterviewReport | null {
    if (!this.isClient()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LATEST_REPORT);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static saveLatestReport(report: InterviewReport): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LATEST_REPORT, JSON.stringify(report));
    } catch (e) {
      console.error("Failed to save report", e);
    }
  }

  // Active Session State Recovery
  static getActiveSession<T>(): T | null {
    if (!this.isClient()) return null;
    try {
      if (typeof sessionStorage !== "undefined") {
        const data = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
        if (data) return JSON.parse(data);
      }
      return null;
    } catch {
      return null;
    }
  }

  static saveActiveSession<T>(sessionData: T): void {
    if (!this.isClient()) return;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(sessionData));
      }
    } catch (e) {
      console.warn("Failed to persist active session recovery checkpoint", e);
    }
  }

  static clearActiveSession(): void {
    if (!this.isClient()) return;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      }
    } catch {}
  }

  // Multi-Round Interview Session
  static getInterviewSession(): InterviewSession | null {
    if (!this.isClient()) return null;
    try {
      if (typeof sessionStorage !== "undefined") {
        const data = sessionStorage.getItem(STORAGE_KEYS.INTERVIEW_SESSION);
        if (data) return JSON.parse(data);
      }
      const localData = localStorage.getItem(STORAGE_KEYS.INTERVIEW_SESSION);
      if (localData) return JSON.parse(localData);
      return null;
    } catch {
      return null;
    }
  }

  static saveInterviewSession(session: InterviewSession): void {
    if (!this.isClient()) return;
    try {
      const serialized = JSON.stringify(session);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(STORAGE_KEYS.INTERVIEW_SESSION, serialized);
      }
      localStorage.setItem(STORAGE_KEYS.INTERVIEW_SESSION, serialized);
    } catch (e) {
      console.warn("Failed to persist multi-round interview session", e);
    }
  }

  static clearInterviewSession(): void {
    if (!this.isClient()) return;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEYS.INTERVIEW_SESSION);
      }
      localStorage.removeItem(STORAGE_KEYS.INTERVIEW_SESSION);
    } catch {}
  }

  // Final Hiring Committee Dossier
  static getLatestDossier(): HiringCommitteeDossier | null {
    if (!this.isClient()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LATEST_DOSSIER);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static saveLatestDossier(dossier: HiringCommitteeDossier): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LATEST_DOSSIER, JSON.stringify(dossier));
    } catch (e) {
      console.error("Failed to save hiring committee dossier", e);
    }
  }

  static clearSession(): void {
    if (!this.isClient()) return;
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem(key);
        }
      } catch {}
    });
  }
}
