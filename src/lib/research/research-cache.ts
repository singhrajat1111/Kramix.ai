import { ResearchPlan } from "@/types/research";

interface CacheRecord {
  plan: ResearchPlan;
  cachedAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour TTL

export class ResearchCache {
  private static memoryCache = new Map<string, CacheRecord>();

  static generateKey(company: string, role: string, experienceLevel?: string, location?: string): string {
    const c = company.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const r = role.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const l = (experienceLevel || "mid").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const loc = (location || "global").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    return `kramix_research_v4_${c}_${r}_${l}_${loc}`;
  }

  static get(key: string): ResearchPlan | null {
    const record = this.memoryCache.get(key);
    if (!record) return null;

    if (Date.now() > record.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return record.plan;
  }

  static set(key: string, plan: ResearchPlan, ttlMs = DEFAULT_TTL_MS): void {
    // Scrub sensitive transient fields before caching
    const safePlan: ResearchPlan = {
      ...plan,
      sources: plan.sources.map((s) => ({
        ...s,
        snippet: s.snippet?.slice(0, 500),
      })),
    };

    this.memoryCache.set(key, {
      plan: safePlan,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  static clear(): void {
    this.memoryCache.clear();
  }
}
