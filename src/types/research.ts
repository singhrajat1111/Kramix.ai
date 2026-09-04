export type ResearchFlag =
  | "RESEARCH_COMPANY"
  | "RESEARCH_ROLE"
  | "RESEARCH_INTERVIEW_ROUNDS"
  | "RESEARCH_SKILLS"
  | "RESEARCH_QUESTIONS"
  | "RESEARCH_BEHAVIORAL"
  | "RESEARCH_TECHNICAL"
  | "BUILD_INTERVIEW_PLAN";

export type EvidenceClassification = "VERIFIED" | "SUPPORTED" | "INFERRED" | "UNKNOWN";
export type EvidenceConfidence = "High" | "Medium" | "Low";
export type SourceTier = 1 | 2 | 3; // 1: Official, 2: High-Quality Industry, 3: Community

export interface ResearchSource {
  title: string;
  url?: string;
  sourceType: "public_profile" | "engineering_blog" | "interview_archive" | "ai_synthesis" | "official_careers" | "community_forum" | "job_description";
  reliability: "verified" | "corroborated" | "inferred";
  tier?: SourceTier;
  domain?: string;
  snippet?: string;
  publishedAt?: string;
  retrievedAt?: number;
  note?: string;
}

export interface ResearchClaim {
  id: string;
  area: "company" | "role" | "rounds" | "skills" | "questions" | "behavioral" | "technical";
  claim: string;
  classification: EvidenceClassification;
  confidence: EvidenceConfidence;
  rationale: string;
  sources: ResearchSource[];
  publishedAt?: string;
  retrievedAt: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceDomain: string;
  tier: SourceTier;
  publishedDate?: string;
  retrievedDate: number;
}

export interface SearchOptions {
  maxResults?: number;
  tierFilter?: SourceTier[];
}

export interface InterviewRoundInfo {
  id: string;
  roundNumber: number;
  name: string;
  category: "screening" | "technical" | "system_design" | "coding" | "behavioral" | "leadership" | "domain_deep_dive";
  description: string;
  typicalDurationMinutes: number;
  focusAreas: string[];
  sampleQuestions: string[];
  evidenceNote?: string;
  confidence?: EvidenceConfidence;
  classification?: EvidenceClassification;
  supportingSourceCount?: number;
}

export interface QuestionBankItem {
  id: string;
  roundCategory: string;
  category: "Technical" | "Coding" | "System Design" | "Machine Learning" | "Behavioral" | "Situational" | "Resume Deep Dive";
  questionText: string;
  intent: string;
  evaluationCriteria: string[];
  difficulty: "Junior" | "Mid" | "Senior" | "Staff";
  reason?: string;
  evidenceSources?: string[];
  questionHash?: string;
}

export interface InterviewBlueprint {
  company: string;
  role: string;
  experienceLevel: string;
  round: InterviewRoundInfo;
  objectives: string[];
  competencyTopics: Array<{
    topic: string;
    priority: "high" | "medium";
    targetQuestions: number;
    rationale: string;
    evidenceSources: string[];
  }>;
  questionBudget: number;
  difficultyRange: "Junior" | "Mid" | "Senior" | "Staff";
  technicalWeight: number; // 0 to 100
  behavioralWeight: number; // 0 to 100
  followUpPolicy: {
    maxFollowUps: number;
    triggers: string[];
  };
  completionCriteria: string[];
  provenanceClaims: ResearchClaim[];
}

export interface CandidateBriefSummary {
  executiveSummary: string;
  whatAppearsImportant: string[];
  likelyStructureNotes: string;
  technicalFocus: string[];
  behavioralFocus: string[];
  confidenceSummary: string;
  recencyNote?: string;
}

export interface ResearchPlan {
  id: string;
  targetRole: string;
  targetCompany: string;
  companyOverview: {
    summary: string;
    cultureValues: string[];
    techStackKeywords: string[];
    engineeringFocus: string;
    isVerified: boolean;
    hiringContext?: string;
    relevantEngineeringAreas?: string[];
    aiMlFocus?: string;
    officialCareersUrl?: string;
  };
  roleExpectations: {
    coreResponsibilities: string[];
    technicalCompetencies: string[];
    senioritySignals: string[];
    requiredTechnologies?: string[];
    likelyResponsibilities?: string[];
    behavioralCompetencies?: string[];
  };
  rounds: InterviewRoundInfo[];
  technicalTopics: Array<{ name: string; importance: "high" | "medium" | "low"; description: string; evidenceConfidence?: EvidenceConfidence }>;
  behavioralTopics: Array<{ name: string; framework: string; keyTraits: string[]; evidenceConfidence?: EvidenceConfidence }>;
  questionBank: QuestionBankItem[];
  sources: ResearchSource[];
  claims: ResearchClaim[];
  blueprint?: InterviewBlueprint;
  isRealResearch: boolean;
  isLiveSearch?: boolean;
  searchQueriesExecuted?: string[];
  conflictsDetected?: string[];
  candidateBriefSummary?: CandidateBriefSummary;
  completedFlags: ResearchFlag[];
  generatedAt: number;
}

export interface ResearchProgressState {
  currentFlag: ResearchFlag | null;
  completedFlags: ResearchFlag[];
  percent: number;
  statusMessage: string;
  error?: string;
  currentQuery?: string;
  sourcesFoundCount?: number;
}
