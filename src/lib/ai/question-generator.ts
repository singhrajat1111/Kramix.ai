/**
 * Kramix.AI — AI Question Generator
 *
 * Central module for dynamically generating personalized interview questions
 * using the configured LLM provider. This is the heart of the AI interview engine.
 *
 * DESIGN PRINCIPLES:
 * - Single batch API call for all questions (token-efficient)
 * - Master prompt template centralized here (not scattered across codebase)
 * - Lightweight validation with targeted regeneration
 * - Expected answers remain internal (never shown to candidate)
 * - Provider-agnostic (works with any LLMProvider implementation)
 */

import { LLMProvider } from "@/types/ai";
import { CandidateProfile } from "@/types/candidate";
import {
  AIGeneratedQuestion,
  AIQuestionGenerationResult,
  InterviewGenerationContext,
} from "@/types/ai-question";
import { InterviewRoundInfo, ResearchPlan } from "@/types/research";
import { sanitizeUntrustedText } from "./prompt-defense";
import { isCoreJavaDomain, getCoreJavaAIQuestions } from "../demo/core-java";

// ---------------------------------------------------------------------------
// 1. CONTEXT BUILDER
// ---------------------------------------------------------------------------

/**
 * Constructs structured interview context from existing application data.
 * Only includes fields that actually exist in CandidateProfile and ResearchPlan.
 * Does NOT invent candidate information.
 */
export function buildInterviewContext(
  candidate: CandidateProfile,
  researchPlan: ResearchPlan,
  selectedRound: InterviewRoundInfo,
  previousQuestions: string[] = []
): InterviewGenerationContext {
  return {
    candidate: {
      skills: candidate.skills || [],
      experienceLevel: candidate.experienceLevel || "Mid Level (3-5 years)",
      resumeText: candidate.resumeText
        ? sanitizeUntrustedText(candidate.resumeText, 2000)
        : undefined,
      additionalContext: candidate.additionalContext
        ? sanitizeUntrustedText(candidate.additionalContext, 1000)
        : undefined,
    },
    target: {
      role: candidate.targetRole || "Software Engineer",
      company: candidate.targetCompanies[0] || "Target Company",
      jobDescription: candidate.jobDescription
        ? sanitizeUntrustedText(candidate.jobDescription, 1500)
        : undefined,
      experienceLevel: candidate.experienceLevel || "Mid Level (3-5 years)",
    },
    interview: {
      difficulty: mapExperienceToDifficulty(candidate.experienceLevel),
      round: selectedRound.name,
      roundCategory: selectedRound.category,
      questionCount: 4,
      previousQuestions,
    },
    ragContext: {
      companyOverview: researchPlan.companyOverview?.summary,
      cultureValues: researchPlan.companyOverview?.cultureValues?.slice(0, 5),
      techStack: researchPlan.companyOverview?.techStackKeywords?.slice(0, 8),
      roleExpectations: researchPlan.roleExpectations?.coreResponsibilities?.slice(0, 4),
      technicalTopics: researchPlan.technicalTopics?.slice(0, 5).map((t) => t.name),
      behavioralTopics: researchPlan.behavioralTopics?.slice(0, 3).map((b) => b.name),
      candidateBrief: researchPlan.candidateBriefSummary?.executiveSummary,
    },
  };
}

function mapExperienceToDifficulty(level: string): string {
  const l = (level || "").toLowerCase();
  if (l.includes("intern") || l.includes("student")) return "easy";
  if (l.includes("entry")) return "easy-medium";
  if (l.includes("mid")) return "medium";
  if (l.includes("senior")) return "medium-hard";
  if (l.includes("lead") || l.includes("principal") || l.includes("executive"))
    return "hard";
  return "medium";
}

// ---------------------------------------------------------------------------
// 2. MASTER PROMPT TEMPLATE
// ---------------------------------------------------------------------------

/**
 * Builds the centralized master prompt for interview question generation.
 * This is the ONLY place question-generation instructions live in the codebase.
 */
export function buildMasterPrompt(context: InterviewGenerationContext): string {
  const candidateSkills =
    context.candidate.skills.length > 0
      ? context.candidate.skills.join(", ")
      : "Not specified";

  const resumeSection = context.candidate.resumeText
    ? `\nCandidate Resume (excerpt):\n${context.candidate.resumeText}`
    : "";

  const jdSection = context.target.jobDescription
    ? `\nJob Description:\n${context.target.jobDescription}`
    : "";

  const ragSection = buildRAGContextSection(context.ragContext);

  const previousQSection =
    context.interview.previousQuestions.length > 0
      ? `\nPreviously Asked Questions (DO NOT repeat or ask substantially similar questions):\n${context.interview.previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

  return `You are an expert technical interviewer conducting a realistic ${context.interview.round} interview.

=== CANDIDATE PROFILE ===
Target Role: ${context.target.role}
Target Company: ${context.target.company}
Experience Level: ${context.target.experienceLevel}
Skills: ${candidateSkills}
${resumeSection}
${jdSection}

=== COMPANY & ROLE CONTEXT ===
${ragSection}

=== INTERVIEW PARAMETERS ===
Interview Round: ${context.interview.round} (${context.interview.roundCategory})
Difficulty: ${context.interview.difficulty}
Questions to Generate: ${context.interview.questionCount}
${previousQSection}

=== GENERATION INSTRUCTIONS ===

Generate ${context.interview.questionCount} high-quality interview questions that are:

1. RELEVANT to the candidate's actual skills and experience
2. ALIGNED with the target role at ${context.target.company}
3. APPROPRIATE for the ${context.interview.round} round (${context.interview.roundCategory})
4. ADAPTED to ${context.interview.difficulty} difficulty level
5. VARIED — mix different question types
6. NON-REPETITIVE — each question covers a distinct topic
7. REALISTIC — questions a real interviewer would ask

Question types to include (mix these):
- Conceptual: Test understanding of core concepts
- Practical: Real-world implementation scenarios
- Scenario-based: "What would you do if..."
- Architecture/Design: System design or component architecture
- Project-specific: Based on candidate's actual projects/experience
- Trade-off: Compare approaches and justify choices
- Debugging: Troubleshoot a described problem

For each question, provide:
- A clear, specific question text
- An expected answer (what a strong candidate would say)
- 3-5 evaluation points (specific criteria for scoring)
- Difficulty level (easy, medium, or hard)
- Topic tag
- Question type
- Source context (what informed this question)

CRITICAL RULES:
- Questions must feel like they come from a real interviewer, not a textbook.
- Avoid generic questions like "What is X?" — prefer "How would you use X to solve Y?"
- If candidate resume/skills are provided, reference specific technologies they know.
- Never repeat or paraphrase a previously asked question.
- Expected answers should be detailed enough to evaluate against, but not overly long.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
{
  "questions": [
    {
      "id": "gen-1",
      "question": "...",
      "difficulty": "easy" | "medium" | "hard",
      "topic": "...",
      "type": "conceptual" | "practical" | "scenario" | "debugging" | "architecture" | "project" | "tradeoff" | "behavioral",
      "expectedAnswer": "...",
      "evaluationPoints": ["...", "...", "..."],
      "followUp": "...",
      "sourceContext": ["candidate_skill", "job_description", "company_context", ...]
    }
  ]
}`;
}

function buildRAGContextSection(
  rag: InterviewGenerationContext["ragContext"]
): string {
  const parts: string[] = [];

  if (rag.companyOverview) {
    parts.push(`Company Overview: ${rag.companyOverview}`);
  }
  if (rag.cultureValues && rag.cultureValues.length > 0) {
    parts.push(`Culture & Values: ${rag.cultureValues.join(", ")}`);
  }
  if (rag.techStack && rag.techStack.length > 0) {
    parts.push(`Tech Stack: ${rag.techStack.join(", ")}`);
  }
  if (rag.roleExpectations && rag.roleExpectations.length > 0) {
    parts.push(
      `Role Expectations:\n${rag.roleExpectations.map((r) => `- ${r}`).join("\n")}`
    );
  }
  if (rag.technicalTopics && rag.technicalTopics.length > 0) {
    parts.push(`Technical Focus Areas: ${rag.technicalTopics.join(", ")}`);
  }
  if (rag.behavioralTopics && rag.behavioralTopics.length > 0) {
    parts.push(`Behavioral Focus Areas: ${rag.behavioralTopics.join(", ")}`);
  }
  if (rag.candidateBrief) {
    parts.push(`Candidate Brief: ${rag.candidateBrief}`);
  }

  return parts.length > 0 ? parts.join("\n") : "No additional context available.";
}

// ---------------------------------------------------------------------------
// 3. QUESTION GENERATION
// ---------------------------------------------------------------------------

export interface QuestionGenerationOptions {
  questionCount?: number;
  previousQuestions?: string[];
  maxRetries?: number;
}

/**
 * Main entry point: generates personalized interview questions using the AI provider.
 *
 * Flow:
 *  1. Build interview context from candidate + research plan
 *  2. Build master prompt
 *  3. Call LLM to generate structured JSON (1 batch request → N questions)
 *  4. Validate generated questions
 *  5. Retry only invalid questions (max 1 retry)
 *  6. Return validated question queue
 */
export async function generateInterviewQuestions(
  llm: LLMProvider,
  candidate: CandidateProfile,
  researchPlan: ResearchPlan,
  selectedRound: InterviewRoundInfo,
  options: QuestionGenerationOptions = {}
): Promise<AIGeneratedQuestion[]> {
  const previousQuestions = options.previousQuestions || [];

  // CORE JAVA DOMAIN ROUTING RULE:
  // If target role, skills, job description, or resume contains "Core Java" (case-insensitive),
  // strictly source questions from the vetted 10 Core Java questions bank without framework questions.
  if (
    isCoreJavaDomain({
      targetRole: candidate.targetRole,
      skills: candidate.skills,
      jobDescription: candidate.jobDescription,
      resumeText: candidate.resumeText,
      additionalContext: candidate.additionalContext,
    }) ||
    isCoreJavaDomain(selectedRound.name) ||
    isCoreJavaDomain(selectedRound.focusAreas?.join(" "))
  ) {
    const count = options.questionCount || 5;
    return getCoreJavaAIQuestions(count, previousQuestions);
  }

  const questionCount = options.questionCount || 5;
  const maxRetries = options.maxRetries ?? 1;

  // 1. Build context
  const context = buildInterviewContext(
    candidate,
    researchPlan,
    selectedRound,
    previousQuestions
  );
  context.interview.questionCount = questionCount;

  // 2. Build prompt
  const masterPrompt = buildMasterPrompt(context);

  // 3. Generate questions via single batch API call
  let generatedQuestions: AIGeneratedQuestion[] = [];
  try {
    const result = await llm.generateStructuredJSON<AIQuestionGenerationResult>(
      [
        { role: "system", content: masterPrompt },
        {
          role: "user",
          content: `Generate ${questionCount} personalized interview questions for ${context.target.role} at ${context.target.company}. Return structured JSON only.`,
        },
      ],
      "AIQuestionGenerationResult"
    );

    if (result && Array.isArray(result.questions)) {
      generatedQuestions = result.questions;
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : "Failed to contact AI provider";
    const cleanMsg = rawMsg
      .replace(/gsk_[a-zA-Z0-9_\-]+/gi, "gsk_••••")
      .replace(/sk-ant-[a-zA-Z0-9_\-]+/gi, "sk-ant-••••")
      .replace(/sk-[a-zA-Z0-9_\-]+/gi, "sk-••••")
      .replace(/AIza[a-zA-Z0-9_\-]+/gi, "AIza••••")
      .replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]");
    throw new AIQuestionGenerationError(
      cleanMsg || "Failed to generate interview questions from AI provider.",
      err instanceof Error ? err : undefined
    );
  }

  // 4. Validate
  const { valid, invalid } = validateGeneratedQuestions(
    generatedQuestions,
    previousQuestions
  );

  // 5. Retry invalid questions (up to maxRetries)
  let retried: AIGeneratedQuestion[] = [];
  if (invalid.length > 0 && maxRetries > 0) {
    try {
      const retryContext = { ...context };
      retryContext.interview.questionCount = invalid.length;
      retryContext.interview.previousQuestions = [
        ...previousQuestions,
        ...valid.map((q) => q.question),
      ];

      const retryPrompt = buildMasterPrompt(retryContext);
      const retryResult =
        await llm.generateStructuredJSON<AIQuestionGenerationResult>(
          [
            { role: "system", content: retryPrompt },
            {
              role: "user",
              content: `Generate ${invalid.length} replacement interview questions. The previous batch had ${invalid.length} invalid questions. Return structured JSON only.`,
            },
          ],
          "AIQuestionGenerationResult"
        );

      if (retryResult && Array.isArray(retryResult.questions)) {
        const { valid: retriedValid } = validateGeneratedQuestions(
          retryResult.questions,
          [...previousQuestions, ...valid.map((q) => q.question)]
        );
        retried = retriedValid;
      }
    } catch {
      // Retry failed — proceed with what we have
    }
  }

  const finalQuestions = [...valid, ...retried];

  if (finalQuestions.length === 0) {
    throw new AIQuestionGenerationError(
      "AI generated no valid questions. Please check your API key and try again."
    );
  }

  // Ensure all questions have unique IDs
  return finalQuestions.map((q, i) => ({
    ...q,
    id: q.id || `gen-${i + 1}`,
  }));
}

// ---------------------------------------------------------------------------
// 4. VALIDATION
// ---------------------------------------------------------------------------

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const VALID_TYPES = new Set([
  "conceptual",
  "practical",
  "scenario",
  "debugging",
  "architecture",
  "project",
  "tradeoff",
  "behavioral",
]);

/**
 * Lightweight validation for generated questions.
 * Validates: non-empty, expected answer exists, valid enums, not a duplicate.
 */
export function validateGeneratedQuestions(
  questions: AIGeneratedQuestion[],
  previousQuestions: string[] = []
): { valid: AIGeneratedQuestion[]; invalid: AIGeneratedQuestion[] } {
  const valid: AIGeneratedQuestion[] = [];
  const invalid: AIGeneratedQuestion[] = [];
  const seenInBatch: string[] = [...previousQuestions];

  for (const q of questions) {
    const issues: string[] = [];

    // Non-empty question
    if (!q.question || q.question.trim().length < 10) {
      issues.push("Question text is empty or too short");
    }

    // Expected answer exists
    if (!q.expectedAnswer || q.expectedAnswer.trim().length < 10) {
      issues.push("Expected answer is missing or too short");
    }

    // Evaluation points exist
    if (
      !q.evaluationPoints ||
      !Array.isArray(q.evaluationPoints) ||
      q.evaluationPoints.length === 0
    ) {
      issues.push("Evaluation points are missing");
    }

    // Valid difficulty
    if (q.difficulty && !VALID_DIFFICULTIES.has(q.difficulty)) {
      // Auto-fix: normalize to nearest valid value
      q.difficulty = "medium";
    }

    // Valid type
    if (q.type && !VALID_TYPES.has(q.type)) {
      // Auto-fix: default to conceptual
      q.type = "conceptual";
    }

    // Duplicate detection
    if (q.question && isDuplicate(q.question, seenInBatch)) {
      issues.push("Question is substantially similar to a previous question");
    }

    if (issues.length === 0) {
      valid.push(q);
      seenInBatch.push(q.question);
    } else {
      invalid.push(q);
    }
  }

  return { valid, invalid };
}

// ---------------------------------------------------------------------------
// 5. DUPLICATE DETECTION
// ---------------------------------------------------------------------------

/**
 * Lightweight duplicate detection using normalized word overlap (Jaccard similarity).
 * Treats questions with > 70% word overlap as substantially duplicate.
 *
 * Example: "What is L1 and L2 regularization?" and "Explain the difference between
 * L1 and L2 regularization." would be detected as duplicates.
 */
export function isDuplicate(
  candidate: string,
  existing: string[],
  threshold = 0.7
): boolean {
  const candidateWords = normalizeForComparison(candidate);
  if (candidateWords.size === 0) return false;

  for (const prev of existing) {
    const prevWords = normalizeForComparison(prev);
    if (prevWords.size === 0) continue;

    let intersectionCount = 0;
    candidateWords.forEach((w) => {
      if (prevWords.has(w)) intersectionCount++;
    });
    const unionSize = candidateWords.size + prevWords.size - intersectionCount;
    if (unionSize > 0 && intersectionCount / unionSize >= threshold) return true;
  }

  return false;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "and", "or", "but", "if",
  "for", "in", "on", "at", "to", "from", "by", "with", "of", "about",
  "between", "into", "through", "during", "before", "after", "above",
  "below", "up", "down", "out", "off", "over", "under", "again",
  "further", "then", "once", "here", "there", "when", "where", "why",
  "how", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "what", "which", "who", "whom", "this",
  "that", "these", "those", "it", "its", "you", "your", "me", "my",
  "we", "our", "they", "their", "he", "she", "him", "her",
]);

function normalizeForComparison(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

// ---------------------------------------------------------------------------
// 6. ERROR CLASS
// ---------------------------------------------------------------------------

export class AIQuestionGenerationError extends Error {
  cause?: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "AIQuestionGenerationError";
    this.cause = cause;
  }
}
