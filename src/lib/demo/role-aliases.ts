/**
 * Kramix.AI — Demo Mode: Role Aliases & Mapping
 *
 * This dictionary maps canonical question bank roles to common variations,
 * abbreviations, and alternative job titles.
 *
 * Extend this dictionary when adding new roles or synonyms without modifying
 * the parser logic.
 */

export interface RoleAliasEntry {
  canonicalRole: string;
  aliases: string[];
  /** Words or patterns that must NOT trigger this role (prevents false positives) */
  excludeTokens?: string[];
}

export const ROLE_ALIAS_REGISTRY: RoleAliasEntry[] = [
  {
    canonicalRole: "Frontend Developer (React)",
    aliases: [
      "frontend",
      "front end",
      "front-end",
      "react",
      "reactjs",
      "react developer",
      "react engineer",
      "frontend developer",
      "frontend engineer",
      "front end developer",
      "front end engineer",
      "web developer",
      "client engineer",
    ],
    excludeTokens: ["react native"],
  },
  {
    canonicalRole: "Backend Developer (Node.js / Express)",
    aliases: [
      "backend",
      "back end",
      "back-end",
      "node",
      "nodejs",
      "node.js",
      "express",
      "expressjs",
      "backend developer",
      "backend engineer",
      "back end developer",
      "back end engineer",
      "api engineer",
      "server engineer",
    ],
  },
  {
    canonicalRole: "Full Stack Developer (MERN)",
    aliases: [
      "fullstack",
      "full stack",
      "full-stack",
      "mern",
      "mern stack",
      "full stack developer",
      "full stack engineer",
      "fullstack developer",
      "fullstack engineer",
    ],
  },
  {
    canonicalRole: "Python Developer",
    aliases: [
      "python",
      "python developer",
      "python engineer",
      "django",
      "fastapi",
      "flask",
    ],
  },
  {
    canonicalRole: "Java Developer",
    aliases: [
      "java",
      "java developer",
      "java engineer",
      "core java",
      "j2ee",
      "enterprise java",
    ],
    excludeTokens: ["javascript", "js"],
  },
  {
    canonicalRole: "Spring Boot Developer",
    aliases: [
      "spring boot",
      "springboot",
      "spring framework",
      "spring developer",
      "spring boot engineer",
    ],
  },
  {
    canonicalRole: "AI Engineer / LLM Engineer",
    aliases: [
      "ai engineer",
      "llm engineer",
      "large language models",
      "ai developer",
      "artificial intelligence engineer",
      "rag engineer",
      "langchain",
    ],
  },
  {
    canonicalRole: "Machine Learning Engineer",
    aliases: [
      "machine learning",
      "machine learning engineer",
      "ml engineer",
      "mle",
      "deep learning engineer",
      "computer vision engineer",
      "nlp engineer",
    ],
  },
  {
    canonicalRole: "Data Scientist",
    aliases: [
      "data scientist",
      "data science",
      "senior data scientist",
      "applied scientist",
      "research scientist",
    ],
  },
  {
    canonicalRole: "Data Analyst",
    aliases: [
      "data analyst",
      "business intelligence analyst",
      "bi analyst",
      "product analyst",
      "quantitative analyst",
      "sql analyst",
    ],
    excludeTokens: ["data engineer", "data scientist"],
  },
  {
    canonicalRole: "Data Engineer",
    aliases: [
      "data engineer",
      "data engineering",
      "big data engineer",
      "etl developer",
      "spark developer",
      "pipeline engineer",
    ],
    excludeTokens: ["data analyst"],
  },
  {
    canonicalRole: "DevOps Engineer",
    aliases: [
      "devops",
      "devops engineer",
      "ci/cd engineer",
      "release engineer",
      "platform engineer",
      "infrastructure engineer",
    ],
  },
  {
    canonicalRole: "Cloud Engineer (AWS)",
    aliases: [
      "cloud engineer",
      "aws",
      "aws engineer",
      "aws cloud engineer",
      "cloud architect",
      "azure cloud engineer",
      "gcp engineer",
    ],
  },
  {
    canonicalRole: "Mobile Developer (Android / Kotlin)",
    aliases: [
      "android",
      "kotlin",
      "android developer",
      "android engineer",
      "mobile developer android",
    ],
  },
  {
    canonicalRole: "Mobile Developer (iOS / Swift)",
    aliases: [
      "ios",
      "swift",
      "swiftui",
      "ios developer",
      "ios engineer",
      "mobile developer ios",
      "apple developer",
    ],
  },
  {
    canonicalRole: "React Native Developer",
    aliases: [
      "react native",
      "react-native",
      "react native developer",
      "react native engineer",
      "cross platform mobile",
    ],
  },
  {
    canonicalRole: "Golang Developer",
    aliases: [
      "golang",
      "go developer",
      "golang developer",
      "golang engineer",
      "go engineer",
    ],
  },
  {
    canonicalRole: ".NET Developer (C#)",
    aliases: [
      ".net",
      "dotnet",
      "c#",
      "c sharp",
      ".net developer",
      "dotnet developer",
      "c# developer",
      "asp.net",
    ],
  },
  {
    canonicalRole: "Flutter Developer",
    aliases: [
      "flutter",
      "dart",
      "flutter developer",
      "flutter engineer",
    ],
  },
  {
    canonicalRole: "QA / SDET (Software Development Engineer in Test)",
    aliases: [
      "qa",
      "sdet",
      "qa engineer",
      "quality assurance",
      "test engineer",
      "software development engineer in test",
      "automation engineer",
      "testing",
    ],
  },
  {
    canonicalRole: "Cybersecurity Analyst",
    aliases: [
      "cybersecurity",
      "cyber security",
      "security analyst",
      "infosec",
      "information security",
      "security engineer",
      "soc analyst",
      "penetration tester",
    ],
  },
  {
    canonicalRole: "Database Administrator / SQL Developer",
    aliases: [
      "database administrator",
      "dba",
      "sql developer",
      "database engineer",
      "database developer",
      "postgres developer",
      "oracle dba",
    ],
  },
  {
    canonicalRole: "UI/UX Designer",
    aliases: [
      "ui/ux",
      "ui ux",
      "ux designer",
      "ui designer",
      "product designer",
      "user experience designer",
      "interaction designer",
    ],
  },
  {
    canonicalRole: "Technical Product Manager",
    aliases: [
      "technical product manager",
      "tpm",
      "product manager",
      "pm",
      "associate product manager",
    ],
  },
  {
    canonicalRole: "Site Reliability Engineer (SRE)",
    aliases: [
      "sre",
      "site reliability engineer",
      "site reliability",
      "reliability engineer",
    ],
  },
  {
    canonicalRole: "Generative AI / Prompt Engineer",
    aliases: [
      "generative ai",
      "genai",
      "prompt engineer",
      "prompt engineering",
      "gen ai engineer",
    ],
  },
  {
    canonicalRole: "Technical Support Engineer",
    aliases: [
      "technical support",
      "technical support engineer",
      "support engineer",
      "tier 2 support",
      "tier 3 support",
      "application support engineer",
    ],
  },
];

/**
 * Resolves a user-typed role to its canonical question-bank role name.
 * Uses strict whole-word boundary logic and explicit exclusion guards to avoid false positives
 * (e.g. "JavaScript Developer" will NEVER match "Java Developer").
 *
 * @param userInput The raw role string entered by the user
 * @param availableCanonicalRoles List of canonical roles currently present in the question bank
 * @returns The matching canonical role name, or null if the role is not covered
 */
export function resolveCanonicalRole(
  userInput: string,
  availableCanonicalRoles: string[]
): string | null {
  if (!userInput || typeof userInput !== "string") return null;

  const normalized = userInput.trim().toLowerCase();
  if (normalized.length === 0) return null;

  const canonicalSet = new Set(availableCanonicalRoles);

  // 1. Direct exact or case-insensitive match on canonical role name
  for (const canonical of availableCanonicalRoles) {
    if (canonical.toLowerCase() === normalized) {
      return canonical;
    }
  }

  // 2. Direct canonical substring / contains match if input is cleanly qualified
  for (const canonical of availableCanonicalRoles) {
    const canonLower = canonical.toLowerCase();
    // e.g. "Staff Machine Learning Engineer" contains "machine learning engineer"
    const coreName = canonLower.replace(/\s*\([^)]*\)/g, "").trim();
    if (normalized.includes(canonLower) || (coreName.length >= 8 && normalized.includes(coreName))) {
      return canonical;
    }
  }

  // 3. Alias registry search with whole-token boundaries and negative lookaheads
  for (const entry of ROLE_ALIAS_REGISTRY) {
    // Only consider if canonical role is present in available bank
    if (!canonicalSet.has(entry.canonicalRole)) continue;

    // Check exclusion tokens first (e.g. "javascript" rejects "Java Developer")
    if (entry.excludeTokens && entry.excludeTokens.length > 0) {
      const isExcluded = entry.excludeTokens.some((token) => {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
      });
      if (isExcluded) continue;
    }

    // Check aliases with whole-word boundary
    for (const alias of entry.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
      if (regex.test(normalized)) {
        return entry.canonicalRole;
      }
    }
  }

  return null;
}
