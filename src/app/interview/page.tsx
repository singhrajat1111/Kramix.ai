"use client";

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useInterviewSocket, AvatarState } from "@/hooks/useInterviewSocket";
import { useSTT } from "@/hooks/useSTT";
import { useTTS } from "@/hooks/useTTS";
import { apiClient, FinalInterviewReport } from "@/lib/api-client";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Cpu,
  Layers,
  ChevronRight,
  BarChart3,
  UserCheck,
  Camera,
  CameraOff,
  User,
} from "lucide-react";

function InterviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionIdParam = searchParams.get("sessionId");

  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionIdParam);
  const [answerInput, setAnswerInput] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [finalReport, setFinalReport] = useState<FinalInterviewReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Candidate Webcam
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const attachStreamToVideo = useCallback((stream: MediaStream | null) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      if (stream) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function enableCamera() {
      if (!cameraEnabled) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        attachStreamToVideo(null);
        return;
      }

      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Media devices not supported in this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        attachStreamToVideo(stream);
        setCameraError(null);
      } catch (err: any) {
        console.warn("Camera access denied or unavailable:", err);
        setCameraError(
          err.name === "NotAllowedError"
            ? "Camera permission denied"
            : err.message || "Camera unavailable"
        );
        setCameraEnabled(false);
      }
    }

    enableCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraEnabled, attachStreamToVideo]);

  useEffect(() => {
    if (sessionIdParam) {
      setActiveSessionId(sessionIdParam);
    }
  }, [sessionIdParam]);

  // Auto-create session if navigated directly without sessionId
  useEffect(() => {
    if (!sessionIdParam && !activeSessionId) {
      apiClient
        .createSession({ mode: "demo", role: "core java", max_turns: 6 })
        .then((res) => {
          setActiveSessionId(res.session_id);
          router.replace(`/interview?sessionId=${res.session_id}`);
        })
        .catch((err) => {
          console.error("Auto session creation error:", err);
        });
    }
  }, [sessionIdParam, activeSessionId, router]);

  // TTS Engine
  const { speak, isSpeaking } = useTTS();

  // Socket Engine
  const {
    isConnected,
    currentQuestion,
    isProcessing,
    currentRound,
    turnNumber,
    isComplete,
    roundTransition,
    error: socketError,
    avatarState,
    submitAnswer,
    startInterview,
  } = useInterviewSocket({
    sessionId: activeSessionId || "",
    autoStart: true,
    onComplete: (payload) => {
      loadReport();
    },
  });

  // STT Voice Recognition Engine
  const baseAnswerRef = useRef("");
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    resetSession,
    isSupported: isSttSupported,
    permissionDenied: sttPermissionDenied,
  } = useSTT({
    onTranscriptChange: (spokenText) => {
      const base = baseAnswerRef.current;
      setAnswerInput(base ? `${base} ${spokenText}` : spokenText);
    },
  });

  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      baseAnswerRef.current = answerInput.trim();
      startListening();
    }
  }, [isListening, stopListening, startListening, answerInput]);

  // When a new question arrives, ensure answer input and STT are cleanly reset
  const lastQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentQuestion && currentQuestion.question_id !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = currentQuestion.question_id;
      setAnswerInput("");
      baseAnswerRef.current = "";
      resetSession();
    }
  }, [currentQuestion, resetSession]);

  // Speak question when a new question arrives
  useEffect(() => {
    if (currentQuestion && ttsEnabled && !isComplete) {
      speak(currentQuestion.question_text);
    }
  }, [currentQuestion, ttsEnabled, speak, isComplete]);

  const loadReport = async () => {
    if (!activeSessionId) return;
    setLoadingReport(true);
    try {
      const rep = await apiClient.getReport(activeSessionId);
      setFinalReport(rep);
    } catch (err: any) {
      console.error("Failed to load report:", err);
      setReportError(err.message || "Failed to load report.");
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSendAnswer = () => {
    if (!answerInput.trim() || isProcessing || !currentQuestion) return;
    const textToSend = answerInput.trim();
    setAnswerInput("");
    baseAnswerRef.current = "";
    resetSession();
    submitAnswer(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendAnswer();
    }
  };

  // Avatar visuals based on state
  const getAvatarBadge = () => {
    if (isProcessing) return { label: "Thinking & Evaluating", color: "bg-purple-500", text: "text-purple-300" };
    if (avatarState === "speaking" || isSpeaking) return { label: "Asking Question", color: "bg-sky-500", text: "text-sky-300" };
    if (isListening) return { label: "Listening to You", color: "bg-emerald-500", text: "text-emerald-300" };
    if (isComplete) return { label: "Evaluation Completed", color: "bg-indigo-500", text: "text-indigo-300" };
    return { label: "Active", color: "bg-slate-500", text: "text-slate-300" };
  };

  const formatScore = (val?: number | null) => {
    if (val === undefined || val === null) return 0;
    return Math.round(val <= 1 && val > 0 ? val * 100 : val);
  };

  const badge = getAvatarBadge();

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-semibold text-white">Preparing Your Technical Interview Room...</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to session manager</p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="glass-panel rounded-2xl p-8 border border-slate-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/25">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Technical Interview Dossier</h1>
                <p className="text-xs text-slate-400 font-mono">
                  Session ID: {activeSessionId} • {finalReport?.session_info.role || "Technical Candidate"}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              New Interview
            </button>
          </div>

          {loadingReport ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-base font-semibold text-white">Synthesizing Hiring Committee Dossier...</h3>
              <p className="text-xs text-slate-400 mt-1">Aggregating depth metrics, coverage scores, and hiring verdict.</p>
            </div>
          ) : reportError ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-sm text-rose-400">{reportError}</p>
              <button
                onClick={loadReport}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Retry Loading Dossier
              </button>
            </div>
          ) : finalReport ? (
            <div className="space-y-8">
              {/* Top Score Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Score</span>
                  <span className="text-4xl font-extrabold text-white mt-1">
                    {formatScore(finalReport.performance_metrics.overall_score)}%
                  </span>
                  <span className="text-[11px] text-indigo-400 mt-1">Composite Technical Rating</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hiring Decision</span>
                  <span className={`text-xl font-bold uppercase mt-1.5 ${
                    finalReport.hiring_assessment.recommendation.includes("yes") ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {finalReport.hiring_assessment.recommendation.replace("_", " ")}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">Confidence: {finalReport.hiring_assessment.confidence}</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Turns Evaluated</span>
                  <span className="text-4xl font-extrabold text-white mt-1">
                    {finalReport.session_info.total_questions_answered} / {finalReport.session_info.total_questions_asked}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">Full Curriculum Completed</span>
                </div>
              </div>

              {/* Dimension Breakdown */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  Competency Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(finalReport.performance_metrics.dimension_breakdown || {}).map(([key, dim]) => (
                    <div key={key} className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
                      <div className="text-xs text-slate-400 truncate">{dim.name}</div>
                      <div className="text-lg font-bold text-white mt-1">{formatScore(dim.report_score)}%</div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, formatScore(dim.report_score)))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Demonstrated Strengths
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {finalReport.key_strengths?.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-500">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    Areas for Growth / Concept Gaps
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {finalReport.key_weaknesses?.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-500">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Per Question Performance Accordion */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  Turn-by-Turn Question Evaluation
                </h3>
                <div className="space-y-3">
                  {finalReport.question_performances?.map((qp) => (
                    <div key={qp.turn} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-indigo-400">
                          Turn {qp.turn} • {qp.round.toUpperCase()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          Score: {Math.round(qp.correctness * 100)}% | Depth: {Math.round(qp.depth * 100)}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-white mb-2">{qp.question_text}</p>
                      <p className="text-xs text-slate-400 italic bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 mb-2">
                        "{qp.candidate_answer}"
                      </p>
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {qp.covered_concepts?.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✓ {c}
                          </span>
                        ))}
                        {qp.missing_concepts?.map((m, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            ✕ {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-sm">
              Failed to load report. {reportError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Session Progress Bar */}
      <div className="flex items-center justify-between glass-panel rounded-xl px-4 py-3 border border-slate-800 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Round:</span>
            <span className="text-xs font-bold text-indigo-400 uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              {currentRound}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Turn:</span>
            <span className="text-xs font-bold text-white font-mono">{turnNumber} / 6</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {roundTransition && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              {roundTransition.message}
            </div>
          )}

          <button
            type="button"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              ttsEnabled
                ? "border-slate-700 bg-slate-800 text-slate-200"
                : "border-slate-800 bg-slate-900 text-slate-500"
            }`}
            title="Toggle Voice Readout"
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
            <span>{isConnected ? "Live Channel" : "Connecting..."}</span>
            {!isConnected && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline ml-1 cursor-pointer"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {socketError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Socket Notice: {socketError.message}</span>
        </div>
      )}

      {/* Main Split Layout: Interviewer Avatar + Interactive Prompt Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: AI Interviewer Avatar & State Visualizer (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden flex-1 min-h-[340px]">
            {/* Ambient Background Glow */}
            <div
              className={`absolute w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
                isProcessing
                  ? "bg-purple-600/25 scale-125"
                  : isSpeaking
                  ? "bg-sky-500/25 scale-110"
                  : isListening
                  ? "bg-emerald-500/25 scale-110"
                  : "bg-indigo-600/15"
              }`}
            />

            {/* Avatar Visual Core */}
            <div className="relative mb-6">
              <div
                className={`w-32 h-32 rounded-3xl flex items-center justify-center transition-all duration-500 border shadow-2xl relative ${
                  isProcessing
                    ? "border-purple-500 bg-purple-950/40 glow-indigo"
                    : isSpeaking
                    ? "border-sky-400 bg-sky-950/40 glow-sky"
                    : isListening
                    ? "border-emerald-400 bg-emerald-950/40 glow-emerald"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <Cpu
                  className={`w-16 h-16 transition-all duration-300 ${
                    isProcessing
                      ? "text-purple-400 animate-pulse scale-110"
                      : isSpeaking
                      ? "text-sky-300 animate-bounce"
                      : isListening
                      ? "text-emerald-300 scale-105"
                      : "text-slate-400"
                  }`}
                />
              </div>

              {/* Status Dot */}
              <div className="absolute -bottom-1 -right-1 p-1 bg-[#090c12] rounded-full">
                <div className={`w-4 h-4 rounded-full ${badge.color} animate-ping`} />
              </div>
            </div>

            {/* Dynamic Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono mb-4">
              <span className={`w-2 h-2 rounded-full ${badge.color}`} />
              <span className={badge.text}>{badge.label}</span>
            </div>

            {/* Audio Wave Visualizer (When Speaking or Listening) */}
            {(isSpeaking || isListening) && (
              <div className="flex items-center gap-1.5 h-8 mb-2">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full wave-bar ${isSpeaking ? "bg-sky-400" : "bg-emerald-400"}`}
                  />
                ))}
              </div>
            )}

            <div className="text-center text-xs text-slate-400 max-w-xs mt-2">
              {!isConnected
                ? "Connecting to live interview channel..."
                : isProcessing
                ? "The evaluation engine is validating your response against core concepts..."
                : isSpeaking
                ? "Interviewer is articulating the technical requirement."
                : isListening
                ? "Speak clearly into your microphone or type your response below."
                : currentQuestion
                ? "Waiting for candidate submission."
                : "Interviewer is preparing your question..."}
            </div>
          </div>

          {/* Candidate Webcam Feed Tile */}
          <div className="glass-panel rounded-2xl p-3.5 border border-slate-800 relative overflow-hidden flex flex-col justify-between bg-slate-950/60">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800">
              {cameraEnabled && !cameraError ? (
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-300">{cameraError || "Camera Turned Off"}</span>
                  {cameraError ? (
                    <div className="flex flex-col items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-amber-400/90 max-w-[220px]">
                        Ensure no other app is using your webcam & permissions are allowed.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraError(null);
                          setCameraEnabled(true);
                        }}
                        className="mt-1 px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-[10px] font-semibold transition-all cursor-pointer shadow-sm"
                      >
                        Retry Camera
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        setCameraEnabled(true);
                      }}
                      className="mt-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all"
                    >
                      Turn On
                    </button>
                  )}
                </div>
              )}

              {/* Candidate Tag */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono text-white flex items-center gap-1.5 border border-white/10">
                <span className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
                <span>Candidate</span>
              </div>
            </div>

            {/* Quick Media Controls */}
            <div className="flex items-center justify-between mt-2.5 px-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCameraEnabled(!cameraEnabled)}
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                    cameraEnabled
                      ? "border-slate-700 bg-slate-800/80 text-slate-200"
                      : "border-rose-900/60 bg-rose-950/30 text-rose-400"
                  }`}
                  title={cameraEnabled ? "Turn off Camera" : "Turn on Camera"}
                >
                  {cameraEnabled ? <Camera className="w-3.5 h-3.5 text-sky-400" /> : <CameraOff className="w-3.5 h-3.5" />}
                  <span className="text-[11px]">{cameraEnabled ? "Cam On" : "Cam Off"}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleMic}
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                    isListening
                      ? "border-emerald-600 bg-emerald-950/40 text-emerald-300"
                      : "border-slate-700 bg-slate-800/80 text-slate-300"
                  }`}
                  title={isListening ? "Mute Mic" : "Unmute Mic"}
                >
                  {isListening ? <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-[11px]">{isListening ? "Mic Live" : "Mic Muted"}</span>
                </button>
              </div>

              <div className="text-[10px] font-mono text-slate-500">
                {sttPermissionDenied ? (
                  <span className="text-rose-400">Mic Blocked</span>
                ) : isListening ? (
                  <span className="text-emerald-400 font-semibold">Listening...</span>
                ) : (
                  "Idle"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Question Display & Answer Workspace (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Question Box */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
                <Sparkles className="w-4 h-4" />
                <span>QUESTION {turnNumber || 1}</span>
                {currentQuestion?.topic && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400 uppercase">{currentQuestion.topic}</span>
                  </>
                )}
              </div>
              {currentQuestion?.difficulty && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-mono">
                  {currentQuestion.difficulty}
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
              {currentQuestion
                ? currentQuestion.question_text
                : isProcessing
                ? "Evaluating previous submission..."
                : !isConnected
                ? "Connecting to interview session..."
                : "Preparing question..."}
            </h2>
          </div>

          {/* Answer Input Workspace */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex-1 flex flex-col justify-between">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  Your Technical Answer
                </label>
                {isListening && (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Recording Speech...
                  </span>
                )}
              </div>

              <textarea
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing || !currentQuestion}
                placeholder={
                  isListening
                    ? "Listening... Speak your response clearly..."
                    : "Type your answer here in detail... Include architectural trade-offs, code constructs, and complexity analysis. Press Enter to submit."
                }
                className="w-full flex-1 min-h-[160px] p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            {/* Answer Control Toolbar */}
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                {isSttSupported && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={isProcessing || !currentQuestion}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      isListening
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 animate-pulse"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    <span>{isListening ? "Stop Voice" : "Answer via Voice"}</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  {answerInput.length} chars
                </span>
              </div>

              <button
                type="button"
                onClick={handleSendAnswer}
                disabled={!answerInput.trim() || isProcessing || !currentQuestion}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center gap-2 transition-all"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterviewRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
