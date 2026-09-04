import { CandidateProfile } from "./candidate";
import { InterviewReport } from "./evaluation";
import { InterviewRoundInfo, ResearchPlan } from "./research";
import { CandidateAnswer } from "./interview";

export type SimulationMode = "FULL_SIMULATION" | "PRACTICE_ROUND";

export type RoundSessionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface InterviewRoundSession {
  roundId: string;
  roundNumber: number;
  title: string;
  category: "screening" | "technical" | "system_design" | "coding" | "behavioral" | "leadership" | "domain_deep_dive";
  description: string;
  competencies: string[];
  estimatedDuration: number;
  difficulty: "Junior" | "Mid" | "Senior" | "Staff";
  status: RoundSessionStatus;
  questionsAsked: number;
  answers: CandidateAnswer[];
  evaluation?: InterviewReport;
  score?: number;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  startedAt?: number;
  completedAt?: number;
}

export type HiringRecommendation =
  | "STRONG HIRE"
  | "LEAN HIRE"
  | "LEAN NO HIRE"
  | "STRONG NO HIRE";

export interface CommitteeScorecard {
  technicalCompetency?: number;
  problemSolving?: number;
  systemDesign?: number;
  communication?: number;
  roleRelevance?: number;
  behavioral?: number;
  confidence?: number;
  compositeScore: number;
}

export interface RoundPerformanceSummary {
  roundNumber: number;
  roundTitle: string;
  category: string;
  score: number;
  status: RoundSessionStatus;
  strengths: string[];
  weaknesses: string[];
  keyTakeaway: string;
}

export interface EvidenceNote {
  roundTitle: string;
  questionNumber?: number;
  observation: string;
  impact: "positive" | "concern";
}

export interface PreparationDrill {
  priorityNumber: 1 | 2 | 3;
  title: string;
  reason: string;
  practiceDrill: string[];
  suggestedQuestion: string;
}

export interface HiringCommitteeDossier {
  id: string;
  sessionId: string;
  candidateName: string;
  targetRole: string;
  targetCompany: string;
  experienceLevel: string;
  generatedAt: number;
  totalDurationMinutes: number;
  roundsCompleted: number;
  totalRoundsPlanned: number;
  questionsAnswered: number;
  finalRecommendation: HiringRecommendation;
  scorecard: CommitteeScorecard;
  roundPerformances: RoundPerformanceSummary[];
  bestRound: {
    title: string;
    score: number;
  };
  mostChallengingRound: {
    title: string;
    score: number;
  };
  narrative: {
    executiveAssessment: string;
    strengths: string[];
    concerns: string[];
    roleFit: string;
    evidenceNotes: EvidenceNote[];
    improvementTrajectory: string;
    consistencyNotes?: string;
  };
  preparationRoadmap: {
    priorities: PreparationDrill[];
  };
}

export interface InterviewSession {
  sessionId: string;
  candidateProfile: CandidateProfile;
  targetCompany: string;
  targetRole: string;
  experienceLevel: string;
  interviewPlan: ResearchPlan;
  simulationMode: SimulationMode;
  currentRoundIndex: number;
  rounds: InterviewRoundSession[];
  roundResults: InterviewReport[];
  totalQuestions: number;
  totalAnsweredQuestions: number;
  sessionStartedAt: number;
  sessionCompletedAt?: number;
  overallProgress: number; // 0 to 100
  finalDossier?: HiringCommitteeDossier;
  avatar?: {
    type: "default" | "image" | "video";
    assetUrl?: string;
  };
}
