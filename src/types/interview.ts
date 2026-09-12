import { InterviewRoundInfo } from "./research";
import { InterviewMode } from "./interview-mode";

export type InterviewState =
  | "IDLE"
  | "PREPARING"
  | "GENERATING"
  | "READY"
  | "INTRO"
  | "QUESTION"
  | "ASKING"
  | "LISTENING"
  | "PROCESSING"
  | "RESPONDING"
  | "FOLLOW_UP"
  | "TRANSITIONING"
  | "ROUND_COMPLETE"
  | "EVALUATION"
  | "FAILED";

export interface CandidateAnswer {
  questionId: string;
  questionText: string;
  candidateSpeech: string;
  audioDurationSeconds: number;
  timestamp: number;
  followUpToQuestionId?: string;
  isFollowUp: boolean;
}

export interface ConversationTurn {
  id: string;
  role: "interviewer" | "candidate" | "system";
  text: string;
  timestamp: number;
  state: InterviewState;
  questionNumber?: number;
  isFollowUp?: boolean;
}

export interface PreviousRoundSummary {
  roundTitle: string;
  category: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface InterviewDirectorConfig {
  interviewMode: InterviewMode;
  maxDurationMinutes: number;
  maxQuestions: number;
  maxFollowUpsPerQuestion: number;
  targetRound: InterviewRoundInfo;
  allowCoachingHints?: boolean;
  blueprint?: import("./research").InterviewBlueprint;
  previousRoundContext?: PreviousRoundSummary[];
  previouslyAskedQuestions?: string[];
}

export interface InterviewDirectorState {
  interviewMode: InterviewMode;
  currentState: InterviewState;
  currentQuestionIndex: number;
  totalQuestionsPlanned: number;
  currentFollowUpCount: number;
  activeQuestionId: string | null;
  activeQuestionText: string;
  topicsCovered: string[];
  topicsRemaining: string[];
  candidateResponses: CandidateAnswer[];
  conversationHistory: ConversationTurn[];
  startTime: number | null;
  endTime: number | null;
  elapsedSeconds: number;
  isFinished: boolean;
  completionReason?: "ROUND_GOALS_MET" | "TIME_EXPIRED" | "USER_CONCLUDED" | "ERROR";
}
