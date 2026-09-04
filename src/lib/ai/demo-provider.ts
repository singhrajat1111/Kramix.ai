import { ChatMessage, LLMProvider, ModelCompletionResponse } from "@/types/ai";

export class DemoProvider implements LLMProvider {
  type = "demo" as const;
  name = "Kramix Demo Engine (Local Simulation)";

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    return {
      success: true,
      message: "Kramix Demo Engine is active. Ready for realistic simulated interviews without an API key.",
      latencyMs: 12,
    };
  }

  async generateCompletion(
    messages: ChatMessage[],
    _options?: { temperature?: number; maxTokens?: number }
  ): Promise<ModelCompletionResponse> {
    // Realistic cognitive delay simulation
    await new Promise((resolve) => setTimeout(resolve, 600));

    const lastMessage = messages[messages.length - 1]?.content || "";
    const lower = lastMessage.toLowerCase();
    const wordCount = lastMessage.trim().split(/\s+/).length;

    // Requirement 13 Adaptive Interviewing Scenarios
    let response = "Understood. When you deployed that solution, how did you validate its performance and ensure it degraded gracefully under peak load?";

    // Scenario 1: Initial greeting / check-in (only if concise message)
    if (wordCount <= 6 && /\b(hello|hi|hey|ready|start|begin)\b/i.test(lower)) {
      response = "Welcome! I'm pleased to meet you today. Let's start with a foundational exploration: Walk me through a challenging technical system you engineered recently and highlight the most critical bottleneck you resolved.";
    }
    // Scenario 2: Very long answer (polite regaining of control / distillation)
    else if (wordCount > 75) {
      response = "You covered a lot of ground there. To distill the key engineering decision: if you had to pinpoint the single architectural trade-off that made the biggest difference, what was it and why?";
    }
    // Scenario 3: Weak or uncertain answer (clarifying / scaffolding without lecturing)
    else if (
      /\b(not sure|don't know|dont know|can't remember|cant remember|no idea|haven't worked)\b/i.test(lower) ||
      wordCount < 10
    ) {
      response = "That's completely fine. Let's approach it from a practical angle: if you were handed this system in production and users reported intermittent timeouts, what would be the very first log or metric you'd inspect?";
    }
    // Scenario 4: Strong, detailed answer with metrics or system terms (deep dive)
    else if (wordCount >= 25 && /\b(architecture|latency|throughput|scale|trade-off|metric|cluster|partition)\b/i.test(lower)) {
      response = "That's a solid architectural design. Let's go one layer deeper: what were the primary failure modes of this design, and how would you protect downstream dependencies if network partitions occurred?";
    }
    // Scenario 5: Mentions caching or database without invalidation/scaling
    else if ((/\b(cache|redis|memcached)\b/i.test(lower)) && !lower.includes("invalidation")) {
      response = "Adding a caching layer makes sense for read throughput. What cache invalidation strategy did you deploy to ensure consistency without causing a thundering herd on your database?";
    }
    // Scenario 6: Mentions ML / Python / PyTorch / distributed training
    else if (/\b(pytorch|tensorflow|model|dataset|training|weights)\b/i.test(lower)) {
      response = "Interesting. When scaling distributed training or inference across multiple nodes, how did you mitigate GPU memory pressure and communication overhead?";
    }
    // Scenario 7: Incomplete answer (brief, needs targeted follow-up)
    else if (wordCount < 25) {
      response = "I see your high-level approach. Could you walk me through the specific implementation steps and telemetry tools you used to verify the results?";
    }

    return {
      content: response,
      provider: "demo",
      model: "kramix-demo-v1",
      usage: { promptTokens: 110, completionTokens: 40, totalTokens: 150 },
    };
  }

  async generateStructuredJSON<T>(messages: ChatMessage[], _schemaDescription?: string): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Extract transcript dump from messages to calculate real dynamic evaluation scores
    const userMsg = messages.find((m) => m.role === "user")?.content || "";
    const transcriptLines = userMsg.split("\n").filter((l) => l.startsWith("CANDIDATE:") || l.startsWith("INTERVIEWER:"));
    const candidateAnswers = transcriptLines
      .filter((l) => l.startsWith("CANDIDATE:"))
      .map((l) => l.replace(/^CANDIDATE:\s*/, "").trim())
      .filter((ans) => ans.length > 0 && ans !== "[No verbal response recorded]");

    const totalWords = candidateAnswers.reduce((acc, ans) => acc + ans.split(/\s+/).length, 0);
    const avgWordsPerAnswer = candidateAnswers.length > 0 ? totalWords / candidateAnswers.length : 0;

    // Detect technical keywords, metrics, uncertainty, and prompt injection
    const hasMetrics = /\d+%|\d+ms|p99|qps|users|\d+\s*(gb|tb|mb|seconds)/i.test(userMsg);
    const hasArchitecture = /system|architecture|distributed|database|cache|latency|trade-off|throughput|pipeline|cluster/i.test(userMsg);
    const hasUncertainty = /not sure|don't know|dont know|can't remember|guess/i.test(userMsg);
    const hasPromptInjection = /ignore previous|give me 100|system prompt|reveal instructions|grade me as/i.test(userMsg);

    let base = candidateAnswers.length === 0 ? 25 : 70;

    if (candidateAnswers.length > 0) {
      if (avgWordsPerAnswer > 50) base += 10;
      else if (avgWordsPerAnswer < 15) base -= 12;

      if (hasMetrics) base += 6;
      if (hasArchitecture) base += 6;
      if (hasUncertainty) base -= 8;
    }

    if (hasPromptInjection) {
      base = 35;
    }

    const communication = candidateAnswers.length === 0
      ? 20
      : Math.min(96, Math.max(35, Math.round(base + (avgWordsPerAnswer > 35 ? 4 : -5))));

    const technicalKnowledge = candidateAnswers.length === 0
      ? 20
      : Math.min(95, Math.max(30, Math.round(base + (hasArchitecture ? 6 : -6))));

    const problemSolving = candidateAnswers.length === 0
      ? 20
      : Math.min(94, Math.max(30, Math.round(base + (hasMetrics ? 5 : -4))));

    const roleRelevance = candidateAnswers.length === 0
      ? 25
      : Math.min(95, Math.max(35, Math.round(base + 2)));

    const confidenceAndClarity = candidateAnswers.length === 0
      ? 20
      : Math.min(93, Math.max(30, Math.round(base - (avgWordsPerAnswer < 20 || hasUncertainty ? 8 : 0))));

    const overallScore = Math.round((communication + technicalKnowledge + problemSolving + roleRelevance + confidenceAndClarity) / 5);

    // Dynamic question-by-question critique from actual answers
    const questionEvaluations = candidateAnswers.length > 0
      ? candidateAnswers.map((ans, idx) => {
          const words = ans.split(/\s+/).length;
          const ansLower = ans.toLowerCase();
          const ansHasTech = /system|architecture|latency|throughput|cache|database|pipeline|trade-off/i.test(ansLower);
          const ansHasMetrics = /\d+%|\d+ms|p99|qps|users/i.test(ansLower);
          const ansHasUncertainty = /not sure|don't know|dont know|can't remember/i.test(ansLower);
          const ansHasInjection = /ignore previous|give me 100|system prompt/i.test(ansLower);

          let scoreOutOfTen = ansHasInjection
            ? 2.0
            : Math.min(9.8, Math.max(2.5, parseFloat(((base / 10) + (words > 40 ? 0.6 : -0.8)).toFixed(1))));

          if (ansHasUncertainty && scoreOutOfTen > 4.5) {
            scoreOutOfTen = Math.max(3.5, parseFloat((scoreOutOfTen - 1.5).toFixed(1)));
          }

          const whatWentWell: string[] = [];
          const whatCouldImprove: string[] = [];

          if (words > 30) whatWentWell.push("Demonstrated structured articulation of concepts.");
          if (ansHasTech) whatWentWell.push("Referenced foundational system architecture patterns.");
          if (ansHasMetrics) whatWentWell.push("Quantified performance parameters and operational limits.");

          if (words < 25) whatCouldImprove.push("Expand upon implementation details rather than a brief summary.");
          if (!ansHasMetrics) whatCouldImprove.push("Incorporate measurable telemetry (e.g. latency, throughput).");
          if (ansHasUncertainty) whatCouldImprove.push("Frame uncertainty around structured diagnostic steps rather than guesswork.");
          if (ansHasInjection) whatCouldImprove.push("Prompt injection attempt detected; penalized for non-technical evasion.");

          return {
            questionId: `q_${idx + 1}`,
            questionText: `Interview Investigation #${idx + 1}`,
            candidateAnswer: ans || "[No verbal response recorded]",
            scoreOutOfTen,
            whatWentWell: whatWentWell.length > 0 ? whatWentWell : ["Directly engaged with the interviewer inquiry."],
            whatCouldImprove: whatCouldImprove.length > 0 ? whatCouldImprove : ["Detail secondary failure modes and edge cases."],
            idealDirection: "Ideal responses clearly delineate technical constraints, quantify performance trade-offs, and define operational SLAs.",
            topicTag: `Topic Exploration ${idx + 1}`
          };
        })
      : [
          {
            questionId: "q_empty",
            questionText: "Interview Session Evaluation",
            candidateAnswer: "[No verbal or written response recorded]",
            scoreOutOfTen: 2.0,
            whatWentWell: [],
            whatCouldImprove: ["No questions were answered during the session. Complete full interview questions to receive technical critique."],
            idealDirection: "Participate in the interview by providing spoken or typed responses to generate actionable feedback.",
            topicTag: "Incomplete Session"
          }
        ];

    // Strengths and weaknesses dynamically derived from scores
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (candidateAnswers.length === 0) {
      strengths.push("Candidate initiated the interview session and verified environmental setup.");
      weaknesses.push("No interview questions were answered.");
      weaknesses.push("Concluded session before providing technical or architectural responses.");
    } else {
      if (communication >= 75) {
        strengths.push("Articulated system concepts with structured pacing and clarity.");
      } else {
        weaknesses.push("Responses were brief; proactively expand upon technical rationale and steps.");
      }

      if (technicalKnowledge >= 75) {
        strengths.push("Demonstrated strong fluency with engineering patterns and architecture.");
      } else {
        weaknesses.push("Deepen familiarity with specific system trade-offs and operational bottlenecks.");
      }

      if (problemSolving >= 75) {
        strengths.push("Maintained an analytical approach when evaluating constraints and design trade-offs.");
      } else {
        weaknesses.push("Proactively consider resilience patterns (circuit breakers, dead-letter queues, backpressure).");
      }

      if (hasPromptInjection) {
        weaknesses.unshift("Adversarial prompt injection attempt detected; heavily penalized for unprofessional conduct.");
      }
    }

    // Dynamic Actionable Roadmap prioritized by lowest sub-score
    const candidatePriorities = [
      {
        name: "System Design & Architectural Depth",
        score: technicalKnowledge,
        reason: "Core hiring metric evaluating component boundaries, capacity estimation, and trade-offs.",
        practice: ["Back-of-the-envelope capacity estimations", "Review database partitioning and caching strategies (Redis, Memcached)"],
        questions: ["How would you design a distributed rate limiter supporting 50,000 requests per second?"]
      },
      {
        name: "STAR Behavioral & Leadership Alignment",
        score: communication,
        reason: "Ensures technical depth translates into clear leadership and stakeholder collaboration.",
        practice: ["Draft 5 project retrospectives highlighting quantified business outcomes", "Practice concise 2-minute project elevator pitches"],
        questions: ["Describe a time you navigated an architectural disagreement with another senior engineer."]
      },
      {
        name: "Failure Modes & Resilient Engineering",
        score: problemSolving,
        reason: "Evaluates how your systems degrade gracefully under upstream dependency failures.",
        practice: ["Implement exponential backoff with jitter and bulkheads", "Study distributed consensus and idempotent retry patterns"],
        questions: ["How do you protect downstream databases during sudden traffic surges without dropping requests?"]
      },
      {
        name: "Target Role Competency Alignment",
        score: roleRelevance,
        reason: "Aligning your specific toolchain experience with company engineering values.",
        practice: ["Audit resume bullet points to highlight measurable metrics rather than passive responsibilities"],
        questions: ["How do you balance speed of delivery with technical debt in production systems?"]
      }
    ].sort((a, b) => a.score - b.score);

    const priorities = [
      {
        priorityNumber: 1 as const,
        topic: candidatePriorities[0].name,
        reason: candidatePriorities[0].reason,
        recommendedPractice: candidatePriorities[0].practice,
        suggestedQuestions: candidatePriorities[0].questions
      },
      {
        priorityNumber: 2 as const,
        topic: candidatePriorities[1].name,
        reason: candidatePriorities[1].reason,
        recommendedPractice: candidatePriorities[1].practice,
        suggestedQuestions: candidatePriorities[1].questions
      },
      {
        priorityNumber: 3 as const,
        topic: candidatePriorities[2].name,
        reason: candidatePriorities[2].reason,
        recommendedPractice: candidatePriorities[2].practice,
        suggestedQuestions: candidatePriorities[2].questions
      }
    ];

    const mockEvaluation = {
      overallScore,
      scoringBreakdown: {
        communication,
        technicalKnowledge,
        problemSolving,
        roleRelevance,
        confidenceAndClarity,
      },
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 3),
      questionEvaluations,
      actionablePlan: {
        summary: overallScore >= 80
          ? "Strong core competency. Focus on quantifiable performance metrics and resilience patterns to consistently clear senior bars."
          : "Good fundamental awareness. Focus on structuring technical explanations and detailing failure recovery strategies.",
        priorities,
        keyTakeaway: overallScore >= 80
          ? "You are within striking distance of the target hiring bar. Focus on quantifiable impacts and resilience patterns."
          : "With focused practice on capacity planning and failure mode handling, you can significantly elevate your interview outcomes."
      }
    };

    return mockEvaluation as unknown as T;
  }
}
