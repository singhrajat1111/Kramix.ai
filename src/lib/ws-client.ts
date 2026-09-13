/**
 * Typed WebSocket Client for Kramix V2 Live Interview Channel.
 * Handles connection lifecycle, auto-reconnection, and typed event dispatching.
 * Frontend presentation layer only: decisions and evaluation remain on the server.
 */

export interface ClientQuestion {
  question_id: string;
  question_text: string;
  turn: number;
  round: string;
  topic?: string;
  difficulty?: string;
}

export interface ClientTurnResult {
  turn: number;
  phase: string;
  status: string;
  round: string;
}

export interface RoundTransitionPayload {
  previous_round: string;
  new_round: string;
  message: string;
}

export interface InterviewCompletePayload {
  completion_status: string;
  total_questions: number;
  report_available: boolean;
  report_url: string;
}

export interface ServerWSEvent {
  type: "session_ready" | "question" | "processing" | "turn_result" | "round_transition" | "interview_complete" | "error";
  session_id: string;
  turn?: number;
  payload: any;
}

export type WSEventListeners = {
  onReady?: (payload: any) => void;
  onQuestion?: (question: ClientQuestion) => void;
  onProcessing?: (status: string) => void;
  onTurnResult?: (result: ClientTurnResult) => void;
  onRoundTransition?: (transition: RoundTransitionPayload) => void;
  onInterviewComplete?: (complete: InterviewCompletePayload) => void;
  onError?: (err: { code: string; message: string }) => void;
  onConnectionChange?: (connected: boolean) => void;
};

export class KramixWebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private wsUrl: string;
  private listeners: WSEventListeners = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private shouldReconnect = true;

  constructor(sessionId: string, baseUrl?: string, listeners?: WSEventListeners) {
    this.sessionId = sessionId;
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = baseUrl;
    if (!host) {
      if (process.env.NEXT_PUBLIC_WS_URL) {
        host = process.env.NEXT_PUBLIC_WS_URL;
      } else if (typeof window !== "undefined") {
        host = window.location.port === "3000" ? "127.0.0.1:8000" : window.location.host;
      } else {
        host = "127.0.0.1:8000";
      }
    }
    this.wsUrl = `${protocol}//${host}/ws/interview/${sessionId}`;
    if (listeners) {
      this.listeners = listeners;
    }
  }

  setListeners(listeners: WSEventListeners) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  private reconnectTimer: any = null;

  connect() {
    this.shouldReconnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.listeners.onConnectionChange?.(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: ServerWSEvent = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      this.ws.onclose = () => {
        this.listeners.onConnectionChange?.(false);
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const backoff = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts), 8000);
          this.reconnectTimer = setTimeout(() => this.connect(), backoff);
        }
      };

      this.ws.onerror = (err) => {
        // Silently caught; onclose triggers reconnection if appropriate
      };
    } catch (err) {
      console.error("Failed to establish WebSocket connection:", err);
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  startSession() {
    this.send({
      type: "session_start",
      session_id: this.sessionId,
    });
  }

  submitAnswer(answer: string, inputMode: "text" | "voice" = "text") {
    this.send({
      type: "answer_submit",
      session_id: this.sessionId,
      answer,
      input_mode: inputMode,
    });
  }

  endSession() {
    this.send({
      type: "session_end",
      session_id: this.sessionId,
    });
  }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("WebSocket not connected; message dropped:", msg);
    }
  }

  private handleServerMessage(msg: ServerWSEvent) {
    switch (msg.type) {
      case "session_ready":
        this.listeners.onReady?.(msg.payload);
        break;
      case "question":
        this.listeners.onQuestion?.(msg.payload as ClientQuestion);
        break;
      case "processing":
        this.listeners.onProcessing?.(msg.payload.status || "processing");
        break;
      case "turn_result":
        this.listeners.onTurnResult?.(msg.payload as ClientTurnResult);
        break;
      case "round_transition":
        this.listeners.onRoundTransition?.(msg.payload as RoundTransitionPayload);
        break;
      case "interview_complete":
        this.listeners.onInterviewComplete?.(msg.payload as InterviewCompletePayload);
        break;
      case "error":
        this.listeners.onError?.(msg.payload);
        break;
      default:
        console.warn("Unknown server message type:", msg);
    }
  }
}
