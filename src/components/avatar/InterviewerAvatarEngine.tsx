"use client";

import React, { useEffect, useState, useId, useRef } from "react";
import {
  AuthoritativeAvatarState,
  AvatarMode,
} from "@/types/avatar";
import {
  Mic,
  Volume2,
  Sparkles,
  CheckCircle,
  Square,
  Layers,
  Sparkle,
} from "lucide-react";

interface InterviewerAvatarEngineProps {
  state: AuthoritativeAvatarState;
  mode?: AvatarMode;
  interviewerName?: string;
  interviewerTitle?: string;
  avatarImageUrl?: string | null;
  assetUrl?: string | null;
  audioActivityLevel?: number; // 0 to 100
  onModeChange?: (mode: AvatarMode) => void;
  className?: string;
}

export function InterviewerAvatarEngine({
  state,
  mode = "PHOTOREALISTIC",
  interviewerName = "Rajat",
  interviewerTitle = "Lead AI Interviewer · Kramix.ai",
  avatarImageUrl = null,
  assetUrl = "/avatar.png",
  audioActivityLevel = 0,
  onModeChange,
  className = "",
}: InterviewerAvatarEngineProps) {
  // SVG gradient unique IDs
  const rawId = useId();
  const idPrefix = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  // Natural speech articulation state
  const [mouthOpenPhase, setMouthOpenPhase] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [activeMode, setActiveMode] = useState<AvatarMode>("PHOTOREALISTIC");

  // Natural human blink cycle (every ~3.8 seconds for 140ms)
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 140);
    }, 3800);

    return () => clearInterval(blinkInterval);
  }, []);

  // Multi-frame natural mouth articulation during authoritative SPEAKING state
  useEffect(() => {
    if (state !== "SPEAKING") {
      setMouthOpenPhase(0);
      return;
    }

    const mouthInterval = setInterval(() => {
      // 4 natural mouth vowel/consonant shapes
      setMouthOpenPhase((prev) => (prev + 1) % 4);
    }, 130);

    return () => clearInterval(mouthInterval);
  }, [state]);

  // Natural human interviewer comprehension nod cycle during LISTENING state
  const [isNodding, setIsNodding] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(
    assetUrl || avatarImageUrl || "/avatar.png"
  );
  // Seamless Photorealistic Video Assets (Google Flow / AI Generated)
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const speakingVideoRef = useRef<HTMLVideoElement>(null);
  const [idleVideoLoaded, setIdleVideoLoaded] = useState(false);
  const [speakingVideoLoaded, setSpeakingVideoLoaded] = useState(false);
  const isVideoActive = idleVideoLoaded || speakingVideoLoaded;

  // Coordinate seamless video playback based on authoritative state
  useEffect(() => {
    if (state === "SPEAKING") {
      if (speakingVideoRef.current) {
        speakingVideoRef.current.currentTime = 0;
        speakingVideoRef.current.play().catch(() => {});
      }
    } else {
      if (idleVideoRef.current) {
        idleVideoRef.current.play().catch(() => {});
      }
    }
  }, [state]);

  // Initial auto-start for seamless looping
  useEffect(() => {
    if (idleVideoRef.current) {
      idleVideoRef.current.play().catch(() => {});
    }
    if (speakingVideoRef.current) {
      speakingVideoRef.current.play().catch(() => {});
    }
  }, []);

  const [speechCadenceStep, setSpeechCadenceStep] = useState(0);

  // Sync prop changes
  useEffect(() => {
    const nextUrl = assetUrl || avatarImageUrl || "/avatar.png";
    setCurrentImageSrc(nextUrl);
    setImageLoadError(false);
  }, [assetUrl, avatarImageUrl]);

  // Comprehension nodding while candidate answers
  useEffect(() => {
    if (state !== "LISTENING") {
      setIsNodding(false);
      return;
    }

    const nodInterval = setInterval(() => {
      setIsNodding(true);
      setTimeout(() => {
        setIsNodding(false);
      }, 950);
    }, 5400);

    return () => clearInterval(nodInterval);
  }, [state]);

  // Speaking micro-gesture cadence
  useEffect(() => {
    if (state !== "SPEAKING") {
      setSpeechCadenceStep(0);
      return;
    }

    const interval = setInterval(() => {
      setSpeechCadenceStep((prev) => (prev + 1) % 6);
    }, 180);

    return () => clearInterval(interval);
  }, [state]);

  const cadenceOffsets = [
    { y: 0, r: 0 },
    { y: -1.2, r: 0.4 },
    { y: 1.0, r: -0.3 },
    { y: -0.6, r: -0.5 },
    { y: 0.8, r: 0.4 },
    { y: 0, r: 0 },
  ];
  const speakingYOffset = state === "SPEAKING" ? cadenceOffsets[speechCadenceStep].y : 0;
  const speakingRotate = state === "SPEAKING" ? cadenceOffsets[speechCadenceStep].r : 0;

  const handleImageError = () => {
    // Gracefully fallback to alternative path before showing emergency SVG
    if (currentImageSrc === "/avatar.png") {
      setCurrentImageSrc("/avatars/interviewer.png");
    } else if (currentImageSrc === "/avatars/interviewer.png") {
      setCurrentImageSrc("/avatars/avatar.png");
    } else {
      setImageLoadError(true);
    }
  };

  const getStateBadge = () => {
    switch (state) {
      case "SPEAKING":
        return (
          <div
            role="status"
            aria-label="Interviewer is speaking"
            className="flex items-center gap-1.5 rounded-full bg-brand-500/20 border border-brand-500/40 px-3 py-1 text-[11px] font-medium text-brand-300 shadow-md backdrop-blur-sm"
          >
            <Volume2 className="h-3.5 w-3.5 animate-pulse text-brand-400" />
            <span>Speaking...</span>
          </div>
        );
      case "LISTENING":
        return (
          <div
            role="status"
            aria-label="Interviewer is listening attentively"
            className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-[11px] font-medium text-emerald-300 shadow-md backdrop-blur-sm"
          >
            <Mic className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
            <span>Listening attentively</span>
          </div>
        );
      case "THINKING":
        return (
          <div
            role="status"
            aria-label="Interviewer is analyzing your response"
            className="flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-[11px] font-medium text-amber-300 shadow-md backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>Analyzing response...</span>
          </div>
        );
      case "INTERRUPTED":
        return (
          <div
            role="status"
            aria-label="Interviewer paused for candidate"
            className="flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1 text-[11px] font-medium text-rose-300 shadow-md backdrop-blur-sm"
          >
            <Square className="h-3 w-3 fill-current text-rose-400" />
            <span>Interrupted · Floor ceded</span>
          </div>
        );
      case "TRANSITIONING":
        return (
          <div
            role="status"
            aria-label="Transitioning round state"
            className="flex items-center gap-1.5 rounded-full bg-violet-500/20 border border-violet-500/40 px-3 py-1 text-[11px] font-medium text-violet-300 shadow-md backdrop-blur-sm"
          >
            <Sparkle className="h-3 w-3 text-violet-400" />
            <span>Transitioning...</span>
          </div>
        );
      case "IDLE":
      default:
        return (
          <div
            role="status"
            aria-label="Interviewer ready"
            className="flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-400 shadow-md backdrop-blur-sm"
          >
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            <span>Ready</span>
          </div>
        );
    }
  };

  // Compute mouth open vertical scale based on phase & audio activity
  const getMouthHeight = () => {
    if (state !== "SPEAKING") return 2;
    const base = [3, 7, 11, 6][mouthOpenPhase];
    const audioBoost = audioActivityLevel ? Math.min(6, (audioActivityLevel / 100) * 6) : 2;
    return base + audioBoost;
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-between w-full h-full min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#0e1422] via-[#0b0f19] to-[#080a11] p-4 sm:p-5 overflow-hidden shadow-2xl ${className}`}
    >
      {/* Background Ambience & Lighting Glow */}
      <div
        className={`absolute -top-16 -right-16 h-72 w-72 rounded-full blur-3xl pointer-events-none transition-all duration-1000 ${
          state === "SPEAKING"
            ? "bg-brand-500/20 scale-125"
            : state === "THINKING"
            ? "bg-amber-500/15 scale-110"
            : state === "LISTENING"
            ? "bg-emerald-500/15 scale-100"
            : state === "INTERRUPTED"
            ? "bg-rose-500/20 scale-115"
            : "bg-slate-800/10 scale-90"
        }`}
      />

      {/* Top Header: Authoritative State Pill + Interviewer Mode Indicator */}
      <div className="w-full flex items-center justify-between z-10">
        <div>{getStateBadge()}</div>

        <div className="flex items-center gap-2">
          <div
            title="Custom Interviewer Persona Active"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 backdrop-blur px-2.5 py-1 text-[10px] font-mono text-slate-300"
          >
            <Sparkles className="h-3 w-3 text-brand-400" />
            <span className="uppercase tracking-wider">AI Host</span>
          </div>
        </div>
      </div>

      {/* Main Avatar Display Stage with Gentle Breathing & Subtle Motion */}
      <div className="relative flex flex-col items-center justify-center my-auto w-full">
        {/* Pulsing Aura Rings when Interviewer is Speaking */}
        {state === "SPEAKING" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded-full border border-brand-500/30 animate-ping opacity-60"
              style={{
                width: `${210 + (audioActivityLevel * 0.4)}px`,
                height: `${210 + (audioActivityLevel * 0.4)}px`,
                animationDuration: "1.8s",
              }}
            />
            <div
              className="rounded-full border border-brand-400/20 animate-pulse"
              style={{
                width: `${240 + (audioActivityLevel * 0.5)}px`,
                height: `${240 + (audioActivityLevel * 0.5)}px`,
              }}
            />
          </div>
        )}

        {/* Central Circular Avatar Canvas / Viewport */}
        <div
          className={`relative h-40 w-40 sm:h-52 sm:w-52 lg:h-56 lg:w-56 rounded-full border-2 overflow-hidden bg-slate-950 shadow-2xl transition-all duration-500 ${
            state === "SPEAKING"
              ? "border-brand-500 shadow-brand-500/25 scale-[1.03]"
              : state === "LISTENING"
              ? "border-emerald-500/70 shadow-emerald-500/15 scale-100"
              : state === "THINKING"
              ? "border-amber-500/70 shadow-amber-500/15 scale-[1.01]"
              : state === "INTERRUPTED"
              ? "border-rose-500/70 shadow-rose-500/15 scale-95"
              : "border-slate-700/80"
          }`}
          style={{
            // When photorealistic video is active, let the video render authentic human motion.
            // When fallback static portrait is active, apply organic breathing / bobbing.
            animation: isVideoActive
              ? "none"
              : state === "SPEAKING"
              ? "avatarSpeechBob 1.2s ease-in-out infinite"
              : state === "LISTENING"
              ? isNodding
                ? "avatarListeningNod 0.9s ease-in-out"
                : "avatarBreathe 4.5s ease-in-out infinite"
              : state === "THINKING"
              ? "avatarThinkingSway 3.5s ease-in-out infinite"
              : "avatarBreathe 4.5s ease-in-out infinite",
          }}
        >
          {/* PRIMARY RENDER MODE: PHOTOREALISTIC RAJAT AVATAR (Google Flow Dual Video + Image Fallback) */}
          {!imageLoadError ? (
            <div
              className="relative h-full w-full overflow-hidden"
              style={{
                transform: isVideoActive
                  ? "none"
                  : state === "LISTENING"
                  ? isNodding
                    ? "translateY(2.5px) scale(1.02) rotate(0.5deg)"
                    : "translateY(-1px) scale(1.015) rotate(0.6deg)"
                  : state === "THINKING"
                  ? "translateY(-1px) scale(1.01) rotate(-1.2deg)"
                  : state === "SPEAKING"
                  ? `translateY(${speakingYOffset}px) scale(${1.01 + (audioActivityLevel / 100) * 0.02}) rotate(${speakingRotate}deg)`
                  : "translateY(0) scale(1)",
                transition: isNodding ? "transform 0.45s ease-in-out" : "transform 0.2s ease-out",
              }}
            >
              {/* Base Layer: High-Resolution Interviewer Portrait Asset (Immediate backdrop & fallback) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImageSrc}
                alt={interviewerName}
                loading="eager"
                onError={handleImageError}
                className="h-full w-full object-cover select-none pointer-events-none"
              />

              {/* Photorealistic Video Layer 1: Idle / Listening Loop */}
              <video
                ref={idleVideoRef}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onCanPlay={() => setIdleVideoLoaded(true)}
                onLoadedData={() => setIdleVideoLoaded(true)}
                onError={() => setIdleVideoLoaded(false)}
                className={`absolute inset-0 h-full w-full object-cover pointer-events-none transition-opacity duration-500 ${
                  idleVideoLoaded && state !== "SPEAKING" ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                <source src="/avatar/idle.mp4" type="video/mp4" />
                <source src="/idle.mp4" type="video/mp4" />
              </video>

              {/* Photorealistic Video Layer 2: Speaking Speech Loop */}
              <video
                ref={speakingVideoRef}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onCanPlay={() => setSpeakingVideoLoaded(true)}
                onLoadedData={() => setSpeakingVideoLoaded(true)}
                onError={() => setSpeakingVideoLoaded(false)}
                className={`absolute inset-0 h-full w-full object-cover pointer-events-none transition-opacity duration-300 ${
                  speakingVideoLoaded && state === "SPEAKING" ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                <source src="/avatar/speaking.mp4" type="video/mp4" />
                <source src="/speaking.mp4" type="video/mp4" />
              </video>

              {/* Studio Lighting Vignette & Depth Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#080b12]/40 via-transparent to-black/20 pointer-events-none z-15" />

              {/* Candidate Speech Active Reception Badge during LISTENING */}
              {state === "LISTENING" && (
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1 pointer-events-none z-20">
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/75 border border-emerald-500/40 backdrop-blur-xs shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[9px] font-mono text-emerald-300 font-medium tracking-wide">
                      Listening to you
                    </span>
                  </div>
                </div>
              )}

              {/* Neural Analyzing Ring during THINKING */}
              {state === "THINKING" && (
                <div
                  className="absolute inset-0 border-2 border-amber-400/40 rounded-full animate-spin pointer-events-none"
                  style={{ animationDuration: "7s" }}
                />
              )}
            </div>
          ) : (
            /* EMERGENCY FALLBACK ONLY: High-depth studio vector portrait if image asset fails to load */
            <svg
              viewBox="0 0 200 200"
              className="h-full w-full select-none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`${idPrefix}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#131c31" />
                  <stop offset="60%" stopColor="#0a1020" />
                  <stop offset="100%" stopColor="#04060d" />
                </linearGradient>
                <linearGradient id={`${idPrefix}-skin`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#d5a58a" />
                  <stop offset="50%" stopColor="#c38d6f" />
                  <stop offset="100%" stopColor="#aa7455" />
                </linearGradient>
                <linearGradient id={`${idPrefix}-hair`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2c3038" />
                  <stop offset="70%" stopColor="#1a1c22" />
                  <stop offset="100%" stopColor="#0f1115" />
                </linearGradient>
                <linearGradient id={`${idPrefix}-suit`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id={`${idPrefix}-shirt`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
              </defs>

              {/* Background gradient */}
              <rect width="200" height="200" fill={`url(#${idPrefix}-bg)`} />

              {/* Ambient lighting bokeh in background */}
              <circle cx="160" cy="40" r="30" fill="#3b82f6" opacity="0.12" />
              <circle cx="30" cy="140" r="40" fill="#6366f1" opacity="0.08" />

              {/* Shoulders & Business Attire */}
              <path
                d="M 25 200 C 28 155, 65 145, 100 145 C 135 145, 172 155, 175 200 Z"
                fill={`url(#${idPrefix}-suit)`}
              />
              {/* Shirt collar & V-neck */}
              <polygon points="90,145 110,145 100,168" fill={`url(#${idPrefix}-shirt)`} />
              <line x1="100" y1="145" x2="100" y2="185" stroke="#94a3b8" strokeWidth="1" />

              {/* Lapels */}
              <path
                d="M 65 145 L 88 175 L 85 200"
                stroke="#334155"
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d="M 135 145 L 112 175 L 115 200"
                stroke="#334155"
                strokeWidth="2.5"
                fill="none"
              />

              {/* Neck */}
              <rect
                x="88"
                y="120"
                width="24"
                height="30"
                rx="6"
                fill="#9e694b"
                opacity="0.9"
              />

              {/* Natural Head & Face */}
              <g
                style={{
                  transformOrigin: "100px 85px",
                  // Subtle head tilt when listening or thinking
                  transform:
                    state === "LISTENING"
                      ? "rotate(1.5deg)"
                      : state === "THINKING"
                      ? "rotate(-1.5deg)"
                      : "none",
                  transition: "transform 0.5s ease-out",
                }}
              >
                {/* Head Base */}
                <ellipse cx="100" cy="88" rx="38" ry="46" fill={`url(#${idPrefix}-skin)`} />

                {/* Ears */}
                <ellipse cx="61" cy="90" rx="6" ry="11" fill="#b47d5e" />
                <ellipse cx="139" cy="90" rx="6" ry="11" fill="#b47d5e" />

                {/* Professional Styled Hair */}
                <path
                  d="M 61 75 C 60 40, 80 34, 100 34 C 122 34, 140 40, 139 75 C 130 65, 115 62, 100 62 C 85 62, 70 65, 61 75 Z"
                  fill={`url(#${idPrefix}-hair)`}
                />
                {/* Hair sideburns */}
                <path d="M 62 72 L 64 92 L 68 85 Z" fill={`url(#${idPrefix}-hair)`} />
                <path d="M 138 72 L 136 92 L 132 85 Z" fill={`url(#${idPrefix}-hair)`} />

                {/* Eyebrows */}
                <path
                  d="M 75 75 Q 85 71 93 74"
                  stroke="#262930"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 107 74 Q 115 71 125 75"
                  stroke="#262930"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Eyes (With natural blink animation) */}
                {isBlinking ? (
                  <>
                    <line x1="77" y1="83" x2="91" y2="83" stroke="#262930" strokeWidth="2" />
                    <line x1="109" y1="83" x2="123" y2="83" stroke="#262930" strokeWidth="2" />
                  </>
                ) : (
                  <>
                    {/* Left Eye */}
                    <ellipse cx="84" cy="83" rx="6" ry="4" fill="#ffffff" />
                    <circle
                      cx={state === "LISTENING" ? "84" : state === "THINKING" ? "83" : "84"}
                      cy="83"
                      r="2.8"
                      fill="#1e293b"
                    />
                    <circle cx="85" cy="82" r="1" fill="#ffffff" />

                    {/* Right Eye */}
                    <ellipse cx="116" cy="83" rx="6" ry="4" fill="#ffffff" />
                    <circle
                      cx={state === "LISTENING" ? "116" : state === "THINKING" ? "115" : "116"}
                      cy="83"
                      r="2.8"
                      fill="#1e293b"
                    />
                    <circle cx="117" cy="82" r="1" fill="#ffffff" />
                  </>
                )}

                {/* Modern Titanium Eyeglass Frame */}
                <rect
                  x="72"
                  y="74"
                  width="24"
                  height="17"
                  rx="4"
                  stroke="#475569"
                  strokeWidth="1.8"
                  fill="none"
                />
                <rect
                  x="104"
                  y="74"
                  width="24"
                  height="17"
                  rx="4"
                  stroke="#475569"
                  strokeWidth="1.8"
                  fill="none"
                />
                {/* Bridge */}
                <line x1="96" y1="81" x2="104" y2="81" stroke="#475569" strokeWidth="1.8" />
                {/* Subtle Lens Glare */}
                <line
                  x1="76"
                  y1="76"
                  x2="84"
                  y2="76"
                  stroke="#ffffff"
                  strokeWidth="1"
                  opacity="0.6"
                />

                {/* Nose */}
                <path
                  d="M 100 81 L 98 98 L 103 98"
                  stroke="#9e694b"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Articulated Dynamic Mouth */}
                {state === "SPEAKING" ? (
                  <ellipse
                    cx="100"
                    cy="112"
                    rx="9"
                    ry={getMouthHeight() / 2}
                    fill="#1e1b18"
                    stroke="#8c583e"
                    strokeWidth="1"
                  />
                ) : (
                  /* Calm resting smile/closed line */
                  <path
                    d="M 92 112 Q 100 115 108 112"
                    stroke="#8c583e"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </g>
            </svg>
          )}
        </div>

        {/* Audio Reactive Equalizer Waveform Bars */}
        <div
          role="presentation"
          className="flex items-center justify-center gap-1 mt-3.5 h-6"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
            const isSpeaking = state === "SPEAKING";
            const height = isSpeaking
              ? Math.sin(bar * 0.7 + (audioActivityLevel || 10)) * 10 + 13
              : state === "LISTENING"
              ? 5
              : 3;

            return (
              <span
                key={bar}
                className={`w-1 rounded-full transition-all duration-100 ${
                  isSpeaking
                    ? "bg-brand-400"
                    : state === "LISTENING"
                    ? "bg-emerald-400/60"
                    : state === "THINKING"
                    ? "bg-amber-400/50"
                    : "bg-slate-700/60"
                }`}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Interviewer Identity Bar */}
      <div className="text-center pt-3 border-t border-slate-800/80 w-full z-10">
        <div className="flex items-center justify-center gap-1.5">
          <h3 className="text-sm font-bold text-slate-100 tracking-wide">
            {interviewerName}
          </h3>
          <span title="Verified AI Interviewer">
            <CheckCircle className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{interviewerTitle}</p>
      </div>
    </div>
  );
}
