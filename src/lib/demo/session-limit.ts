import { resolveCanonicalRole } from "./role-aliases";
import { getAvailableCanonicalRoles } from "./question-bank";

/**
 * Kramix.AI — Demo Session Question Limit & Gating
 *
 * Controls question budget and upgrade gating for demo mode interviews.
 */

export const DEMO_QUESTION_LIMIT = 4;

/**
 * Returns the question limit for a demo session based on the candidate's target role.
 *
 * Special Rule:
 * For "Core Java Developer" / "Core Java", force exactly 5 questions (randomly selected from the 10 Core Java questions).
 */
export function getDemoQuestionLimit(targetRole?: string): number {
  if (!targetRole || typeof targetRole !== "string") {
    return DEMO_QUESTION_LIMIT;
  }
  const availableRoles = getAvailableCanonicalRoles();
  const canonical = resolveCanonicalRole(targetRole, availableRoles);
  if (canonical === "Core Java Developer") {
    return 5;
  }
  return DEMO_QUESTION_LIMIT;
}

/**
 * Returns true if the candidate has reached or exceeded the demo session limit.
 *
 * @param questionsAskedSoFar The count of questions already asked/answered in the session
 * @param targetRole Optional target role string to determine role-specific limit
 */
export function shouldShowUpgradeGate(questionsAskedSoFar: number, targetRole?: string): boolean {
  const limit = getDemoQuestionLimit(targetRole);
  return questionsAskedSoFar >= limit;
}
