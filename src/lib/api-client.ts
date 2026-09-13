/**
 * Centralized HTTP API client for Kramix V2 Frontend.
 * Handles REST requests to backend endpoints:
 * 1. Session creation (POST /api/sessions)
 * 2. Safe session retrieval (GET /api/sessions/{id})
 * 3. Final report retrieval (GET /api/sessions/{id}/report)
 */

export interface CreateSessionRequest {
  mode: "demo" | "api";
  role?: string;
  round_sequence?: string[];
  max_turns?: number;
  candidate_name?: string;
}

export interface CreateSessionResponse {
  session_id: string;
  mode: string;
  role?: string;
  status: string;
  ws_url: string;
  max_turns: number;
  created_at: number;
}

export interface SessionStateResponse {
  session_id: string;
  mode: string;
  round: string;
  current_turn: number;
  phase: string;
  current_topic?: string;
  is_complete: boolean;
  total_questions_asked: number;
}

export interface FinalInterviewReport {
  session_info: {
    session_id: string;
    mode: string;
    role?: string;
    completion_status: string;
    total_questions_asked: number;
    total_questions_answered: number;
    duration_seconds?: number;
  };
  performance_metrics: {
    overall_score: number;
    technical_performance?: number;
    conceptual_depth?: number;
    relevance?: number;
    completeness?: number;
    communication?: number;
    problem_solving?: number;
    confidence_score?: number;
    dimension_breakdown: Record<string, {
      name: string;
      internal_score: number;
      report_score: number;
      evidence_count: number;
      summary: string;
    }>;
  };
  hiring_assessment: {
    recommendation: "strong_yes" | "yes" | "mixed" | "no" | "insufficient_evidence";
    confidence: number;
    summary: string;
    key_strengths: string[];
    key_risks: string[];
    evidence_citations: string[];
    caveats: string[];
  };
  round_reports: Array<{
    round: string;
    questions_answered: number;
    round_score: number;
    concepts_covered: string[];
    concepts_missing: string[];
    strengths: string[];
    weaknesses: string[];
    completion_reason: string;
  }>;
  question_performances: Array<{
    turn: number;
    question_id: string;
    question_text: string;
    round: string;
    topic: string;
    candidate_answer: string;
    correctness: number;
    depth: number;
    clarity: number;
    is_dont_know: boolean;
    covered_concepts: string[];
    missing_concepts: string[];
  }>;
  concept_gaps: Array<{
    concept: string;
    affected_questions: string[];
    severity: string;
    evidence: string;
    recommended_learning_direction: string;
  }>;
  key_strengths: string[];
  key_weaknesses: string[];
  contradictions: Array<{
    slot: string;
    earlier_value: string;
    later_value: string;
    earlier_turn: number;
    later_turn: number;
    evidence: string;
  }>;
  executive_summary: string;
}

export interface CandidateSafeReport {
  session_id: string;
  role?: string;
  duration_seconds?: number;
  overall_score: number;
  feedback_summary: string;
  key_strengths: string[];
  growth_areas: string[];
}

export class KramixApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (process.env.NEXT_PUBLIC_API_URL) {
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL;
    } else if (typeof window !== "undefined") {
      this.baseUrl = window.location.origin;
    } else {
      this.baseUrl = "http://127.0.0.1:8000";
    }
  }

  /**
   * Creates a new interview session.
   */
  async createSession(req: CreateSessionRequest): Promise<CreateSessionResponse> {
    const res = await fetch(`${this.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to create session: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Retrieves presentation-safe session state.
   */
  async getSession(sessionId: string): Promise<SessionStateResponse> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to fetch session: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Retrieves the finalized structured interview report after session completion.
   */
  async getReport(sessionId: string): Promise<FinalInterviewReport> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/report`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to fetch report: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Retrieves the candidate-safe interview report (redacts internal hiring committee deliberation).
   */
  async getCandidateReport(sessionId: string): Promise<CandidateSafeReport> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/candidate-report`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to fetch candidate report: ${res.status}`);
    }
    return res.json();
  }
}

export const apiClient = new KramixApiClient();

