import { useEffect, useRef, useState, useCallback } from "react";
import {
  KramixWebSocketClient,
  ClientQuestion,
  ClientTurnResult,
  RoundTransitionPayload,
  InterviewCompletePayload,
} from "@/lib/ws-client";

export type AvatarState = "idle" | "thinking" | "speaking" | "listening" | "transition" | "completed" | "error";

export interface UseInterviewSocketOptions {
  sessionId: string;
  autoStart?: boolean;
  onComplete?: (payload: InterviewCompletePayload) => void;
  onError?: (err: { code: string; message: string }) => void;
}

export function useInterviewSocket({
  sessionId,
  autoStart = false,
  onComplete,
  onError,
}: UseInterviewSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<ClientQuestion | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRound, setCurrentRound] = useState<string>("technical");
  const [turnNumber, setTurnNumber] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [roundTransition, setRoundTransition] = useState<RoundTransitionPayload | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const clientRef = useRef<KramixWebSocketClient | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const client = new KramixWebSocketClient(sessionId, undefined, {
      onConnectionChange: (connected) => {
        setIsConnected(connected);
      },
      onReady: (payload) => {
        if (payload.current_turn) setTurnNumber(payload.current_turn);
        if (payload.round) setCurrentRound(payload.round);
        if (payload.is_complete) setIsComplete(true);
        if (payload.current_question) {
          setCurrentQuestion(payload.current_question);
        } else if (autoStart && !payload.is_complete) {
          client.startSession();
        }
      },
      onQuestion: (q) => {
        setCurrentQuestion(q);
        setTurnNumber(q.turn);
        setCurrentRound(q.round);
        setIsProcessing(false);
        setAvatarState("speaking");
        // Transition avatar to listening after simulated delivery/speech
        setTimeout(() => {
          setAvatarState("listening");
        }, 1500);
      },
      onProcessing: () => {
        setIsProcessing(true);
        setAvatarState("thinking");
      },
      onTurnResult: (res: ClientTurnResult) => {
        setTurnNumber(res.turn);
        setCurrentRound(res.round);
      },
      onRoundTransition: (transition) => {
        setRoundTransition(transition);
        setCurrentRound(transition.new_round);
        setAvatarState("transition");
      },
      onInterviewComplete: (comp) => {
        setIsComplete(true);
        setIsProcessing(false);
        setCurrentQuestion(null);
        setAvatarState("completed");
        onCompleteRef.current?.(comp);
      },
      onError: (err) => {
        setError(err);
        setIsProcessing(false);
        setAvatarState("error");
        onErrorRef.current?.(err);
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
    };
  }, [sessionId, autoStart]);

  const startInterview = useCallback(() => {
    clientRef.current?.startSession();
  }, []);

  const submitAnswer = useCallback((answer: string, inputMode: "text" | "voice" = "text") => {
    if (!answer.trim() || isProcessing || isComplete) return;
    setIsProcessing(true);
    clientRef.current?.submitAnswer(answer, inputMode);
  }, [isProcessing, isComplete]);

  const endInterview = useCallback(() => {
    clientRef.current?.endSession();
  }, []);

  return {
    isConnected,
    currentQuestion,
    isProcessing,
    currentRound,
    turnNumber,
    isComplete,
    roundTransition,
    error,
    avatarState,
    startInterview,
    submitAnswer,
    endInterview,
  };
}
