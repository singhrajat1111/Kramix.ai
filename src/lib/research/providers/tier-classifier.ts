import { SourceTier } from "@/types/research";

export function classifyDomainTier(url: string, targetCompany?: string): { tier: SourceTier; domain: string } {
  let domain = "web";
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    domain = url.toLowerCase().split("/")[0] || "web";
  }

  const normalizedComp = targetCompany?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";

  // Tier 1: Official Company Domains & Career Portals
  const officialKeywords = ["careers", "jobs", "engineering", "research", "developer", "docs", "blog"];
  const isTargetCompanyDomain = normalizedComp && domain.includes(normalizedComp);
  const isOfficialSubdomain = officialKeywords.some((kw) => domain.includes(kw));

  if (
    isTargetCompanyDomain ||
    domain.endsWith(".google.com") ||
    domain.endsWith(".microsoft.com") ||
    domain.endsWith(".apple.com") ||
    domain.endsWith(".amazon.jobs") ||
    domain.endsWith(".meta.com") ||
    domain.endsWith(".netflixtechblog.com") ||
    domain.endsWith(".openai.com") ||
    domain.endsWith(".stripe.com")
  ) {
    return { tier: 1, domain };
  }

  // Tier 3: Community & Candidate Discussion Forums
  const communityDomains = [
    "reddit.com",
    "glassdoor.com",
    "teamblind.com",
    "blind.com",
    "leetcode.com",
    "levels.fyi",
    "quora.com",
    "fishbowlapp.com",
    "1point3acres.com",
  ];

  if (communityDomains.some((comm) => domain.includes(comm))) {
    return { tier: 3, domain };
  }

  // Tier 2: Established Technical / Industry Publications & Reputable Educational Resources
  const reputableTechDomains = [
    "github.com",
    "arxiv.org",
    "stackoverflow.blog",
    "interviewing.io",
    "pramp.com",
    "geeksforgeeks.org",
    "educative.io",
    "huggingface.co",
    "techcrunch.com",
    "theverge.com",
    "infoq.com",
    "martinfowler.com",
    "acm.org",
    "ieee.org",
  ];

  if (reputableTechDomains.some((rep) => domain.includes(rep))) {
    return { tier: 2, domain };
  }

  // Default: if domain contains official subwords and matches company, tier 1; else tier 2
  if (isOfficialSubdomain) {
    return { tier: 1, domain };
  }

  return { tier: 2, domain };
}
