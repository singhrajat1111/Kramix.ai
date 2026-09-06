import { resolveCanonicalRole } from "./role-aliases";
import questionBankJson from "./question-bank-data.json";

export interface DemoQuestion {
  role: string;
  category: "behavioral" | "technical";
  question: string;
  keyPoints: string[];
}

let memoryCachedBank: DemoQuestion[] | null = null;

/**
 * Loads the flattened question bank from the cached dataset.
 * Caches in memory so parsing happens only once.
 */
export function loadQuestionBank(): DemoQuestion[] {
  if (memoryCachedBank) {
    return memoryCachedBank;
  }

  // Load from pre-parsed build asset (works in browser bundles and node)
  const raw = questionBankJson as DemoQuestion[];
  memoryCachedBank = Array.isArray(raw) ? [...raw] : [];
  return memoryCachedBank;
}

/**
 * In-memory cache reset (useful for testing or hot reloads)
 */
export function resetQuestionBankCache(): void {
  memoryCachedBank = null;
}

/**
 * Returns the list of all unique canonical technical roles present in the question bank.
 */
export function getAvailableCanonicalRoles(): string[] {
  const bank = loadQuestionBank();
  const roles = new Set<string>();
  for (const q of bank) {
    if (q.category === "technical" && q.role !== "Shared Behavioral") {
      roles.add(q.role);
    }
  }
  return Array.from(roles);
}

/**
 * Retrieves the shared behavioral questions common to all roles.
 */
export function getSharedBehavioralQuestions(): DemoQuestion[] {
  const bank = loadQuestionBank();
  return bank.filter((q) => q.category === "behavioral" || q.role === "Shared Behavioral");
}

/**
 * Matches a target role against the bank using token boundaries and the alias registry.
 * Returns technical questions for the matched role, or null if the role is not covered.
 */
export function getQuestionsForRole(role: string): DemoQuestion[] | null {
  if (!role || typeof role !== "string") return null;

  const availableRoles = getAvailableCanonicalRoles();
  const canonicalRole = resolveCanonicalRole(role, availableRoles);

  if (!canonicalRole) {
    return null;
  }

  const bank = loadQuestionBank();
  const matches = bank.filter(
    (q) => q.role === canonicalRole && q.category === "technical"
  );

  return matches.length > 0 ? matches : null;
}

/**
 * Curates a demo session question sequence (default 4 questions):
 * - 3 technical questions matched to the role
 * - 1 behavioral question from the shared set
 *
 * Graceful Underfill Policy:
 * If a role has fewer than 3 technical questions, it uses all available technical questions
 * and pads the remainder with distinct questions from the Shared Behavioral bank up to limit
 * (guaranteeing exactly 4 unique questions with no crashes or repeats).
 */
export function getDemoQuestionsForRole(
  role: string,
  limit = 4
): {
  questions: DemoQuestion[];
  roleCovered: boolean;
  canonicalRole: string | null;
} {
  const availableRoles = getAvailableCanonicalRoles();
  const canonicalRole = resolveCanonicalRole(role, availableRoles);

  if (!canonicalRole) {
    return {
      questions: [],
      roleCovered: false,
      canonicalRole: null,
    };
  }

  const technicalQuestions = getQuestionsForRole(canonicalRole) || [];
  const behavioralQuestions = getSharedBehavioralQuestions();

  const selectedQuestions: DemoQuestion[] = [];
  const targetTechnicalCount = Math.min(3, technicalQuestions.length);

  // Take up to 3 technical questions
  for (let i = 0; i < targetTechnicalCount; i++) {
    selectedQuestions.push(technicalQuestions[i]);
  }

  // Add behavioral question(s) to reach the required session limit (typically 1 behavioral to make 4 total)
  let behIndex = 0;
  while (selectedQuestions.length < limit && behIndex < behavioralQuestions.length) {
    selectedQuestions.push(behavioralQuestions[behIndex]);
    behIndex++;
  }

  return {
    questions: selectedQuestions,
    roleCovered: true,
    canonicalRole,
  };
}
