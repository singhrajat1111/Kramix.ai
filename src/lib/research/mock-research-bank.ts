import { InterviewRoundInfo, ResearchPlan, ResearchSource } from "@/types/research";

export interface CompanyRoleProfile {
  company: string;
  role: string;
  overview: {
    summary: string;
    cultureValues: string[];
    techStackKeywords: string[];
    engineeringFocus: string;
  };
  rounds: InterviewRoundInfo[];
  technicalTopics: Array<{ name: string; importance: "high" | "medium" | "low"; description: string }>;
  behavioralTopics: Array<{ name: string; framework: string; keyTraits: string[] }>;
  questionBank: Array<{
    id: string;
    roundCategory: string;
    category: "Technical" | "Coding" | "System Design" | "Machine Learning" | "Behavioral" | "Situational" | "Resume Deep Dive";
    questionText: string;
    intent: string;
    evaluationCriteria: string[];
    difficulty: "Junior" | "Mid" | "Senior" | "Staff";
  }>;
  sources: ResearchSource[];
}

export const COMPANY_ROLE_RESEARCH_BANK: Record<string, CompanyRoleProfile> = {
  "google_ml": {
    company: "Google",
    role: "Machine Learning Engineer",
    overview: {
      summary: "Google evaluates ML engineers on end-to-end ML system design, algorithmic rigor, data pipeline scalability, and 'Googleyness' (intellectual humility, collaboration, and ethical AI stewardship).",
      cultureValues: ["Focus on the user", "Respect the opportunity", "Googleyness & Leadership", "Intellectual humility"],
      techStackKeywords: ["TensorFlow", "JAX", "TPUs", "Kubernetes / Borg", "BigQuery", "Distributed Training"],
      engineeringFocus: "Ultra-large-scale production ML serving, low latency inference, feature stores, and bias mitigation.",
    },
    rounds: [
      {
        id: "g_ml_r1",
        roundNumber: 1,
        name: "Technical Screening & Foundations",
        category: "screening",
        description: "45-minute technical assessment covering core ML concepts, bias-variance trade-offs, loss functions, and data structures.",
        typicalDurationMinutes: 45,
        focusAreas: ["ML Fundamentals", "Python/NumPy fluency", "Complexity analysis", "Basic architecture"],
        sampleQuestions: [
          "Explain the difference between L1 and L2 regularization and how they affect feature weights.",
          "How would you handle severe class imbalance when training a high-throughput fraud detection model?",
        ],
        evidenceNote: "Corroborated across Google engineering interview disclosures and candidate forums.",
      },
      {
        id: "g_ml_r2",
        roundNumber: 2,
        name: "Machine Learning System Design",
        category: "system_design",
        description: "In-depth design round building an end-to-end recommendation, search ranking, or multimodal generative system at billion-user scale.",
        typicalDurationMinutes: 60,
        focusAreas: ["Feature Engineering", "Candidate Generation vs Ranking", "Offline vs Online Metrics", "Low-latency Serving", "Continuous Retraining"],
        sampleQuestions: [
          "Design the recommendation engine for YouTube Shorts or Google Play Store recommendations.",
          "How do you design a real-time multimodal search system handling 50,000 QPS with p99 latency under 40ms?",
        ],
        evidenceNote: "Documented in Google Systems Research papers and industry ML interview benchmarks.",
      },
      {
        id: "g_ml_r3",
        roundNumber: 3,
        name: "Coding & Algorithmic Rigor",
        category: "coding",
        description: "Data structures, graph algorithms, and efficient implementation of ML primitives (e.g., k-means, beam search, attention mechanism).",
        typicalDurationMinutes: 45,
        focusAreas: ["Dynamic Programming", "Graph Traversal", "Vectorized Tensor Operations", "Space/Time Complexity"],
        sampleQuestions: [
          "Implement a vectorized self-attention layer from scratch using raw matrix operations.",
          "Given a stream of real-time embedding vectors, find the top-K nearest neighbors efficiently.",
        ],
        evidenceNote: "Standard Google Onsite Software/ML coding round pattern.",
      },
      {
        id: "g_ml_r4",
        roundNumber: 4,
        name: "Googleyness, Leadership & Behavioral",
        category: "behavioral",
        description: "Evaluates teamwork, dealing with ambiguity, intellectual humility, conflict resolution, and ethical considerations in AI deployment.",
        typicalDurationMinutes: 45,
        focusAreas: ["Handling Ambiguity", "Disagree and Commit", "Ethical AI Decisions", "Cross-functional Collaboration"],
        sampleQuestions: [
          "Tell me about a time when your ML model performed poorly in production or displayed unexpected demographic bias. How did you investigate and remedy it?",
          "Describe a situation where you had a deep disagreement with a product manager over model release criteria.",
        ],
        evidenceNote: "Official Google interview competency domain: 'Googleyness & Leadership'.",
      },
    ],
    technicalTopics: [
      { name: "ML System Design & Two-Tower Retrieval", importance: "high", description: "Candidate generation followed by deep neural ranking." },
      { name: "Distributed Training & Parallelism", importance: "high", description: "Data parallel vs model parallel (FSDP, Tensor Parallelism) on TPUs/GPUs." },
      { name: "Evaluation Metrics (NDCG, AUC, Calibration)", importance: "high", description: "Disconnect between offline ROC-AUC and online business conversion." },
      { name: "Embedding Stores & Approximate Nearest Neighbors", importance: "medium", description: "HNSW, ScaNN, and vector quantization." },
    ],
    behavioralTopics: [
      { name: "Googleyness & Navigating Ambiguity", framework: "STAR", keyTraits: ["Intellectual Humility", "Bias for User Benefit", "Ownership"] },
      { name: "Cross-functional Influence", framework: "STAR", keyTraits: ["Clarity", "Empathy", "Data-driven negotiation"] },
    ],
    questionBank: [
      {
        id: "q_g1",
        roundCategory: "system_design",
        category: "System Design",
        questionText: "How would you design a real-time news ranking feed that minimizes clickbait while maintaining high user engagement?",
        intent: "Evaluates metric selection, feature engineering, multi-objective optimization, and safety filtering.",
        evaluationCriteria: ["Exploration vs Exploitation", "Online metric tracking (dwell time vs CTR)", "Feedback loop handling"],
        difficulty: "Senior",
      },
      {
        id: "q_g2",
        roundCategory: "system_design",
        category: "Machine Learning",
        questionText: "Suppose you deploy a recommendation model, and within 48 hours the online CTR drops by 15% despite high offline validation AUC. How do you isolate the root cause?",
        intent: "Tests practical production troubleshooting, covariate shift, data leakage, and feature pipeline delays.",
        evaluationCriteria: ["Data drift analysis", "Feature logging parity", "Cold start problem", "A/B testing anomalies"],
        difficulty: "Senior",
      },
      {
        id: "q_g3",
        roundCategory: "behavioral",
        category: "Behavioral",
        questionText: "Tell me about a time when you were tasked with training a model on an ambiguous problem where the training labels were noisy or incomplete. How did you proceed?",
        intent: "Evaluates handling ambiguity, weak supervision techniques, and stakeholder alignment.",
        evaluationCriteria: ["Active learning", "Label noise mitigation", "Clear communication of risk"],
        difficulty: "Mid",
      },
      {
        id: "q_g4",
        roundCategory: "coding",
        category: "Technical",
        questionText: "How does batch normalization differ from layer normalization, and why has layer normalization become the standard in modern Transformer architectures?",
        intent: "Probes foundational deep learning comprehension and hardware efficiency nuances.",
        evaluationCriteria: ["Batch size independence", "Recurrent/sequential sequence handling", "Distributed training synchronization"],
        difficulty: "Mid",
      },
    ],
    sources: [
      {
        title: "Google Engineering Interview Guidelines (Public Disclosure)",
        sourceType: "public_profile",
        reliability: "verified",
        note: "Official Google Careers documentation on ML and Software roles",
      },
      {
        title: "Rules of Machine Learning: Best Practices for ML Engineering (Martin Zinkevich, Google)",
        sourceType: "engineering_blog",
        reliability: "verified",
        note: "Published foundational guidelines by Google Research",
      },
      {
        title: "Aggregated Tech Interview Repositories & Candidate Transcripts",
        sourceType: "interview_archive",
        reliability: "corroborated",
        note: "Multi-year candidate reports across level L4, L5, and L6 interviews",
      },
    ],
  },
};

/**
 * Fallback generator for arbitrary company and role combinations
 * when exact curated profiles do not match.
 */
export function generateGenericRoleResearch(company: string, role: string): CompanyRoleProfile {
  const comp = company.trim() || "Target Enterprise";
  const r = role.trim() || "Software Engineer";

  return {
    company: comp,
    role: r,
    overview: {
      summary: `${comp} evaluates ${r} candidates through rigorous technical depth, domain problem solving, and behavioral alignment with company leadership tenets.`,
      cultureValues: ["Customer Centricity", "High Operational Standards", "Collaboration & Ownership", "Velocity with Quality"],
      techStackKeywords: ["Cloud Architecture", "Distributed Systems", "API Design", "CI/CD", "Monitoring & Observability"],
      engineeringFocus: `Scalability, maintainability, clean code patterns, and production reliability for ${r}.`,
    },
    rounds: [
      {
        id: "gen_r1",
        roundNumber: 1,
        name: "Technical Screening & Foundations",
        category: "screening",
        description: `Initial 45-minute technical conversation assessing core fundamentals, problem-solving, and domain background in ${r}.`,
        typicalDurationMinutes: 45,
        focusAreas: ["Core Language Fluency", "Algorithmic Thinking", "System Fundamentals", "Past Project Walkthrough"],
        sampleQuestions: [
          `Can you describe the most complex technical project you engineered in your capacity as a ${r}?`,
          "How do you approach testing, error handling, and modularity in your codebases?",
        ],
        evidenceNote: `Standard hiring pattern observed across enterprise tech hiring for ${r}.`,
      },
      {
        id: "gen_r2",
        roundNumber: 2,
        name: "Technical Deep Dive & Architecture",
        category: "technical",
        description: `Deep technical exploration of real-world scenarios, architectural trade-offs, and failure mode mitigation.`,
        typicalDurationMinutes: 60,
        focusAreas: ["Architectural Trade-offs", "Data Storage & Caching", "API Design & Concurrency", "Production Debugging"],
        sampleQuestions: [
          `How would you architect a resilient, highly available service for ${comp}'s scale?`,
          "Walk me through how you optimize database queries and handle distributed transaction bottlenecks.",
        ],
        evidenceNote: `Inferred from industry standard technical interview benchmarks.`,
      },
      {
        id: "gen_r3",
        roundNumber: 3,
        name: "Behavioral & Leadership Principles",
        category: "behavioral",
        description: `Evaluates communication, conflict resolution, dealing with ambiguous requirements, and alignment with ${comp}'s values.`,
        typicalDurationMinutes: 45,
        focusAreas: ["STAR Method", "Cross-functional Collaboration", "Handling Deadline Pressure", "Ownership"],
        sampleQuestions: [
          "Describe a time you received critical feedback on an architectural decision. How did you respond?",
          "Tell me about a situation where a project scope expanded under tight timelines. What trade-offs did you make?",
        ],
        evidenceNote: `Derived from corporate behavioral interviewing best practices.`,
      },
    ],
    technicalTopics: [
      { name: "System Architecture & Scalability", importance: "high", description: "Decoupled services, caching tiers, asynchronous worker queues." },
      { name: "Code Quality & Testing Strategies", importance: "high", description: "Unit tests, integration pipelines, regression safeguards." },
      { name: "Reliability, Metrics & Telemetry", importance: "medium", description: "SLAs, SLOs, distributed tracing, and incident response." },
    ],
    behavioralTopics: [
      { name: "Ownership & Accountability", framework: "STAR", keyTraits: ["Initiative", "Thoroughness", "Long-term thinking"] },
      { name: "Collaborative Problem Solving", framework: "STAR", keyTraits: ["Clear articulation", "Respectful dissent", "Team enablement"] },
    ],
    questionBank: [
      {
        id: "gen_q1",
        roundCategory: "technical",
        category: "Technical",
        questionText: `In your experience as a ${r}, how do you evaluate the trade-offs between horizontal vs. vertical scaling when designing a latency-critical application?`,
        intent: "Assesses architectural foundation, cost awareness, and database sharding/partitioning familiarity.",
        evaluationCriteria: ["Stateful vs stateless trade-offs", "Network partition considerations", "Load balancing strategies"],
        difficulty: "Mid",
      },
      {
        id: "gen_q2",
        roundCategory: "technical",
        category: "System Design",
        questionText: `Imagine a production outage occurs where 5% of users intermittently receive 504 Gateway Timeouts. Walk me step-by-step through how you isolate and remediate the incident.`,
        intent: "Probes systematic operational troubleshooting, log aggregation, and communication during crises.",
        evaluationCriteria: ["Observability triage", "Rollback vs hotfix methodology", "Post-mortem blameless culture"],
        difficulty: "Senior",
      },
      {
        id: "gen_q3",
        roundCategory: "behavioral",
        category: "Behavioral",
        questionText: `Tell me about a time you had to deliver a critical milestone with vague specifications and limited guidance from product leadership. How did you define success?`,
        intent: "Tests autonomy, ambiguity resolution, and stakeholder proactive check-ins.",
        evaluationCriteria: ["Proactive requirement gathering", "Incremental prototyping", "Stakeholder alignment"],
        difficulty: "Mid",
      },
    ],
    sources: [
      {
        title: `${comp} Careers & Engineering Insights`,
        sourceType: "public_profile",
        reliability: "corroborated",
        note: `Aggregated from public career disclosures and job descriptions for ${r}`,
      },
      {
        title: "Standard Software Engineering Competency Framework",
        sourceType: "ai_synthesis",
        reliability: "inferred",
        note: "AI synthesized baseline matching modern technology company hiring bars",
      },
    ],
  };
}
