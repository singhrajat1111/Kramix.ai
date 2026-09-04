import { LLMProvider } from "@/types/ai";
import { CandidateProfile } from "@/types/candidate";
import {
  InterviewRoundInfo,
  QuestionBankItem,
  ResearchFlag,
  ResearchPlan,
  ResearchProgressState,
  ResearchSource,
  SearchResult,
} from "@/types/research";
import { sanitizeUntrustedText } from "../ai/prompt-defense";
import { BlueprintGenerator } from "./blueprint-generator";
import { EvidenceEngine } from "./evidence-engine";
import { COMPANY_ROLE_RESEARCH_BANK, generateGenericRoleResearch } from "./mock-research-bank";
import { getResearchProvider } from "./providers/research-provider-factory";
import { ResearchProvider } from "./providers/research-provider.interface";
import { QueryPlanner } from "./query-planner";
import { ResearchCache } from "./research-cache";

const ALL_FLAGS: ResearchFlag[] = [
  "RESEARCH_COMPANY",
  "RESEARCH_ROLE",
  "RESEARCH_INTERVIEW_ROUNDS",
  "RESEARCH_SKILLS",
  "RESEARCH_QUESTIONS",
  "RESEARCH_BEHAVIORAL",
  "RESEARCH_TECHNICAL",
  "BUILD_INTERVIEW_PLAN",
];

const FLAG_DESCRIPTIONS: Record<ResearchFlag, string> = {
  "RESEARCH_COMPANY": "Investigating company engineering culture, values, and tech stack...",
  "RESEARCH_ROLE": "Analyzing core responsibilities, level expectations, and competency bar...",
  "RESEARCH_INTERVIEW_ROUNDS": "Uncovering verified interview stages and round sequences...",
  "RESEARCH_SKILLS": "Extracting essential technical and soft skills...",
  "RESEARCH_QUESTIONS": "Compiling historical question categories and assessment patterns...",
  "RESEARCH_BEHAVIORAL": "Structuring behavioral frameworks (STAR) and leadership principles...",
  "RESEARCH_TECHNICAL": "Mapping critical technical topics, architecture, and coding focus areas...",
  "BUILD_INTERVIEW_PLAN": "Synthesizing source-grounded interview blueprint and brief...",
};

export class ResearchPlanner {
  private candidate: CandidateProfile;
  private llmProvider: LLMProvider;
  private researchProvider: ResearchProvider;

  constructor(
    candidate: CandidateProfile,
    llmProvider: LLMProvider,
    researchProvider?: ResearchProvider
  ) {
    this.candidate = candidate;
    this.llmProvider = llmProvider;
    this.researchProvider = researchProvider || getResearchProvider();
  }

  async runPipeline(
    onProgress?: (state: ResearchProgressState) => void,
    targetRound?: InterviewRoundInfo
  ): Promise<ResearchPlan> {
    const company = sanitizeUntrustedText(this.candidate.targetCompanies[0] || "Target Company");
    const role = sanitizeUntrustedText(this.candidate.targetRole || "Software Engineer");
    const level = this.candidate.experienceLevel || "Mid Level (3-5 years)";

    // 1. Check Research Cache
    const cacheKey = ResearchCache.generateKey(company, role, level);
    const cachedPlan = ResearchCache.get(cacheKey);
    if (cachedPlan) {
      if (onProgress) {
        onProgress({
          currentFlag: null,
          completedFlags: [...ALL_FLAGS],
          percent: 100,
          statusMessage: "Loaded verified interview blueprint from cache.",
          sourcesFoundCount: cachedPlan.sources.length,
        });
      }
      return cachedPlan;
    }

    // 2. Query Planning
    const plannedQueries = QueryPlanner.planQueries(this.candidate, targetRound);
    const completedFlags: ResearchFlag[] = [];
    const allSearchResults: SearchResult[] = [];
    const searchResultsByArea: Record<string, ResearchSource[]> = {};
    const executedQueryStrings: string[] = [];

    // 3. Execute Research Across Pipeline Flags
    for (let i = 0; i < ALL_FLAGS.length; i++) {
      const flag = ALL_FLAGS[i];
      const querySpec = plannedQueries.find((q) => q.flag === flag);

      if (onProgress) {
        onProgress({
          currentFlag: flag,
          completedFlags: [...completedFlags],
          percent: Math.round((i / ALL_FLAGS.length) * 100),
          statusMessage: FLAG_DESCRIPTIONS[flag],
          currentQuery: querySpec?.query,
          sourcesFoundCount: allSearchResults.length,
        });
      }

      if (querySpec && flag !== "BUILD_INTERVIEW_PLAN") {
        executedQueryStrings.push(querySpec.query);
        try {
          const results = await this.researchProvider.search(querySpec.query, { maxResults: 3 });
          allSearchResults.push(...results);

          // Map results to area for evidence claims
          const areaKey = flag.replace("RESEARCH_", "").toLowerCase();
          searchResultsByArea[areaKey] = EvidenceEngine.toResearchSources(results);
        } catch (err) {
          console.warn(`Search failed for flag ${flag}`, err);
        }
      }

      // Small pacing delay for observable UI progress
      await new Promise((res) => setTimeout(res, 220));
      completedFlags.push(flag);
    }

    // 4. Source Filtering, Deduplication & Classification
    const dedupedResults = EvidenceEngine.filterAndDeduplicate(allSearchResults);
    const liveSources = EvidenceEngine.toResearchSources(dedupedResults);

    // 5. Conflict Detection
    const roundConflicts = EvidenceEngine.detectConflicts(dedupedResults, "rounds");
    const conflictsDetected: string[] = [];
    if (roundConflicts.hasConflict && roundConflicts.summaryNote) {
      conflictsDetected.push(roundConflicts.summaryNote);
    }

    // 6. Base Curated Profile Lookup or Fallback
    const curatedKey = `${company.toLowerCase()}_${role.toLowerCase().includes("machine") || role.toLowerCase().includes("ml") ? "ml" : "swe"}`;
    const isCurated = Boolean(COMPANY_ROLE_RESEARCH_BANK[curatedKey]);
    const baseProfile = COMPANY_ROLE_RESEARCH_BANK[curatedKey] || generateGenericRoleResearch(company, role);

    // Combine sources: live search results + base verified sources
    const combinedSources: ResearchSource[] = [...liveSources];
    for (const s of baseProfile.sources) {
      if (!combinedSources.some((cs) => cs.url === s.url || cs.title === s.title)) {
        combinedSources.push(s);
      }
    }

    // 7. Structured Claims & Provenance
    const claims = EvidenceEngine.buildClaims(company, role, searchResultsByArea);

    // If company/role yielded zero live search results and is not curated, classify claims as UNKNOWN
    if (liveSources.length === 0 && !isCurated) {
      claims.forEach((c) => {
        c.classification = "UNKNOWN";
        c.confidence = "Low";
        c.rationale = `Insufficient reliable evidence found online for ${company}. Defaulting to generic industry engineering competencies.`;
      });
    }

    // 8. Questions with Novelty Hash & Reason
    const enrichedQuestionBank: QuestionBankItem[] = baseProfile.questionBank.map((q) => {
      const qHash = BlueprintGenerator.hashQuestion(q.questionText);
      const matchingClaim = claims.find((c) => c.area === "technical") || claims[0];
      return {
        ...q,
        questionHash: qHash,
        reason: `Derived from ${company} ${q.category} competency bar: ${q.intent}`,
        evidenceSources: matchingClaim ? matchingClaim.sources.map((s) => s.title).slice(0, 2) : [],
      };
    });

    // 9. Job Description Integration (Untrusted Candidate Input)
    let candidateJdSummary: string[] = [];
    if (this.candidate.jobDescription?.trim()) {
      const cleanJd = sanitizeUntrustedText(this.candidate.jobDescription, 3000);
      const lines = cleanJd.split("\n").filter((l) => l.trim().length > 10).slice(0, 3);
      candidateJdSummary = lines.map((l) => `Candidate JD: ${l.trim().slice(0, 100)}`);
    }

    // 10. Assemble Research Plan
    const isLive = Boolean(this.researchProvider.name.toLowerCase().includes("live") || (this.researchProvider as unknown as { isConfigured?: () => boolean })?.isConfigured?.());

    let plan: ResearchPlan = {
      id: `plan_${Date.now()}`,
      targetCompany: company,
      targetRole: role,
      companyOverview: {
        summary: baseProfile.overview.summary,
        cultureValues: baseProfile.overview.cultureValues,
        techStackKeywords: baseProfile.overview.techStackKeywords,
        engineeringFocus: baseProfile.overview.engineeringFocus,
        isVerified: combinedSources.some((s) => s.reliability === "verified" && s.tier === 1),
        relevantEngineeringAreas: baseProfile.overview.techStackKeywords.slice(0, 4),
        hiringContext: isCurated
          ? `Standard hiring loop for ${company} engineering org.`
          : liveSources.length > 0
          ? `Aggregated hiring benchmarks for ${company}.`
          : `Insufficient verified disclosures for ${company}. Using standard industry preparation bar.`,
      },
      roleExpectations: {
        coreResponsibilities: [
          `Architect and maintain high-performance software and systems for ${role} responsibilities.`,
          "Collaborate across multi-disciplinary teams to establish engineering excellence.",
          "Diagnose and resolve production reliability and latency bottlenecks.",
          ...candidateJdSummary,
        ],
        technicalCompetencies:
          this.candidate.skills.length > 0
            ? this.candidate.skills
            : ["Data Structures", "Algorithms", "System Architecture", "Telemetry & Testing"],
        senioritySignals: [
          `Clear articulation of trade-offs aligned with ${level}.`,
          "Proactive error handling and defensive system design under peak load.",
        ],
      },
      rounds: baseProfile.rounds.map((r, idx) => ({
        ...r,
        confidence: isCurated ? ("High" as const) : liveSources.length > 2 ? ("Medium" as const) : ("Low" as const),
        classification: isCurated ? ("VERIFIED" as const) : liveSources.length > 2 ? ("SUPPORTED" as const) : ("INFERRED" as const),
        supportingSourceCount: combinedSources.length,
      })),
      technicalTopics: baseProfile.technicalTopics.map((t) => ({
        ...t,
        evidenceConfidence: isCurated ? ("High" as const) : ("Medium" as const),
      })),
      behavioralTopics: baseProfile.behavioralTopics.map((b) => ({
        ...b,
        evidenceConfidence: isCurated ? ("High" as const) : ("Medium" as const),
      })),
      questionBank: enrichedQuestionBank,
      sources: combinedSources,
      claims,
      isRealResearch: isLive || isCurated,
      isLiveSearch: isLive && liveSources.length > 0,
      searchQueriesExecuted: executedQueryStrings,
      conflictsDetected,
      completedFlags: [...completedFlags],
      generatedAt: Date.now(),
    };

    // 11. LLM-Assisted Synthesis (if configured & not demo)
    if (this.llmProvider.isConfigured() && this.llmProvider.type !== "demo") {
      try {
        const enrichedSummary = await this.llmProvider.generateStructuredJSON<{
          companySummary: string;
          roundsSummary: string[];
        }>([
          {
            role: "system",
            content:
              "You are an expert tech recruiter and interview coach. Provide a factual, conservative summary of interview patterns. Distinguish verified company facts from inference. Never hallucinate internal confidential processes.",
          },
          {
            role: "user",
            content: `Target Company: ${company}\nTarget Role: ${role}\nExperience Level: ${level}\nAvailable Sources:\n${combinedSources.slice(0, 4).map((s) => `- ${s.title}: ${s.snippet || ""}`).join("\n")}`,
          },
        ]);

        if (enrichedSummary?.companySummary) {
          plan.companyOverview.summary = enrichedSummary.companySummary;
        }
      } catch (err) {
        console.warn("LLM research enrichment skipped; falling back to source-grounded profile", err);
      }
    }

    // 12. Generate Blueprint & Candidate Brief
    const activeRound = targetRound || plan.rounds[0];
    plan.blueprint = BlueprintGenerator.generateBlueprint(
      this.candidate,
      activeRound,
      plan.claims,
      plan.sources,
      plan.questionBank
    );

    plan.candidateBriefSummary = BlueprintGenerator.generateCandidateBrief(
      plan,
      this.candidate,
      conflictsDetected
    );

    // 13. Save to Cache
    ResearchCache.set(cacheKey, plan);

    if (onProgress) {
      onProgress({
        currentFlag: null,
        completedFlags: [...completedFlags],
        percent: 100,
        statusMessage: "Source-grounded interview blueprint synthesized successfully.",
        sourcesFoundCount: plan.sources.length,
      });
    }

    return plan;
  }
}
