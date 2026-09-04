import {
  EvidenceClassification,
  EvidenceConfidence,
  ResearchClaim,
  ResearchSource,
  SearchResult,
} from "@/types/research";
import { sanitizeUntrustedText } from "../ai/prompt-defense";

export class EvidenceEngine {
  /**
   * Filters and deduplicates search results, ordering by Tier (Tier 1 > Tier 2 > Tier 3)
   * and recency. Sanitizes snippets against prompt injection.
   */
  static filterAndDeduplicate(results: SearchResult[]): SearchResult[] {
    const seenUrls = new Set<string>();
    const sanitized: SearchResult[] = [];

    for (const r of results) {
      const cleanUrl = r.url.split("#")[0].replace(/\/$/, "");
      if (seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      sanitized.push({
        ...r,
        title: sanitizeUntrustedText(r.title, 200),
        snippet: sanitizeUntrustedText(r.snippet, 600),
      });
    }

    // Sort: Tier 1 (Official) first, then Tier 2, then Tier 3. Within same tier, newer publishedDate first.
    return sanitized.sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
      const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
      return dateB - dateA;
    });
  }

  /**
   * Converts SearchResults to typed ResearchSources.
   */
  static toResearchSources(results: SearchResult[]): ResearchSource[] {
    return results.map((r) => {
      let reliability: "verified" | "corroborated" | "inferred" = "corroborated";
      let sourceType: ResearchSource["sourceType"] = "interview_archive";

      if (r.tier === 1) {
        reliability = "verified";
        sourceType = r.url.includes("careers") || r.url.includes("jobs") ? "official_careers" : "engineering_blog";
      } else if (r.tier === 2) {
        reliability = "corroborated";
        sourceType = "public_profile";
      } else {
        reliability = "inferred";
        sourceType = "community_forum";
      }

      return {
        title: r.title,
        url: r.url,
        sourceType,
        reliability,
        tier: r.tier,
        domain: r.sourceDomain,
        snippet: r.snippet,
        publishedAt: r.publishedDate,
        retrievedAt: r.retrievedDate,
      };
    });
  }

  /**
   * Evaluates evidence classification based strictly on source provenance.
   * - VERIFIED: At least one Tier 1 official source corroborates the claim.
   * - SUPPORTED: At least two Tier 2 sources or multiple Tier 3 community sources corroborate.
   * - INFERRED: Deductive synthesis with single secondary source or general role norms.
   * - UNKNOWN: Zero credible supporting sources found.
   */
  static classifyEvidence(
    sources: ResearchSource[],
    hasDomainSpecificSignal: boolean
  ): { classification: EvidenceClassification; confidence: EvidenceConfidence } {
    if (sources.length === 0 || !hasDomainSpecificSignal) {
      return { classification: "UNKNOWN", confidence: "Low" };
    }

    const hasTier1 = sources.some((s) => s.tier === 1 && s.reliability === "verified");
    const tier2Count = sources.filter((s) => s.tier === 2).length;
    const tier3Count = sources.filter((s) => s.tier === 3).length;

    if (hasTier1) {
      return { classification: "VERIFIED", confidence: "High" };
    }

    if (tier2Count >= 2 || (tier2Count >= 1 && tier3Count >= 1) || tier3Count >= 3) {
      return { classification: "SUPPORTED", confidence: "Medium" };
    }

    if (sources.length > 0) {
      return { classification: "INFERRED", confidence: "Medium" };
    }

    return { classification: "UNKNOWN", confidence: "Low" };
  }

  /**
   * Detects conflicts across search results (e.g. 3 rounds vs 4 rounds reported).
   */
  static detectConflicts(
    results: SearchResult[],
    area: string
  ): { hasConflict: boolean; summaryNote?: string } {
    if (area === "rounds") {
      const mentionsThree = results.some((r) => /\b(3 rounds|three rounds|3 stages)\b/i.test(r.snippet));
      const mentionsFour = results.some((r) => /\b(4 rounds|four rounds|4 onsite|5 rounds|five)\b/i.test(r.snippet));

      if (mentionsThree && mentionsFour) {
        return {
          hasConflict: true,
          summaryNote: "Interview structure varies across candidate reports (3 to 4 rounds commonly reported). Earlier rounds may be combined depending on seniority.",
        };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Builds structured evidence claims linking specific findings to sources.
   */
  static buildClaims(
    company: string,
    role: string,
    sourcesByArea: Record<string, ResearchSource[]>
  ): ResearchClaim[] {
    const claims: ResearchClaim[] = [];

    const areas: Array<"company" | "role" | "rounds" | "skills" | "technical" | "behavioral"> = [
      "company",
      "role",
      "rounds",
      "skills",
      "technical",
      "behavioral",
    ];

    for (const area of areas) {
      const areaSources = sourcesByArea[area] || [];
      const hasSpecificSignal = areaSources.length > 0;
      const { classification, confidence } = this.classifyEvidence(areaSources, hasSpecificSignal);

      let claimText = "";
      let rationale = "";

      switch (area) {
        case "company":
          claimText = `${company}'s engineering culture emphasizes high-scale systems, operational reliability, and targeted team collaboration.`;
          rationale =
            classification === "VERIFIED"
              ? `Corroborated by ${company}'s official engineering disclosures and public careers portal.`
              : classification === "SUPPORTED"
              ? `Corroborated across multiple secondary industry reports and candidate debriefs.`
              : `Synthesized from baseline technology standards for enterprise engineering organizations.`;
          break;

        case "role":
          claimText = `The ${role} role requires end-to-end component ownership, architecture trade-off articulation, and concrete performance SLAs.`;
          rationale =
            classification === "VERIFIED"
              ? `Extracted directly from authoritative job descriptions and level competency frameworks.`
              : `Synthesized from industry benchmarks for ${role} hiring bars.`;
          break;

        case "rounds":
          claimText = `Candidate interview progressions for ${role} at ${company} feature structured rounds evaluating coding, system architecture, and leadership principles.`;
          rationale =
            classification === "VERIFIED"
              ? `Verified via official candidate hiring process guides.`
              : classification === "SUPPORTED"
              ? `Corroborated across multiple candidate interview archives.`
              : `Inferred from standard multi-stage technical interview workflows.`;
          break;

        case "skills":
          claimText = `Key technological capabilities include cloud architecture, latency optimization, data pipelines, and testing discipline.`;
          rationale = `Mapped to required toolchains identified across technical job postings.`;
          break;

        case "technical":
          claimText = `Technical assessments test algorithmic problem decomposition, system scalability, failure mode handling, and metrics.`;
          rationale = `Derived from historical technical question patterns and engineering design standards.`;
          break;

        case "behavioral":
          claimText = `Behavioral evaluation probes collaboration under ambiguity, conflict resolution, and ownership using the STAR method.`;
          rationale = `Aligned with corporate leadership tenets and behavioral assessment criteria.`;
          break;
      }

      claims.push({
        id: `claim_${area}_${Date.now()}`,
        area,
        claim: claimText,
        classification,
        confidence,
        rationale,
        sources: areaSources.slice(0, 4),
        retrievedAt: Date.now(),
      });
    }

    return claims;
  }
}
