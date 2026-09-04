async function testApi() {
  console.log("Testing POST http://localhost:3000/api/ai/evaluate via HTTP...");

  const basePayload = {
    config: { provider: "demo" },
    candidate: {
      targetRole: "Machine Learning Engineer",
      targetCompanies: ["Google"],
      experienceLevel: "Senior Level (5-8 years)",
      skills: ["TensorFlow", "Kubernetes", "Distributed Systems"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    researchPlan: {
      id: "plan_test",
      targetCompany: "Google",
      targetRole: "Machine Learning Engineer",
      companyOverview: { summary: "Google ML", cultureValues: [], techStackKeywords: [], engineeringFocus: "", isVerified: true },
      roleExpectations: { coreResponsibilities: [], technicalCompetencies: [], senioritySignals: [] },
      rounds: [],
      technicalTopics: [],
      behavioralTopics: [],
      questionBank: [],
      sources: [],
      isRealResearch: false,
      completedFlags: [],
      generatedAt: Date.now()
    },
    selectedRound: {
      id: "g_ml_r2",
      roundNumber: 2,
      name: "Machine Learning System Design",
      category: "system_design",
      description: "In-depth ML system design",
      typicalDurationMinutes: 60,
      focusAreas: ["Scale", "Latency", "Pipelines"],
      sampleQuestions: []
    },
    elapsedSeconds: 900
  };

  // Candidate A Request (Strong)
  const resA = await fetch("http://localhost:3000/api/ai/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      candidateResponses: [
        {
          questionId: "q1",
          questionText: "Design a real-time recommendation feed for 50M users.",
          candidateSpeech: "We architected a two-stage recommendation pipeline with an HNSW vector index for candidate retrieval and a multi-task ranking model with Redis caching to achieve p99 latency under 25ms at 45,000 QPS. We evaluated trade-offs between precision and recall.",
          audioDurationSeconds: 40,
          timestamp: Date.now(),
          isFollowUp: false
        }
      ]
    })
  });
  const reportA = await resA.json();

  // Candidate B Request (Weak)
  const resB = await fetch("http://localhost:3000/api/ai/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      candidateResponses: [
        {
          questionId: "q1",
          questionText: "Design a real-time recommendation feed for 50M users.",
          candidateSpeech: "I don't know.",
          audioDurationSeconds: 5,
          timestamp: Date.now(),
          isFollowUp: false
        }
      ]
    })
  });
  const reportB = await resB.json();

  console.log(`HTTP API Candidate A Score: ${reportA.overallScore}/100`);
  console.log(`HTTP API Candidate B Score: ${reportB.overallScore}/100`);
  console.log(`Candidate A Strengths: ${JSON.stringify(reportA.strengths)}`);
  console.log(`Candidate B Weaknesses: ${JSON.stringify(reportB.weaknesses)}`);

  if (reportA.overallScore !== reportB.overallScore && reportA.overallScore > reportB.overallScore) {
    console.log("[SUCCESS] /api/ai/evaluate verified: dynamic transcript-derived evaluations over HTTP.");
    process.exit(0);
  } else {
    console.error("[FAIL] HTTP evaluate endpoint returned identical or inverted scores.");
    process.exit(1);
  }
}

testApi().catch((e) => {
  console.error("HTTP test failed:", e);
  process.exit(1);
});
