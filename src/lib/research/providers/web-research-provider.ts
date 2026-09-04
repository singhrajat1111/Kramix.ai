import { SearchOptions, SearchResult } from "@/types/research";
import { ResearchProvider } from "./research-provider.interface";
import { classifyDomainTier } from "./tier-classifier";

export class WebResearchProvider implements ResearchProvider {
  name = "Kramix Live Web Research Engine (Multi-Vendor Search API)";
  private apiKey: string;
  private vendor: "tavily" | "serper" | "brave" | "auto";

  constructor(apiKey?: string, vendor: "tavily" | "serper" | "brave" | "auto" = "auto") {
    this.apiKey =
      apiKey ||
      process.env.SEARCH_API_KEY ||
      process.env.TAVILY_API_KEY ||
      process.env.SERPER_API_KEY ||
      process.env.BRAVE_API_KEY ||
      "";
    this.vendor = vendor;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options?.maxResults || 5;

    if (!this.isConfigured()) {
      throw new Error("Live Web Research is not configured. Missing SEARCH_API_KEY or search provider credential.");
    }

    const key = this.apiKey.trim();

    // 1. Tavily Search API
    if (this.vendor === "tavily" || key.startsWith("tvly-") || process.env.TAVILY_API_KEY) {
      try {
        return await this.searchWithTavily(query, key, maxResults);
      } catch (err) {
        console.warn("Tavily search failed, attempting fallback", err);
      }
    }

    // 2. Serper (Google Search) API
    if (this.vendor === "serper" || process.env.SERPER_API_KEY) {
      try {
        return await this.searchWithSerper(query, key, maxResults);
      } catch (err) {
        console.warn("Serper search failed, attempting fallback", err);
      }
    }

    // 3. Brave Search API
    if (this.vendor === "brave" || process.env.BRAVE_API_KEY) {
      try {
        return await this.searchWithBrave(query, key, maxResults);
      } catch (err) {
        console.warn("Brave search failed, attempting fallback", err);
      }
    }

    // Generic auto try Tavily endpoint with SEARCH_API_KEY
    return await this.searchWithTavily(query, key, maxResults);
  }

  private async searchWithTavily(query: string, apiKey: string, maxResults: number): Promise<SearchResult[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: maxResults,
        include_domains: [],
        exclude_domains: [],
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const results = data.results || [];

    return results.map((r: { title: string; url: string; content: string; published_date?: string }) => {
      const { tier, domain } = classifyDomainTier(r.url);
      return {
        title: r.title || "Web Search Result",
        url: r.url,
        snippet: r.content || "",
        sourceDomain: domain,
        tier,
        publishedDate: r.published_date,
        retrievedDate: Date.now(),
      };
    });
  }

  private async searchWithSerper(query: string, apiKey: string, maxResults: number): Promise<SearchResult[]> {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
    });

    if (!res.ok) {
      throw new Error(`Serper HTTP error ${res.status}`);
    }

    const data = await res.json();
    const organic = data.organic || [];

    return organic.map((r: { title: string; link: string; snippet: string; date?: string }) => {
      const { tier, domain } = classifyDomainTier(r.link);
      return {
        title: r.title,
        url: r.link,
        snippet: r.snippet || "",
        sourceDomain: domain,
        tier,
        publishedDate: r.date,
        retrievedDate: Date.now(),
      };
    });
  }

  private async searchWithBrave(query: string, apiKey: string, maxResults: number): Promise<SearchResult[]> {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Brave Search HTTP error ${res.status}`);
    }

    const data = await res.json();
    const results = data.web?.results || [];

    return results.map((r: { title: string; url: string; description: string; page_age?: string }) => {
      const { tier, domain } = classifyDomainTier(r.url);
      return {
        title: r.title,
        url: r.url,
        snippet: r.description || "",
        sourceDomain: domain,
        tier,
        publishedDate: r.page_age,
        retrievedDate: Date.now(),
      };
    });
  }
}
