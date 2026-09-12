"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StorageManager } from "@/lib/storage/storage-manager";
import { getLLMProvider } from "@/lib/ai/factory";
import { InterviewDirector } from "@/lib/director/interview-director";
import { SpeechToTextEngine } from "@/lib/speech/speech-to-text";
import { TextToSpeechEngine } from "@/lib/speech/text-to-speech";
import { CandidateVideo } from "@/components/interview/CandidateVideo";
import { InterviewerAvatarEngine } from "@/components/avatar/InterviewerAvatarEngine";
import { InterviewTranscript } from "@/components/interview/InterviewTranscript";
import { InterviewControls } from "@/components/interview/InterviewControls";
import { CandidateProfile, DEFAULT_CANDIDATE_PROFILE } from "@/types/candidate";
import { ConversationTurn, InterviewDirectorState, InterviewState } from "@/types/interview";
import { resolveInterviewMode } from "@/types/interview-mode";
import { AuthoritativeAvatarState, AvatarMode } from "@/types/avatar";
import { InterviewRoundInfo, ResearchPlan } from "@/types/research";
import { InterviewSession } from "@/types/session";
import { InterviewReport } from "@/types/evaluation";
import { HiringCommitteeEngine } from "@/lib/committee/hiring-committee-engine";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { useUserAccount } from "@/components/auth/AuthProvider";
import { RouteGuard } from "@/components/common/RouteGuard";
import { getDemoQuestionsForRole } from "@/lib/demo/question-bank";
import { shouldShowUpgradeGate, DEMO_QUESTION_LIMIT } from "@/lib/demo/session-limit";
import { INTERVIEW_CONFIG, FULL_INTERVIEW_DURATION_MINUTES } from "@/lib/config/interview-config";
import { isCoreJavaDomain } from "@/lib/demo/core-java";
import { DemoEndModal } from "@/components/demo/DemoEndModal";
import {
  AlertTriangle,
  Loader2,
  Play,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Compass,
  Clock,
  Layers,
  XCircle,
  HelpCircle,
  Video,
} from "lucide-react";

export default function InterviewRoomPage() {
  const router = useRouter();
  const { user, openCheckoutModal, refreshUser } = useUserAccount();
  const [dismissedMidwayBanner, setDismissedMidwayBanner] = useState(false);

  // Entities & Engines
  const directorRef = useRef<InterviewDirector | null>(null);
  const sttEngineRef = useRef<SpeechToTextEngine | null>(null);
  const ttsEngineRef = useRef<TextToSpeechEngine | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Component State
  const [candidate, setCandidate] = useState<CandidateProfile>(DEFAULT_CANDIDATE_PROFILE);
  const [selectedRound, setSelectedRound] = useState<InterviewRoundInfo | null>(null);
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null);
  const [directorState, setDirectorState] = useState<InterviewDirectorState | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Multi-Round State
  const [multiRoundSession, setMultiRoundSession] = useState<InterviewSession | null>(null);
  const [showOrientation, setShowOrientation] = useState<boolean>(true);
  const [completedRoundReport, setCompletedRoundReport] = useState<InterviewReport | null>(null);

  // Demo Mode Gating & Bank Modal
  const [demoModalState, setDemoModalState] = useState<{
    isOpen: boolean;
    reason: "limit_reached" | "role_not_covered";
    role?: string;
    company?: string;
    questionsCompleted?: number;
  }>({
    isOpen: false,
    reason: "limit_reached",
  });

  // Authoritative Avatar State & Mode
  const [authoritativeAvatarState, setAuthoritativeAvatarState] =
    useState<AuthoritativeAvatarState>("IDLE");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("PHOTOREALISTIC");

  // UI Interactive States
  const [interviewState, setInterviewState] = useState<InterviewState>("IDLE");
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [liveSpeech, setLiveSpeech] = useState<string>("");
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [avatarActivity, setAvatarActivity] = useState(0);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI Question Generation State
  const [aiGenerationStatus, setAiGenerationStatus] = useState<string>("");
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null);

  // Speech turn session tracking to prevent duplicate or interrupted speech races
  const speechSessionIdRef = useRef<number>(0);

  // Authoritative Speech Helper
  const speakText = useCallback(
    (
      text: string,
      onEnd?: () => void,
      avatarNextState: AuthoritativeAvatarState = "LISTENING"
    ) => {
      if (!ttsEngineRef.current) return;
      if (isVoiceMuted) {
        setAuthoritativeAvatarState(avatarNextState);
        onEnd?.();
        return;
      }

      setAuthoritativeAvatarState("SPEAKING");
      setAvatarActivity(45);

      const sessionToken = ++speechSessionIdRef.current;

      ttsEngineRef.current.speak(text, {
        onStart: () => {
          if (speechSessionIdRef.current !== sessionToken) return;
          setAuthoritativeAvatarState("SPEAKING");
          setAvatarActivity(70);
        },
        onBoundary: () => {
          if (speechSessionIdRef.current !== sessionToken) return;
          // Dynamic vocal frequency fluctuation synced to spoken words
          setAvatarActivity(Math.floor(Math.random() * 35) + 65);
        },
        onEnd: () => {
          if (speechSessionIdRef.current !== sessionToken) return;
          setAvatarActivity(0);
          setAuthoritativeAvatarState(avatarNextState);
          onEnd?.();
        },
        onError: () => {
          if (speechSessionIdRef.current !== sessionToken) return;
          setAvatarActivity(0);
          setAuthoritativeAvatarState(avatarNextState);
          onEnd?.();
        },
      });
    },
    [isVoiceMuted]
  );

  // Live speech ref to ensure STT silence timers never capture stale closures
  const liveSpeechRef = useRef<string>("");
  const submitAnswerRef = useRef<(speechText: string) => Promise<void>>(async () => {});

  // Authoritative Speech-To-Text candidate listener
  const startListeningForCandidate = useCallback(() => {
    setInterviewState("LISTENING");
    setAuthoritativeAvatarState("LISTENING");
    setLiveSpeech("");
    liveSpeechRef.current = "";

    if (sttEngineRef.current && !isMuted) {
      sttEngineRef.current.startListening({
        onTranscriptChange: (transcript) => {
          liveSpeechRef.current = transcript;
          setLiveSpeech(transcript);
        },
        onError: (err) => {
          console.warn("STT candidate audio notice:", err);
        },
        onSilenceTimeout: () => {
          // 4.5s natural silence timeout
          const candidateSpeech = (
            liveSpeechRef.current ||
            (sttEngineRef.current ? sttEngineRef.current.getLatestTranscript() : "")
          ).trim();
          if (candidateSpeech.length > 15) {
            submitAnswerRef.current(candidateSpeech);
          }
        },
        onListeningStateChange: (listening) => {
          if (listening) {
            setAuthoritativeAvatarState("LISTENING");
          }
        },
      });
    }
  }, [isMuted]);

  // Conclude round and synthesize evaluation
  const handleConcludeAndEvaluate = useCallback(async () => {
    if (!directorRef.current) return;
    setIsLoadingEvaluation(true);
    setInterviewState("EVALUATION");
    setAuthoritativeAvatarState("THINKING");

    if (sttEngineRef.current) {
      sttEngineRef.current.stopListening();
    }
    if (ttsEngineRef.current) {
      ttsEngineRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    try {
      const finalReport = await directorRef.current.generateFinalEvaluation();
      StorageManager.saveLatestReport(finalReport);
      setCompletedRoundReport(finalReport);

      const session = StorageManager.getInterviewSession();
      if (session) {
        const curIdx = session.currentRoundIndex;
        if (session.rounds[curIdx]) {
          session.rounds[curIdx].status = "COMPLETED";
          session.rounds[curIdx].evaluation = finalReport;
          session.rounds[curIdx].score = finalReport.overallScore;
          session.rounds[curIdx].strengths = finalReport.strengths;
          session.rounds[curIdx].weaknesses = finalReport.weaknesses;
          session.rounds[curIdx].completedAt = Date.now();
          session.rounds[curIdx].answers = directorRef.current.getState().candidateResponses;
          session.rounds[curIdx].questionsAsked = session.rounds[curIdx].answers.length;
        }
        session.roundResults.push(finalReport);
        session.totalAnsweredQuestions += finalReport.questionEvaluations?.length || 0;
        session.overallProgress = Math.round(((curIdx + 1) / session.rounds.length) * 100);
        setMultiRoundSession({ ...session });
        StorageManager.saveInterviewSession(session);

        // Deduct 1 credit strictly upon round completion (BYOK rounds never consume credits)
        try {
          const aiConfig = StorageManager.getAIConfig();
          const fundingSource = isDemoMode
            ? "demo"
            : aiConfig.apiKey || user?.hasBYOK
            ? "byok"
            : user?.plan === "subscriber"
            ? "subscriber"
            : "credits";

          await fetch("/api/interview/complete-round", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roundIndex: curIdx,
              fundingSource,
            }),
          });
          refreshUser();
        } catch (decrementErr) {
          console.warn("Round completion credit decrement notice:", decrementErr);
        }

        // If Full Simulation and there are subsequent rounds, show intermediate completion screen
        if (session.simulationMode === "FULL_SIMULATION" && curIdx < session.rounds.length - 1) {
          setIsLoadingEvaluation(false);
          setInterviewState("ROUND_COMPLETE");
          setAuthoritativeAvatarState("TRANSITIONING");
          StorageManager.clearActiveSession();
          return;
        }

        // Final round or practice round: synthesize Dossier
        const aiConfig = StorageManager.getAIConfig();
        const provider = getLLMProvider(aiConfig);
        const dossier = await HiringCommitteeEngine.generateDossier(session, provider);
        StorageManager.saveLatestDossier(dossier);
        session.finalDossier = dossier;
        session.sessionCompletedAt = Date.now();
        StorageManager.saveInterviewSession(session);
        StorageManager.clearActiveSession();
        router.push("/results");
      } else {
        StorageManager.clearActiveSession();
        router.push("/results");
      }
    } catch (e) {
      console.error("Evaluation generation failed, computing dynamic fallback", e);
      const fallbackReport = directorRef.current.computeDynamicTranscriptEvaluation();
      StorageManager.saveLatestReport(fallbackReport);
      StorageManager.clearActiveSession();
      router.push("/results");
    }
  }, [router, isDemoMode, refreshUser, user?.hasBYOK, user?.plan]);

  const handleConcludeFinalDossier = useCallback(async () => {
    setIsLoadingEvaluation(true);
    setAuthoritativeAvatarState("THINKING");
    const session = StorageManager.getInterviewSession();
    if (session) {
      try {
        const aiConfig = StorageManager.getAIConfig();
        const provider = getLLMProvider(aiConfig);
        const dossier = await HiringCommitteeEngine.generateDossier(session, provider);
        StorageManager.saveLatestDossier(dossier);
        session.finalDossier = dossier;
        session.sessionCompletedAt = Date.now();
        StorageManager.saveInterviewSession(session);
      } catch (e) {
        console.error("Dossier generation failed:", e);
      }
    }
    StorageManager.clearActiveSession();
    router.push("/results");
  }, [router]);

  const handleProceedToNextRound = useCallback(() => {
    const session = StorageManager.getInterviewSession();
    const plan = StorageManager.getResearchPlan();
    if (!session || !plan) return;

    const nextIndex = session.currentRoundIndex + 1;
    if (nextIndex >= session.rounds.length) {
      handleConcludeFinalDossier();
      return;
    }

    const nextRoundInfo = plan.rounds[nextIndex];
    if (!nextRoundInfo) return;

    session.currentRoundIndex = nextIndex;
    session.rounds[nextIndex].status = "IN_PROGRESS";
    setMultiRoundSession({ ...session });
    StorageManager.saveInterviewSession(session);
    StorageManager.saveSelectedRound(nextRoundInfo);

    // Reset round states
    setSelectedRound(nextRoundInfo);
    setElapsedSeconds(0);
    setLiveSpeech("");
    setHistory([]);
    setCurrentPrompt("");
    setCompletedRoundReport(null);
    setInterviewState("IDLE");
    setAuthoritativeAvatarState("IDLE");
    setShowOrientation(true);
    StorageManager.clearActiveSession();

    // Reinitialize director for next round
    const aiConfig = StorageManager.getAIConfig();
    const provider = getLLMProvider(aiConfig);
    const cand = StorageManager.getCandidateProfile();
    const mode = resolveInterviewMode(aiConfig);

    const previousRoundContext = session.roundResults.map((r) => ({
      roundTitle: r.roundName,
      category: r.roundName,
      score: r.overallScore,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
    }));

    const previouslyAskedQuestions = session.rounds.flatMap((r) =>
      r.answers.map((a) => a.questionText)
    );

    const isAi = mode === "ai";
    const director = new InterviewDirector(cand, plan, nextRoundInfo, provider, {
      interviewMode: mode,
      maxDurationMinutes: isAi ? FULL_INTERVIEW_DURATION_MINUTES : (nextRoundInfo.typicalDurationMinutes || INTERVIEW_CONFIG.demo.typicalDurationMinutes),
      maxQuestions: isAi ? INTERVIEW_CONFIG.full.maxQuestions : DEMO_QUESTION_LIMIT,
      maxFollowUpsPerQuestion: plan.blueprint?.followUpPolicy?.maxFollowUps ?? 2,
      blueprint: plan.blueprint,
      previousRoundContext,
      previouslyAskedQuestions,
    });
    directorRef.current = director;

    // AI MODE: Pre-generate questions for next round
    if (mode === "ai") {
      setInterviewState("GENERATING");
      setAiGenerationStatus("Preparing next round...");
      setShowOrientation(true);

      director.initializeAIQuestions((status) => {
        setAiGenerationStatus(status);
      }).then(() => {
        setInterviewState("IDLE");
        setAiGenerationStatus("");
      }).catch((err: Error) => {
        setInterviewState("FAILED");
        setAiGenerationError(err.message || "Failed to generate questions for this round.");
      });
    }
  }, [handleConcludeFinalDossier]);

  const isSubmittingRef = useRef(false);

  // Submit Answer to Director
  const submitAnswer = useCallback(
    async (speechText: string) => {
      if (!directorRef.current) return;
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      // Immediately cancel any active utterance
      if (ttsEngineRef.current) {
        ttsEngineRef.current.stop();
      }

      // Stop STT
      if (sttEngineRef.current) {
        sttEngineRef.current.stopListening();
      }

      setInterviewState("PROCESSING");
      setAuthoritativeAvatarState("THINKING");
      setErrorMessage(null);

      try {
        const { interviewerResponse, nextAction, state: newState } =
          await directorRef.current.processCandidateAnswer(speechText);

        StorageManager.saveActiveSession({
          directorState: newState,
          history: newState.conversationHistory,
          elapsedSeconds,
        });

        setDirectorState(newState);
        setHistory([...newState.conversationHistory]);
        setCurrentPrompt(interviewerResponse);
        setLiveSpeech("");

        // In Demo Mode: Enforce DEMO_QUESTION_LIMIT (5 questions)
        const questionsAnsweredSoFar = newState.candidateResponses.length;
        if (isDemoMode && shouldShowUpgradeGate(questionsAnsweredSoFar)) {
          setInterviewState("ROUND_COMPLETE");
          setAuthoritativeAvatarState("IDLE");
          speakText(
            `That concludes your ${DEMO_QUESTION_LIMIT}-question demo interview. Thank you for participating!`,
            () => {
              setDemoModalState({
                isOpen: true,
                reason: "limit_reached",
                role: candidate.targetRole || "Software Engineer",
                company: candidate.targetCompanies[0] || "Target Company",
                questionsCompleted: questionsAnsweredSoFar,
              });
            },
            "IDLE"
          );
          return;
        }

        if (nextAction === "CONCLUDE") {
          setInterviewState("ROUND_COMPLETE");
          speakText(interviewerResponse, () => {
            handleConcludeAndEvaluate();
          });
        } else {
          setInterviewState(nextAction === "FOLLOW_UP" ? "FOLLOW_UP" : "QUESTION");
          speakText(interviewerResponse, () => {
            startListeningForCandidate();
          });
        }
      } catch (err) {
        console.error("InterviewDirector turn execution notice:", err);
        setInterviewState("LISTENING");
        setAuthoritativeAvatarState("LISTENING");
        setErrorMessage("Something went wrong while processing your answer. Your interview progress is safely preserved. Please click Retry Answer below.");
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [
      speakText,
      handleConcludeAndEvaluate,
      startListeningForCandidate,
      elapsedSeconds,
      isDemoMode,
      candidate.targetRole,
      candidate.targetCompanies,
    ]
  );

  // Sync ref to current submitAnswer handler
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  // Advance to Q1 after greeting audio finishes completely or when skipped
  const advanceToQuestionOne = useCallback(() => {
    if (!directorRef.current) return;

    // Invalidate any ongoing speech session (e.g. greeting intro) and stop active audio
    speechSessionIdRef.current++;
    if (ttsEngineRef.current) {
      ttsEngineRef.current.stop();
    }
    setAvatarActivity(0);

    const q1 = directorRef.current.getNextQuestion();
    setDirectorState(q1.state);
    setHistory([...q1.state.conversationHistory]);
    setCurrentPrompt(q1.turn.text);
    setInterviewState("QUESTION");

    speakText(
      q1.turn.text,
      () => {
        startListeningForCandidate();
      },
      "LISTENING"
    );
  }, [speakText, startListeningForCandidate]);

  // Repeat current prompt
  const handleRepeatPrompt = () => {
    if (currentPrompt) {
      speakText(currentPrompt);
    }
  };

  // Immediate Interruption / Barge-in (Stop AI)
  const handleStopInterviewer = useCallback(() => {
    speechSessionIdRef.current++;
    if (ttsEngineRef.current) {
      ttsEngineRef.current.stop();
    }
    setAvatarActivity(0);
    setAuthoritativeAvatarState("INTERRUPTED");

    // Immediately switch to listening for candidate
    setTimeout(() => {
      startListeningForCandidate();
    }, 150);
  }, [startListeningForCandidate]);

  // Start round after orientation: Greeting audio must finish COMPLETELY before Question 1 starts
  const startRoundAfterOrientation = useCallback(() => {
    setShowOrientation(false);
    if (!directorRef.current) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        directorRef.current?.updateElapsedSeconds(next);
        return next;
      });
    }, 1000);

    const { turn, state } = directorRef.current.startInterview();
    setDirectorState(state);
    setHistory([turn]);
    setCurrentPrompt(turn.text);
    setInterviewState("INTRO");

    const currentSession = speechSessionIdRef.current + 1;

    // Play complete greeting audio. Only when audio finishes does Question 1 begin.
    speakText(
      turn.text,
      () => {
        // Guard against race conditions if interrupted
        if (speechSessionIdRef.current !== currentSession) return;
        setAuthoritativeAvatarState("IDLE");
        setAvatarActivity(0);

        setTimeout(() => {
          if (speechSessionIdRef.current !== currentSession) return;
          advanceToQuestionOne();
        }, 250);
      },
      "IDLE"
    );
  }, [advanceToQuestionOne, speakText]);

  // Initialize Interview Room
  useEffect(() => {
    const loadedCandidate = StorageManager.getCandidateProfile();
    const loadedRound = StorageManager.getSelectedRound();
    const loadedPlan = StorageManager.getResearchPlan();
    const aiConfig = StorageManager.getAIConfig();
    const session = StorageManager.getInterviewSession();

    if (!loadedPlan || !loadedRound) {
      router.push("/research");
      return;
    }

    // AUTHORITATIVE MODE DECISION — single source of truth
    const mode = resolveInterviewMode(aiConfig);
    const isDemo = mode === "demo";
    setIsDemoMode(isDemo);

    // In Demo Mode: Source randomized questions from question bank
    if (isDemo) {
      // Gather previously asked questions for cross-round deduplication
      const prevAsked = (session?.rounds || []).flatMap((r) =>
        r.answers.map((a) => a.questionText)
      );
      // Domain detection for Core Java across candidate's role, skills, job description, resume
      const isCoreJava = isCoreJavaDomain({
        targetRole: loadedCandidate.targetRole,
        skills: loadedCandidate.skills,
        jobDescription: loadedCandidate.jobDescription,
        resumeText: loadedCandidate.resumeText,
      });
      const queryRole = isCoreJava ? "Core Java" : loadedCandidate.targetRole;
      const demoResult = getDemoQuestionsForRole(queryRole, DEMO_QUESTION_LIMIT, prevAsked);
      if (!demoResult.roleCovered) {
        setDemoModalState({
          isOpen: true,
          reason: "role_not_covered",
          role: loadedCandidate.targetRole || "Target Role",
          company: loadedCandidate.targetCompanies[0] || "Target Company",
        });
      } else {
        // Populate round questions with randomized demo bank questions
        loadedRound.sampleQuestions = demoResult.questions.map((q) => q.question);
        loadedPlan.questionBank = demoResult.questions.map((q, idx) => ({
          id: `demo_bank_q_${idx + 1}`,
          roundCategory: loadedRound.category,
          category: q.category === "behavioral" ? "Behavioral" : "Technical",
          questionText: q.question,
          intent: q.keyPoints.join(", "),
          evaluationCriteria: q.keyPoints,
          difficulty: "Mid",
        }));
      }
    }

    setCandidate(loadedCandidate);
    setSelectedRound(loadedRound);
    setResearchPlan(loadedPlan);
    if (session) {
      setMultiRoundSession(session);
    }

    const previousRoundContext = (session?.roundResults || []).map((r) => ({
      roundTitle: r.roundName,
      category: r.roundName,
      score: r.overallScore,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
    }));

    const previouslyAskedQuestions = (session?.rounds || []).flatMap((r) =>
      r.answers.map((a) => a.questionText)
    );

    const provider = getLLMProvider(aiConfig);
    const director = new InterviewDirector(loadedCandidate, loadedPlan, loadedRound, provider, {
      interviewMode: mode,
      maxDurationMinutes: isDemo
        ? (loadedRound.typicalDurationMinutes || INTERVIEW_CONFIG.demo.typicalDurationMinutes)
        : FULL_INTERVIEW_DURATION_MINUTES,
      maxQuestions: isDemo ? DEMO_QUESTION_LIMIT : INTERVIEW_CONFIG.full.maxQuestions,
      maxFollowUpsPerQuestion: loadedPlan.blueprint?.followUpPolicy?.maxFollowUps ?? 2,
      blueprint: loadedPlan.blueprint,
      previousRoundContext,
      previouslyAskedQuestions,
    });
    directorRef.current = director;

    // AI MODE: Pre-generate personalized questions before interview starts
    if (mode === "ai") {
      setInterviewState("GENERATING");
      setAiGenerationStatus("Preparing your personalized interview...");
      setAiGenerationError(null);

      director.initializeAIQuestions((status) => {
        setAiGenerationStatus(status);
      }).then(() => {
        setInterviewState("IDLE");
        setAiGenerationStatus("");
      }).catch((err: Error) => {
        setInterviewState("FAILED");
        setAiGenerationError(
          err.message || "Failed to generate personalized questions. You can retry or continue with Demo Interview."
        );
      });
    }

    sttEngineRef.current = new SpeechToTextEngine();
    ttsEngineRef.current = new TextToSpeechEngine();

    // Check for saved recovery session
    const savedSession = StorageManager.getActiveSession<{
      directorState: InterviewDirectorState;
      history: ConversationTurn[];
      elapsedSeconds: number;
    }>();

    if (savedSession && savedSession.history && savedSession.history.length > 0) {
      director.restoreState(savedSession.directorState);
      setDirectorState(savedSession.directorState);
      setHistory(savedSession.history);
      setElapsedSeconds(savedSession.elapsedSeconds || 0);
      setShowOrientation(false);

      const lastInterviewerTurn = [...savedSession.history]
        .reverse()
        .find((t) => t.role === "interviewer");
      if (lastInterviewerTurn) {
        setCurrentPrompt(lastInterviewerTurn.text);
      }

      setInterviewState("QUESTION");
      setAuthoritativeAvatarState("LISTENING");
      startListeningForCandidate();

      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          directorRef.current?.updateElapsedSeconds(next);
          return next;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (sttEngineRef.current) sttEngineRef.current.stopListening();
      if (ttsEngineRef.current) ttsEngineRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Controls Handlers
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next && sttEngineRef.current) {
        sttEngineRef.current.stopListening();
      } else if (!next && interviewState === "LISTENING") {
        startListeningForCandidate();
      }
      return next;
    });
  };

  const handleToggleVideo = () => {
    setIsVideoOff((prev) => !prev);
  };

  const handleToggleVoice = () => {
    setIsVoiceMuted((prev) => {
      const next = !prev;
      if (next && ttsEngineRef.current) {
        ttsEngineRef.current.stop();
        setAvatarActivity(0);
        setAuthoritativeAvatarState("LISTENING");
      }
      return next;
    });
  };

  const handleFinishAnswerManually = () => {
    const textToSubmit = (
      liveSpeechRef.current ||
      liveSpeech ||
      (sttEngineRef.current ? sttEngineRef.current.getLatestTranscript() : "")
    ).trim();
    if (textToSubmit) {
      submitAnswer(textToSubmit);
    } else {
      submitAnswer("[Candidate completed answer without verbal transcription]");
    }
  };

  const handleManualTextSubmit = (text: string) => {
    submitAnswer(text);
  };

  if (!selectedRound) {
    return (
      <RouteGuard>
        <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500 mb-2" />
          <p className="text-xs font-medium">Preparing interview room...</p>
        </div>
      </RouteGuard>
    );
  }

  {/* AI MODE: Question generation in progress */}
  if (interviewState === "GENERATING") {
    return (
      <RouteGuard>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md space-y-6">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-surface-100 border border-brand-500/40">
                <Sparkles className="h-7 w-7 text-brand-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-2">Preparing Your Personalized Interview</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Our AI is analyzing your profile and generating interview questions tailored specifically to your skills, experience, and target role.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-brand-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">{aiGenerationStatus || "Generating personalized questions..."}</span>
            </div>
            <div className="space-y-2 text-left">
              {["Analyzing your profile", "Retrieving relevant context", "Generating personalized questions", "Validating question quality"].map((step, idx) => {
                const statusSteps = ["Analyzing your profile...", "Retrieving relevant context...", "Generating personalized questions...", "Validating question quality..."];
                const currentIdx = statusSteps.findIndex((s) => aiGenerationStatus.includes(s.replace("...", "")));
                const isComplete = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <div key={step} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                    isComplete ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" :
                    isCurrent ? "bg-brand-500/10 text-brand-300 border border-brand-500/30" :
                    "bg-surface-100 text-slate-500 border border-slate-800"
                  }`}>
                    {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : isCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </RouteGuard>
    );
  }

  {/* AI MODE: Generation failed — explicit error with retry/demo fallback */}
  if (interviewState === "FAILED" && aiGenerationError) {
    return (
      <RouteGuard>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md space-y-6">
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30">
              <XCircle className="h-7 w-7 text-rose-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-2">Unable to Generate Personalized Interview</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {aiGenerationError}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setAiGenerationError(null);
                  setInterviewState("GENERATING");
                  setAiGenerationStatus("Retrying question generation...");
                  if (directorRef.current) {
                    directorRef.current.initializeAIQuestions((status) => {
                      setAiGenerationStatus(status);
                    }).then(() => {
                      setInterviewState("IDLE");
                      setAiGenerationStatus("");
                    }).catch((err: Error) => {
                      setInterviewState("FAILED");
                      setAiGenerationError(err.message || "Retry failed. Please check your API key.");
                    });
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <ArrowRight className="h-4 w-4" />
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  // EXPLICIT demo fallback — user consciously chose this
                  setAiGenerationError(null);
                  setIsDemoMode(true);
                  setInterviewState("IDLE");

                  // Re-initialize as demo mode
                  const loadedRound = StorageManager.getSelectedRound();
                  const loadedPlan = StorageManager.getResearchPlan();
                  const loadedCandidate = StorageManager.getCandidateProfile();
                  if (loadedRound && loadedPlan) {
                    const isCoreJava = isCoreJavaDomain({
                      targetRole: loadedCandidate.targetRole,
                      skills: loadedCandidate.skills,
                      jobDescription: loadedCandidate.jobDescription,
                      resumeText: loadedCandidate.resumeText,
                    });
                    const queryRole = isCoreJava ? "Core Java" : loadedCandidate.targetRole;
                    const demoResult = getDemoQuestionsForRole(queryRole, DEMO_QUESTION_LIMIT);
                    if (demoResult.roleCovered) {
                      loadedRound.sampleQuestions = demoResult.questions.map((q) => q.question);
                      loadedPlan.questionBank = demoResult.questions.map((q, idx) => ({
                        id: `demo_bank_q_${idx + 1}`,
                        roundCategory: loadedRound.category,
                        category: q.category === "behavioral" ? ("Behavioral" as const) : ("Technical" as const),
                        questionText: q.question,
                        intent: q.keyPoints.join(", "),
                        evaluationCriteria: q.keyPoints,
                        difficulty: "Mid" as const,
                      }));
                    }
                    const aiConfig = StorageManager.getAIConfig();
                    const provider = getLLMProvider(aiConfig);
                    const director = new InterviewDirector(loadedCandidate, loadedPlan, loadedRound, provider, {
                      interviewMode: "demo",
                      maxDurationMinutes: loadedRound.typicalDurationMinutes || INTERVIEW_CONFIG.demo.typicalDurationMinutes,
                      maxQuestions: DEMO_QUESTION_LIMIT,
                      maxFollowUpsPerQuestion: loadedPlan.blueprint?.followUpPolicy?.maxFollowUps ?? 2,
                      blueprint: loadedPlan.blueprint,
                    });
                    directorRef.current = director;
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-slate-300 text-sm font-semibold transition-colors border border-slate-700 shadow-sm"
              >
                <Compass className="h-4 w-4" />
                Continue with Demo Interview
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Demo mode uses curated questions from our question bank. AI mode generates personalized questions using your API key.
            </p>
          </div>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard>
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 flex-1 flex flex-col justify-between">
        {/* Top Bar: Company | Role | Round | Question X/Y | Timer | Demo/Live Badge */}
        <header
        aria-label="Interview Room Header"
        className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3"
      >
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                {candidate.targetCompanies[0] || "Target Company"}
              </h1>
              <span className="text-slate-500">/</span>
              <span className="text-xs font-medium text-slate-300">
                {selectedRound.name}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isDemoMode
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                }`}
              >
                {isDemoMode ? "DEMO MODE" : "LIVE"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {candidate.targetRole} · {candidate.experienceLevel || "Senior"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          {interviewState === "INTRO" ? (
            <button
              type="button"
              onClick={advanceToQuestionOne}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-300 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/40 rounded-lg px-3 py-1.5 transition-colors shadow-sm"
            >
              <Play className="h-3 w-3" />
              <span>Skip Intro → Q1</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-surface-100 border border-slate-800 text-slate-300">
                Round {multiRoundSession ? `${multiRoundSession.currentRoundIndex + 1} of ${multiRoundSession.rounds.length}` : "1 of 1"}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-100 border border-slate-800 text-slate-300">
                Question {directorState?.currentQuestionIndex ?? 1}
                {isDemoMode ? ` / ${DEMO_QUESTION_LIMIT}` : " (Live · 40m)"}
              </span>
            </div>
          )}

          {directorState?.currentFollowUpCount ? (
            <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Follow-Up #{directorState.currentFollowUpCount}
            </span>
          ) : null}
        </div>
      </header>

      {/* Error alert banner */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => handleFinishAnswerManually()}
            className="text-xs font-semibold underline text-rose-200 hover:text-white shrink-0"
          >
            Retry Answer
          </button>
        </div>
      )}

      {/* Subtle Inline Nudge: Mid-way through a demo round (non-modal, does not interrupt flow) */}
      {isDemoMode && !dismissedMidwayBanner && directorState && directorState.currentQuestionIndex >= 2 && (
        <UpgradeBanner
          compact
          onUnlock={openCheckoutModal}
          onDismiss={() => setDismissedMidwayBanner(true)}
        />
      )}

      {/* Remote Interview Split Stage: Candidate Feed (Left) + AI Interviewer Avatar (Right) */}
      <main
        aria-label="Interview Video Stage"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 items-stretch"
      >
        {/* Candidate Feed */}
        <div className="flex flex-col h-full min-h-[260px] sm:min-h-[320px] lg:min-h-[380px]">
          <CandidateVideo
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onToggleVideo={handleToggleVideo}
            audioLevel={interviewState === "LISTENING" ? 50 : 0}
            candidateName="Candidate (You)"
          />
        </div>

        {/* AI Interviewer Avatar Engine */}
        <div className="flex flex-col h-full min-h-[260px] sm:min-h-[320px] lg:min-h-[380px]">
          <InterviewerAvatarEngine
            state={authoritativeAvatarState}
            mode={avatarMode}
            onModeChange={(m) => setAvatarMode(m)}
            interviewerName="Rajat"
            interviewerTitle={`Lead AI Interviewer · ${candidate.targetCompanies[0] || "Interview Committee"}`}
            audioActivityLevel={avatarActivity}
          />
        </div>
      </main>

      {/* Live Prompts & Speech Transcript */}
      <InterviewTranscript
        currentQuestion={currentPrompt}
        liveSpeech={liveSpeech}
        state={interviewState}
        conversationHistory={history}
      />

      {/* Interactive Controls Bar with Keyboard shortcuts & Barge-in */}
      <InterviewControls
        state={interviewState}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isVoiceMuted={isVoiceMuted}
        elapsedSeconds={elapsedSeconds}
        maxDurationMinutes={selectedRound.typicalDurationMinutes || 25}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleVoice={handleToggleVoice}
        onRepeatPrompt={handleRepeatPrompt}
        onFinishAnswer={handleFinishAnswerManually}
        onSubmitManualText={handleManualTextSubmit}
        onEndInterview={handleConcludeAndEvaluate}
        onStopInterviewer={handleStopInterviewer}
      />

      {/* Pre-Round Orientation Modal */}
      {showOrientation && selectedRound && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 text-center space-y-6"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d121d] p-7 shadow-2xl space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-brand-400 font-bold">
                    Round {multiRoundSession ? `${multiRoundSession.currentRoundIndex + 1} of ${multiRoundSession.rounds.length}` : "Orientation"}
                  </span>
                  <h2 className="text-lg font-bold text-white">
                    {selectedRound.name}
                  </h2>
                </div>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-surface-100 text-slate-300 border border-slate-700">
                {researchPlan?.blueprint?.difficultyRange || "Senior"} Level
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-100/60 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Clock className="h-3.5 w-3.5 text-brand-400" />
                  Estimated Duration
                </span>
                <span className="font-semibold text-white">
                  ~{isDemoMode ? (selectedRound.typicalDurationMinutes || INTERVIEW_CONFIG.demo.typicalDurationMinutes) : FULL_INTERVIEW_DURATION_MINUTES} minutes
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-100/60 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  Target Budget
                </span>
                <span className="font-semibold text-white">
                  {isDemoMode ? `${DEMO_QUESTION_LIMIT} questions` : "Full 40m session (Time-based)"}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-300">This Round Evaluates:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(researchPlan?.blueprint?.competencyTopics?.map((t) => t.topic) || selectedRound.focusAreas).slice(0, 4).map((topic, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300 p-2.5 rounded-lg bg-surface-100/40 border border-slate-800/80">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                    <span className="truncate">{topic}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.push("/device-check")}
                className="text-xs text-slate-400 hover:text-slate-200 underline font-medium"
              >
                Re-check Camera & Mic
              </button>

              <button
                type="button"
                onClick={startRoundAfterOrientation}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-6 py-2.5 text-xs font-semibold text-white shadow-xl shadow-brand-500/25 transition-all hover:scale-[1.02]"
              >
                <span>Begin Round</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Round Complete Transition Modal */}
      {interviewState === "ROUND_COMPLETE" && !isLoadingEvaluation && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 text-center space-y-6"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d121d] p-6 sm:p-7 shadow-2xl space-y-5 text-left">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Round Concluded
                </span>
                <h3 className="text-base font-bold text-white">
                  {selectedRound.name} Complete
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {completedRoundReport ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-100/80 border border-slate-800">
                  <span className="text-xs text-slate-400">Round Performance Score:</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {completedRoundReport.overallScore} / 100
                  </span>
                </div>
              ) : null}

              {/* Competencies Explored */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Competencies Explored:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(directorState?.topicsCovered?.length ? directorState.topicsCovered : selectedRound.focusAreas).slice(0, 4).map((topic, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300 p-2 rounded-lg bg-surface-100/40 border border-slate-800/80">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                      <span className="truncate">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Summary: Strengths & Areas to Improve */}
              {completedRoundReport && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Key Strengths
                    </span>
                    <ul className="space-y-1 text-slate-300 text-[11px]">
                      {completedRoundReport.strengths.slice(0, 2).map((s, i) => (
                        <li key={i} className="truncate">• {s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="font-semibold text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Areas to Refine
                    </span>
                    <ul className="space-y-1 text-slate-300 text-[11px]">
                      {completedRoundReport.weaknesses.slice(0, 2).map((w, i) => (
                        <li key={i} className="truncate">• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Next Round or Final Dossier Actions */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              {multiRoundSession &&
              multiRoundSession.simulationMode === "FULL_SIMULATION" &&
              multiRoundSession.currentRoundIndex < multiRoundSession.rounds.length - 1 ? (
                <>
                  <button
                    type="button"
                    onClick={handleConcludeFinalDossier}
                    className="text-xs text-slate-400 hover:text-slate-200 underline font-medium"
                  >
                    End Simulation Early
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedToNextRound}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition-all"
                  >
                    <span>Continue to Round {multiRoundSession.currentRoundIndex + 2}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConcludeFinalDossier}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>View Final Hiring Committee Dossier</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Generating Loading Overlay */}
      {isLoadingEvaluation && (
        <div
          role="status"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 text-center space-y-4"
        >
          <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Synthesizing Hiring Committee Evaluation</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Analyzing technical depth, trade-off reasoning, and calculating deterministic competency matrix...
            </p>
          </div>
        </div>
      )}

      {/* Demo Gating & End-of-Demo Modal */}
      <DemoEndModal
        isOpen={demoModalState.isOpen}
        reason={demoModalState.reason}
        role={demoModalState.role || candidate.targetRole || "Software Engineer"}
        company={demoModalState.company || candidate.targetCompanies[0] || "Target Company"}
        questionsCompleted={demoModalState.questionsCompleted || DEMO_QUESTION_LIMIT}
        onClose={() => setDemoModalState((prev) => ({ ...prev, isOpen: false }))}
        onBringOwnKey={() => {
          setDemoModalState((prev) => ({ ...prev, isOpen: false }));
          router.push("/setup");
        }}
        onContactAuthor={(targetRole, targetCompany) => {
          const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "singh.rajat70880@gmail.com";
          const subject = encodeURIComponent(
            `Kramix API Access Request — ${targetRole || "Software Engineer"} @ ${targetCompany || "Target Company"}`
          );
          const body = encodeURIComponent(
            `Hi, I'd like access to Kramix live mode.\nRole: ${targetRole}\nCompany: ${targetCompany}\n\nI'm ready to conduct full adaptive mock interviews!`
          );
          window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
        }}
      />
      </div>
    </RouteGuard>
  );
}
