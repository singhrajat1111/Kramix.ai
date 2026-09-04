export type ExperienceLevel =
  | "Internship / Student"
  | "Entry Level (0-2 years)"
  | "Mid Level (3-5 years)"
  | "Senior Level (5-8 years)"
  | "Lead / Principal (8+ years)"
  | "Executive / Management";

export interface CandidateProfile {
  targetRole: string;
  targetCompanies: string[];
  experienceLevel: ExperienceLevel;
  skills: string[];
  jobDescription?: string;
  resumeText?: string;
  resumeFileName?: string;
  additionalContext?: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  targetRole: "Machine Learning Engineer",
  targetCompanies: ["Google"],
  experienceLevel: "Entry Level (0-2 years)",
  skills: ["Python", "PyTorch", "System Design", "Algorithms"],
  jobDescription: "",
  resumeText: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
