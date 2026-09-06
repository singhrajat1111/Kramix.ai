import { StorageManager } from "@/lib/storage/storage-manager";
import { CandidateProfile } from "@/types/candidate";
import { ResearchPlan, InterviewRoundInfo } from "@/types/research";
import { InterviewReport } from "@/types/evaluation";
import { HiringCommitteeDossier, InterviewSession } from "@/types/session";

export type AppStepPath = "/setup" | "/research" | "/device-check" | "/interview" | "/results";

export interface StepGuardResult {
  allowed: boolean;
  redirectPath?: string;
  reason?: string;
}

/**
 * Validates whether a candidate profile has the minimum required data
 * to initiate research and question generation.
 */
export function isProfileComplete(profile: CandidateProfile | null | undefined): boolean {
  if (!profile) return false;
  const hasRole = Boolean(profile.targetRole && profile.targetRole.trim().length > 0);
  const hasCompany = Boolean(
    profile.targetCompanies &&
    profile.targetCompanies.length > 0 &&
    profile.targetCompanies[0].trim().length > 0
  );
  return hasRole && hasCompany;
}

/**
 * Validates whether a research plan exists and is populated with interview rounds.
 */
export function isResearchPlanValid(plan: ResearchPlan | null | undefined): boolean {
  if (!plan) return false;
  return Boolean(
    plan.targetCompany &&
    plan.targetRole &&
    Array.isArray(plan.rounds) &&
    plan.rounds.length > 0
  );
}

/**
 * Validates whether an interview round has been actively selected.
 */
export function isRoundSelected(round: InterviewRoundInfo | null | undefined): boolean {
  if (!round) return false;
  return Boolean(round.id && round.name);
}

/**
 * Validates whether evaluation report or dossier is available.
 */
export function hasEvaluationResults(
  report: InterviewReport | null | undefined,
  dossier: HiringCommitteeDossier | null | undefined,
  session: InterviewSession | null | undefined
): boolean {
  if (report && report.overallScore !== undefined) return true;
  if (dossier && (dossier.finalRecommendation || (dossier as any).recommendation)) return true;
  if (session && session.roundResults && session.roundResults.length > 0) return true;
  return false;
}

export interface RouteCheckContext {
  profile?: CandidateProfile | null;
  plan?: ResearchPlan | null;
  selectedRound?: InterviewRoundInfo | null;
  report?: InterviewReport | null;
  dossier?: HiringCommitteeDossier | null;
  session?: InterviewSession | null;
}

/**
 * Authoritative Step Progression Guard
 * Checks current client storage (or provided context) to verify whether a given route is unlocked.
 */
export function checkRouteAccess(targetPath: string, context?: RouteCheckContext): StepGuardResult {
  // Step 1: /setup is always universally accessible
  if (targetPath === "/setup" || targetPath === "/") {
    return { allowed: true };
  }

  const profile = context ? context.profile : StorageManager.getCandidateProfile();

  // Step 2: /research requires a configured candidate profile
  if (targetPath === "/research") {
    if (!isProfileComplete(profile)) {
      return {
        allowed: false,
        redirectPath: "/setup",
        reason: "Please specify your target role and target company first.",
      };
    }
    return { allowed: true };
  }

  const plan = context ? context.plan : StorageManager.getResearchPlan();
  const selectedRound = context ? context.selectedRound : StorageManager.getSelectedRound();

  // Step 3: /device-check requires candidate profile + research plan + selected round
  if (targetPath === "/device-check") {
    if (!isProfileComplete(profile)) {
      return {
        allowed: false,
        redirectPath: "/setup",
        reason: "Please configure your candidate profile before hardware check.",
      };
    }
    if (!isResearchPlanValid(plan) || !isRoundSelected(selectedRound)) {
      return {
        allowed: false,
        redirectPath: "/research",
        reason: "Please complete company research and select an interview round first.",
      };
    }
    return { allowed: true };
  }

  // Step 4: /interview requires profile + selected round
  if (targetPath === "/interview") {
    if (!isProfileComplete(profile)) {
      return {
        allowed: false,
        redirectPath: "/setup",
        reason: "Please configure your profile first.",
      };
    }
    if (!isRoundSelected(selectedRound)) {
      return {
        allowed: false,
        redirectPath: "/research",
        reason: "Please select an interview round to begin simulation.",
      };
    }
    return { allowed: true };
  }

  // Step 5: /results requires at least one completed evaluation
  if (targetPath === "/results") {
    const report = context ? context.report : StorageManager.getLatestReport();
    const dossier = context ? context.dossier : StorageManager.getLatestDossier();
    const session = context ? context.session : StorageManager.getInterviewSession();

    if (!hasEvaluationResults(report, dossier, session)) {
      return {
        allowed: false,
        redirectPath: "/interview",
        reason: "No interview results found. Please complete an interview round first.",
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Returns which steps in the navigation stepper are currently unlocked.
 */
export function getUnlockedSteps(context?: RouteCheckContext): Record<string, boolean> {
  const profile = context ? context.profile : StorageManager.getCandidateProfile();
  const plan = context ? context.plan : StorageManager.getResearchPlan();
  const selectedRound = context ? context.selectedRound : StorageManager.getSelectedRound();
  const report = context ? context.report : StorageManager.getLatestReport();
  const dossier = context ? context.dossier : StorageManager.getLatestDossier();
  const session = context ? context.session : StorageManager.getInterviewSession();

  const profileReady = isProfileComplete(profile);
  const researchReady = profileReady && isResearchPlanValid(plan) && isRoundSelected(selectedRound);
  const resultsReady = hasEvaluationResults(report, dossier, session);

  return {
    "/setup": true,
    "/research": profileReady,
    "/device-check": researchReady,
    "/interview": researchReady,
    "/results": resultsReady,
  };
}
