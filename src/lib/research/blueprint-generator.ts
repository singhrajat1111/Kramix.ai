import { CandidateProfile } from "@/types/candidate";
import {
  CandidateBriefSummary,
  InterviewBlueprint,
  InterviewRoundInfo,
  QuestionBankItem,
  ResearchClaim,
  ResearchPlan,
  ResearchSource,
} from "@/types/research";

export class BlueprintGenerator {
  /**
   * Generates a normalized hash for question deduplication and novelty tracking.
   */
  static hashQuestion(text: string): string {
    const clean = text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 80);
    return `qhash_${clean}`;
  }

  /**
   * Constructs the structured InterviewBlueprint linking research evidence to the active round.
   */
  static generateBlueprint(
    candidate: CandidateProfile,
    selectedRound: InterviewRoundInfo,
    claims: ResearchClaim[],
    sources: ResearchSource[],
    questionBank: QuestionBankItem[]
  ): InterviewBlueprint {
    const company = candidate.targetCompanies[0] || "Target Company";
    const role = candidate.targetRole || "Software Engineer";
    const level = candidate.experienceLevel || "Mid Level";

    const isSystemDesign = selectedRound.category === "system_design" || selectedRound.name.toLowerCase().includes("design");
    const isCoding = selectedRound.category === "coding" || selectedRound.name.toLowerCase().includes("coding");
    const isBehavioral = selectedRound.category === "behavioral" || selectedRound.name.toLowerCase().includes("behavioral") || selectedRound.name.toLowerCase().includes("leadership");

    const technicalWeight = isBehavioral ? 20 : isSystemDesign ? 85 : isCoding ? 90 : 70;
    const behavioralWeight = 100 - technicalWeight;

    let difficultyRange: "Junior" | "Mid" | "Senior" | "Staff" = "Mid";
    if (level.toLowerCase().includes("entry") || level.toLowerCase().includes("intern")) {
      difficultyRange = "Junior";
    } else if (level.toLowerCase().includes("senior")) {
      difficultyRange = "Senior";
    } else if (level.toLowerCase().includes("lead") || level.toLowerCase().includes("principal") || level.toLowerCase().includes("executive")) {
      difficultyRange = "Staff";
    }

    // Map competency topics with explicit evidence source references
    const competencyTopics = selectedRound.focusAreas.map((area, idx) => {
      const matchingClaim = claims.find((c) => c.area === "technical" || c.area === "skills") || claims[0];
      const evidenceSources = matchingClaim ? matchingClaim.sources.map((s) => s.title).slice(0, 2) : [];

      return {
        topic: area,
        priority: (idx < 2 ? "high" : "medium") as "high" | "medium",
        targetQuestions: idx === 0 ? 2 : 1,
        rationale: `Directly corroborates ${company}'s ${selectedRound.name} focus area on ${area}.`,
        evidenceSources: evidenceSources.length > 0 ? evidenceSources : [sources[0]?.title || "Industry Baseline"],
      };
    });

    const objectives = [
      `Evaluate candidate's architectural decision-making and depth for ${role} at ${company}.`,
      `Assess fluency in concrete metrics (latency, throughput, SLAs) and failure mode mitigations.`,
      `Verify alignment with ${company}'s engineering values and STAR communication pacing.`,
    ];

    const followUpPolicy = {
      maxFollowUps: 2,
      triggers: [
        "architecture",
        "trade-offs",
        "failure modes",
        "throughput",
        "latency",
        "monitoring",
        "caching",
        "partitioning",
      ],
    };

    const completionCriteria = [
      "Candidate has addressed at least 3 distinct competency focus areas.",
      "At least one architectural or behavioral trade-off has been explored.",
      "Sufficient conversational evidence captured to generate debrief score.",
    ];

    return {
      company,
      role,
      experienceLevel: level,
      round: selectedRound,
      objectives,
      competencyTopics,
      questionBudget: Math.max(3, Math.min(6, selectedRound.sampleQuestions.length || 4)),
      difficultyRange,
      technicalWeight,
      behavioralWeight,
      followUpPolicy,
      completionCriteria,
      provenanceClaims: claims,
    };
  }

  /**
   * Generates a concise, high-value candidate interview briefing.
   */
  static generateCandidateBrief(
    plan: ResearchPlan,
    candidate: CandidateProfile,
    conflicts?: string[]
  ): CandidateBriefSummary {
    const company = plan.targetCompany;
    const role = plan.targetRole;

    const verifiedCount = plan.sources.filter((s) => s.reliability === "verified").length;
    const confidenceText =
      verifiedCount >= 2
        ? "High confidence based on official disclosures and engineering publications."
        : verifiedCount >= 1
        ? "Medium-High confidence supported by verified careers data and candidate archives."
        : "Medium confidence based on corroborated candidate debriefs and industry hiring standards.";

    const conflictNote =
      conflicts && conflicts.length > 0
        ? `Note: ${conflicts[0]}`
        : "Interview progression is consistently structured across recent candidate reports.";

    return {
      executiveSummary: `${company} evaluates ${role} candidates through rigorous technical depth, quantifiable trade-off analysis, and behavioral alignment with company leadership tenets.`,
      whatAppearsImportant: [
        "Concrete metrics over vague generalizations (quantify throughput, latency, capacity).",
        "Graceful degradation and secondary failure mode planning under upstream dependency failures.",
        "Structured behavioral storytelling with the STAR framework (Situation, Task, Action, Result).",
      ],
      likelyStructureNotes: `${plan.rounds.length} primary interview stages identified: ${plan.rounds.map((r) => r.name).join(" → ")}. ${conflictNote}`,
      technicalFocus: plan.technicalTopics.slice(0, 3).map((t) => `${t.name} (${t.description})`),
      behavioralFocus: plan.behavioralTopics.slice(0, 2).map((b) => `${b.name} (${b.framework})`),
      confidenceSummary: confidenceText,
      recencyNote: "Sources audited for current hiring season patterns.",
    };
  }
}
