import { SearchOptions, SearchResult } from "@/types/research";
import { ResearchProvider } from "./research-provider.interface";
import { classifyDomainTier } from "./tier-classifier";

interface DemoSearchEntry {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string;
}

export class DemoResearchProvider implements ResearchProvider {
  name = "Kramix Demo Research Engine (Curated Knowledge Index)";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Realistic simulation latency (100-250ms)
    await new Promise((res) => setTimeout(res, 140));

    const qLower = query.toLowerCase();
    const maxResults = options?.maxResults || 5;

    const entries: DemoSearchEntry[] = [];

    // Google Specific Queries
    if (qLower.includes("google")) {
      if (qLower.includes("machine learning") || qLower.includes("ml")) {
        entries.push(
          {
            title: "Machine Learning Engineer Careers at Google — Engineering Principles & Assessment",
            url: "https://careers.google.com/jobs/results/machine-learning-engineer",
            snippet: "Google ML Engineers build end-to-end distributed ML systems using TensorFlow and JAX across Borg clusters. The technical interview evaluates algorithmic foundations, ML system design, feature store latency, and Googleyness.",
            publishedDate: "2024-04-12",
          },
          {
            title: "Rules of Machine Learning: Best Practices for ML Engineering — Google Research",
            url: "https://research.google/pubs/pub43146/",
            snippet: "Best practices authored by Martin Zinkevich outlining pipeline hygiene, offline vs online metric divergence, candidate generation vs deep ranking, and continuous feature monitoring.",
            publishedDate: "2023-11-05",
          },
          {
            title: "Google Machine Learning System Design Interview Guide — Interviewing.io",
            url: "https://interviewing.io/guides/google-ml-system-design-interview",
            snippet: "Breakdown of the 60-minute Google ML system design round. Common prompts include YouTube recommendations, Play Store ranking, and high-throughput multimodal search systems with p99 latency SLAs.",
            publishedDate: "2024-02-18",
          },
          {
            title: "Candidate Debrief: L5 Senior ML Engineer Onsite Experience at Google Mountain View",
            url: "https://www.teamblind.com/post/google-l5-mle-onsite-experience-2024",
            snippet: "Interview consisted of 1 coding round (graphs + tensors), 2 ML system design rounds (retrieval + ranking, fault tolerance), and 1 Googleyness & Leadership behavioral session using the STAR method.",
            publishedDate: "2024-03-22",
          },
          {
            title: "Recent Google MLE Onsite: 4 Rounds Confirmed (Screening, System Design, Coding, Googleyness)",
            url: "https://www.reddit.com/r/cscareerquestions/comments/google_mle_interview_format_update",
            snippet: "Most candidate reports confirm 4 core onsite stages following the recruiter screen. Behavioral questions emphasize handling ambiguous requirements and intellectual humility.",
            publishedDate: "2024-01-30",
          }
        );
      } else {
        // Google Software Engineer
        entries.push(
          {
            title: "Google Engineering Hiring Process & Candidate Preparation Guide",
            url: "https://careers.google.com/how-we-hire/interviewing/",
            snippet: "Official Google interview process overview: technical phone screen followed by 4 virtual onsite rounds testing coding, distributed system design, and Googleyness & Leadership.",
            publishedDate: "2024-05-01",
          },
          {
            title: "Google Software Engineer Interview Questions & Scoring Bar — LeetCode Discuss",
            url: "https://leetcode.com/discuss/interview-experience/google-swe-l4-l5",
            snippet: "Consistently reported question domains: dynamic programming, graphs, concurrency, distributed storage, and cross-functional leadership retrospectives.",
            publishedDate: "2024-03-10",
          }
        );
      }
    }
    // Microsoft Specific Queries
    else if (qLower.includes("microsoft")) {
      entries.push(
        {
          title: "Microsoft Careers — Software Engineering Competencies & Interview Stages",
          url: "https://careers.microsoft.com/us/en/hiring-process",
          snippet: "Microsoft assesses candidates across 4 core technical and behavioral rounds focusing on Azure cloud architecture, clean object-oriented design, performance optimization, and Growth Mindset.",
          publishedDate: "2024-03-15",
        },
        {
          title: "Microsoft Engineering Interview Guide — System Design & Coding Focus",
          url: "https://github.com/microsoft/interview-prep-guidelines",
          snippet: "Guidelines covering distributed cloud computing, microservices, asynchronous queues, resilience patterns, and behavioral STAR stories illustrating Growth Mindset.",
          publishedDate: "2023-12-01",
        },
        {
          title: "Candidate Report: Microsoft Senior SWE Onsite Loop & Round Structure",
          url: "https://www.glassdoor.com/Interview/Microsoft-Software-Engineer-Interview-Questions",
          snippet: "Candidates report 1 phone screening followed by a 4-round loop including coding, architecture design, and an 'As-Appropriate' (AA) bar raiser interview.",
          publishedDate: "2024-02-28",
        }
      );
    }
    // Meta / Facebook Queries
    else if (qLower.includes("meta") || qLower.includes("facebook")) {
      entries.push(
        {
          title: "Meta Engineering Careers — How We Interview Software Engineers",
          url: "https://www.metacareers.com/how-we-hire",
          snippet: "Meta interview structure: initial screening followed by the 'Full Loop' consisting of 2 Coding rounds, 1 System Design round (or Product Architecture), and 1 Behavioral round.",
          publishedDate: "2024-02-15",
        },
        {
          title: "Engineering at Meta — Scalability, Infrastructure, and Systems Architecture",
          url: "https://engineering.fb.com/category/core-infra/",
          snippet: "Overview of Meta's infrastructure principles: move fast, live traffic testing, high-throughput Memcached clusters, and GraphQL service boundaries.",
          publishedDate: "2023-10-20",
        }
      );
    }
    // Unknown Company / Role (e.g. "Completely Unknown Company XYZ", "Quantum Banana Engineer")
    else if (
      qLower.includes("unknown") ||
      qLower.includes("banana") ||
      qLower.includes("xyz") ||
      qLower.includes("fake")
    ) {
      // Intentionally return 0 or minimal generic results so Evidence Engine flags "UNKNOWN / Insufficient reliable evidence"
      return [];
    }
    // Generic Company / Role Fallback
    else {
      const compName = query.split('"')[1] || query.split(" ")[0] || "Target Enterprise";
      entries.push(
        {
          title: `${compName} Careers & Engineering Hiring Standards Overview`,
          url: `https://www.${compName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/careers`,
          snippet: `Public career information and job descriptions for ${compName}. Outlines general engineering culture, technical expectations, and collaborative values.`,
          publishedDate: "2024-01-15",
        },
        {
          title: `Technical Interview Process for Engineering Roles at ${compName}`,
          url: `https://www.glassdoor.com/Interview/${encodeURIComponent(compName)}-Interview-Questions`,
          snippet: `Aggregated candidate interview reports for ${compName}. Candidates report a multi-stage process involving phone screens, technical problem solving, and behavioral alignment.`,
          publishedDate: "2023-09-10",
        },
        {
          title: "Standard Software Engineering Competency & Interview Benchmarks",
          url: "https://github.com/jwasham/coding-interview-university",
          snippet: "Industry baseline engineering interview curriculum covering data structures, distributed system trade-offs, concurrency, and STAR leadership structure.",
          publishedDate: "2024-01-01",
        }
      );
    }

    return entries.slice(0, maxResults).map((e) => {
      const { tier, domain } = classifyDomainTier(e.url);
      return {
        title: e.title,
        url: e.url,
        snippet: e.snippet,
        sourceDomain: domain,
        tier,
        publishedDate: e.publishedDate,
        retrievedDate: Date.now(),
      };
    });
  }
}
