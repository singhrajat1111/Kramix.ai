export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  candidateAnswer: string;
  scoreOutOfTen: number;
  whatWentWell: string[];
  whatCouldImprove: string[];
  idealDirection: string;
  topicTag: string;
}

export interface PreparationPriority {
  priorityNumber: 1 | 2 | 3;
  topic: string;
  reason: string;
  recommendedPractice: string[];
  suggestedQuestions: string[];
  resourceRecommendations?: string[];
}

export interface InterviewReport {
  id: string;
  targetRole: string;
  targetCompany: string;
  roundName: string;
  timestamp: number;
  durationMinutes: number;
  overallScore: number; // 0 to 100
  scoringBreakdown: {
    communication: number; // 0 to 100
    technicalKnowledge: number;
    problemSolving: number;
    roleRelevance: number;
    confidenceAndClarity: number;
  };
  strengths: string[];
  weaknesses: string[];
  questionEvaluations: QuestionEvaluation[];
  actionablePlan: {
    summary: string;
    priorities: PreparationPriority[];
    keyTakeaway: string;
  };
}
