/**
 * Kramix.AI — Demo Session Question Limit & Gating
 *
 * Controls question budget and upgrade gating for demo mode interviews.
 * Centralized from INTERVIEW_CONFIG.
 */

import { DEMO_QUESTION_LIMIT } from "@/lib/config/interview-config";

export { DEMO_QUESTION_LIMIT };

/**
 * Returns true if the candidate has reached or exceeded the demo session limit.
 *
 * @param questionsAskedSoFar The count of questions already asked/answered in the session
 */
export function shouldShowUpgradeGate(questionsAskedSoFar: number): boolean {
  return questionsAskedSoFar >= DEMO_QUESTION_LIMIT;
}
