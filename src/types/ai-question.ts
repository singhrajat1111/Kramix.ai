/**
 * Kramix.AI — AI-Generated Interview Question Schema
 *
 * Defines the structured output format that the LLM must return
 * when generating personalized interview questions.
 *
 * IMPORTANT: expectedAnswer and evaluationPoints are interviewer-side data.
 * The candidate must only see the question text.
 */

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionType =
  | "conceptual"
  | "practical"
  | "scenario"
  | "debugging"
  | "architecture"
  | "project"
  | "tradeoff"
  | "behavioral";

export interface AIGeneratedQuestion {
  /** Unique identifier for the generated question */
  id: string;
  /** The interview question text (shown to candidate) */
  question: string;
  /** Difficulty level */
  difficulty: QuestionDifficulty;
  /** Technical topic / domain */
  topic: string;
  /** Question category */
  type: QuestionType;
  /** Model answer — HIDDEN from candidate, used for evaluation */
  expectedAnswer: string;
  /** Key evaluation criteria — HIDDEN from candidate, used for scoring */
  evaluationPoints: string[];
  /** Optional follow-up question */
  followUp?: string;
  /** What context sources informed this question */
  sourceContext: string[];
}

export interface AIQuestionGenerationResult {
  questions: AIGeneratedQuestion[];
}

/**
 * Context object passed to the AI question generator.
 * Only includes fields that actually exist in the CandidateProfile.
 */
export interface InterviewGenerationContext {
  candidate: {
    name?: string;
    skills: string[];
    experienceLevel: string;
    resumeText?: string;
    additionalContext?: string;
  };
  target: {
    role: string;
    company: string;
    jobDescription?: string;
    experienceLevel: string;
  };
  interview: {
    difficulty: string;
    round: string;
    roundCategory: string;
    questionCount: number;
    previousQuestions: string[];
  };
  ragContext: {
    companyOverview?: string;
    cultureValues?: string[];
    techStack?: string[];
    roleExpectations?: string[];
    technicalTopics?: string[];
    behavioralTopics?: string[];
    candidateBrief?: string;
  };
}
