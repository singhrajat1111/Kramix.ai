/**
 * Kramix.AI — Centralized Interview Configuration
 *
 * Single source of truth for session limits, durations, and timing policies.
 * All frontend components and backend directors must reference this central configuration.
 */

export const INTERVIEW_CONFIG = {
  demo: {
    /** Exactly 5 questions total for demo sessions: Q1 -> Q2 -> Q3 -> Q4 -> Q5 -> Finish */
    maxQuestions: 5,
    /** Indicative typical duration in minutes for demo round presentation */
    typicalDurationMinutes: 15,
  },
  full: {
    /** Full API-key interview session runs for up to 40 minutes */
    durationMinutes: 40,
    /** In full mode, question count is time-based, not capped at 5 */
    maxQuestions: 9999,
  },
} as const;

export const DEMO_QUESTION_LIMIT = INTERVIEW_CONFIG.demo.maxQuestions;
export const FULL_INTERVIEW_DURATION_MINUTES = INTERVIEW_CONFIG.full.durationMinutes;
