import { CandidateProfile } from "@/types/candidate";
import { InterviewRoundInfo, ResearchFlag } from "@/types/research";

export interface PlannedQuery {
  flag: ResearchFlag;
  query: string;
  purpose: string;
}

export class QueryPlanner {
  static planQueries(
    candidate: CandidateProfile,
    targetRound?: InterviewRoundInfo
  ): PlannedQuery[] {
    const company = (candidate.targetCompanies[0] || "Target Company").trim();
    const role = (candidate.targetRole || "Software Engineer").trim();
    const level = candidate.experienceLevel || "Mid Level";
    const roundName = targetRound?.name || "";

    const queries: PlannedQuery[] = [
      {
        flag: "RESEARCH_COMPANY",
        query: `"${company}" engineering culture technology stack values`,
        purpose: "Company technical focus, engineering pillars, and core technologies",
      },
      {
        flag: "RESEARCH_ROLE",
        query: `"${company}" "${role}" job requirements responsibilities "${level}"`,
        purpose: "Role competencies, expectations, and senior hiring bar",
      },
      {
        flag: "RESEARCH_INTERVIEW_ROUNDS",
        query: `"${company}" "${role}" interview rounds stages process timeline`,
        purpose: "Documented interview progression and round sequences",
      },
      {
        flag: "RESEARCH_SKILLS",
        query: `"${company}" "${role}" essential skills technologies frameworks`,
        purpose: "Crucial languages, libraries, and architectural toolchains",
      },
      {
        flag: "RESEARCH_TECHNICAL",
        query: roundName
          ? `"${company}" "${role}" "${roundName}" technical interview questions system design`
          : `"${company}" "${role}" technical coding system design architecture questions`,
        purpose: "Technical interview focus, architecture benchmarks, and coding primitives",
      },
      {
        flag: "RESEARCH_BEHAVIORAL",
        query: `"${company}" leadership principles behavioral interview questions STAR method`,
        purpose: "Cultural leadership tenets and common behavioral evaluation themes",
      },
      {
        flag: "RESEARCH_QUESTIONS",
        query: `"${company}" "${role}" recent interview questions candidate debrief`,
        purpose: "Aggregated candidate debrief questions and historical assessment patterns",
      },
    ];

    return queries;
  }
}
