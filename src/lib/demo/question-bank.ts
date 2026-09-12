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
 * Fisher-Yates (Knuth) shuffle — produces an unbiased random permutation.
 * Returns a new array; does not mutate the input.
 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Curates a demo session question sequence:
 * - Default roles: 3 technical + 1 behavioral (4 questions limit)
 * - Core Java Developer: 5 random technical Core Java questions (selected from the 10 Core Java questions)
 *
 * RANDOMIZATION POLICY:
 * - Technical questions are shuffled using Fisher-Yates before selection
 * - Behavioral questions are also shuffled before selection
 * - Every session produces a different random combination and order
 *
 * Graceful Underfill Policy:
 * If a role has fewer technical questions than requested, it uses all available technical questions
 * and pads the remainder with distinct questions from the Shared Behavioral bank up to limit.
 *
 * @param role - The target role string (will be resolved to canonical)
 * @param limit - Total questions to select (defaults based on role: 5 for Core Java, 4 for others)
 * @param excludeQuestions - Question texts to exclude (for cross-round deduplication)
 */
export function getDemoQuestionsForRole(
  role: string,
  limit?: number,
  excludeQuestions?: string[]
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

  const isCoreJava = canonicalRole === "Core Java Developer";
  const effectiveLimit = typeof limit === "number" && limit > 0
    ? limit
    : (isCoreJava ? 5 : 4);

  const allTechnicalQuestions = getQuestionsForRole(canonicalRole) || [];
  const allBehavioralQuestions = getSharedBehavioralQuestions();

  // Filter out previously asked questions (cross-round deduplication)
  const excludeSet = new Set(excludeQuestions || []);
  const availableTech = allTechnicalQuestions.filter((q) => !excludeSet.has(q.question));
  const availableBeh = allBehavioralQuestions.filter((q) => !excludeSet.has(q.question));

  // Shuffle both pools independently using Fisher-Yates
  const shuffledTech = fisherYatesShuffle(availableTech);
  const shuffledBeh = fisherYatesShuffle(availableBeh);

  const selectedQuestions: DemoQuestion[] = [];

  if (isCoreJava) {
    // For Core Java Developer: Force random 5 questions from the 10 Core Java questions
    const targetTechCount = Math.min(effectiveLimit, shuffledTech.length);
    for (let i = 0; i < targetTechCount; i++) {
      selectedQuestions.push(shuffledTech[i]);
    }
    // Pad with behavioral if technical questions were exhausted
    let behIndex = 0;
    while (selectedQuestions.length < effectiveLimit && behIndex < shuffledBeh.length) {
      selectedQuestions.push(shuffledBeh[behIndex]);
      behIndex++;
    }
  } else {
    // Standard role policy: up to (effectiveLimit - 1) technical questions + 1 behavioral question
    const targetTechnicalCount = Math.min(effectiveLimit - 1, shuffledTech.length);
    for (let i = 0; i < targetTechnicalCount; i++) {
      selectedQuestions.push(shuffledTech[i]);
    }
    let behIndex = 0;
    while (selectedQuestions.length < effectiveLimit && behIndex < shuffledBeh.length) {
      selectedQuestions.push(shuffledBeh[behIndex]);
      behIndex++;
    }
  }

  // Final shuffle of the combined selection so question ordering is also randomized
  const finalQuestions = fisherYatesShuffle(selectedQuestions);

  return {
    questions: finalQuestions,
    roleCovered: true,
    canonicalRole,
  };
}
