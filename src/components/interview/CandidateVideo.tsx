"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  AlertCircle,
  RefreshCw,
  Video,
  VideoOff,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { useCameraManager } from "@/lib/camera/camera-manager";

interface CandidateVideoProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleVideo?: () => void;
  audioLevel?: number; // 0-100
  candidateName?: string;
  className?: string;
}

export function CandidateVideo({
  isMuted,
  isVideoOff,
  onToggleVideo,
  audioLevel = 0,
  candidateName = "Candidate (You)",
  className = "",
}: CandidateVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [continueWithoutCamera, setContinueWithoutCamera] = useState(false);

  const {
    state: cameraState,
    errorMessage,
    startCamera,
    stopCamera,
    attachToVideo,
  } = useCameraManager({
    videoElementRef: videoRef,
    autoInitialize: !isVideoOff,
  });

  // Keep video track aligned with parent video toggle or continueWithoutCamera
  useEffect(() => {
    if (isVideoOff || continueWithoutCamera) {
      stopCamera();
    } else if (cameraState === "idle") {
      startCamera();
    }
  }, [isVideoOff, continueWithoutCamera, cameraState, startCamera, stopCamera]);

  // Ensure stream stays attached whenever video element mounts or camera becomes ready
  useEffect(() => {
    if (cameraState === "ready" && videoRef.current) {
      attachToVideo(videoRef.current);
    }
  }, [cameraState, attachToVideo]);

  const handleRetry = useCallback(() => {
    setContinueWithoutCamera(false);
    startCamera();
  }, [startCamera]);

  const handleContinueWithout = useCallback(() => {
    setContinueWithoutCamera(true);
    stopCamera();
    if (onToggleVideo && !isVideoOff) {
      onToggleVideo();
    }
  }, [stopCamera, onToggleVideo, isVideoOff]);

  const isCameraLive =
    cameraState === "ready" && !isVideoOff && !continueWithoutCamera;

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full h-full min-h-[380px] rounded-2xl border border-slate-800/90 bg-[#080b12] overflow-hidden shadow-2xl ${className}`}
    >
      {/* Permanent Video Element: Kept mounted in DOM for instant stream attachment */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Local candidate camera feed"
        className={`h-full w-full object-cover -scale-x-100 transition-opacity duration-300 ${
          isCameraLive ? "opacity-100" : "opacity-0 absolute pointer-events-none"
        }`}
      />

      {/* Fallback States & Permission Handling UI */}
      {!isCameraLive && (
        <div className="flex flex-col items-center justify-center text-center p-6 text-slate-300 space-y-4 max-w-sm z-10">
          {/* Avatar representation for candidate feed */}
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-slate-300 shadow-xl overflow-hidden">
              {/* Modern candidate avatar fallback representation */}
              <svg viewBox="0 0 100 100" className="h-full w-full fill-slate-400">
                <circle cx="50" cy="38" r="20" fill="#475569" />
                <path d="M 20 90 C 20 65, 35 60, 50 60 C 65 60, 80 65, 80 90 Z" fill="#334155" />
              </svg>
            </div>
            {/* Status indicator badge on avatar */}
            <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-slate-950 border border-slate-700 shadow-md">
              {cameraState === "initializing" || cameraState === "requesting_permission" ? (
                <Loader2 className="h-4 w-4 text-brand-400 animate-spin" />
              ) : cameraState === "permission_denied" || cameraState === "permission_blocked" ? (
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              ) : (
                <VideoOff className="h-4 w-4 text-amber-400" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-slate-100">
              {continueWithoutCamera || isVideoOff
                ? "Audio-Only Mode (Camera Off)"
                : cameraState === "requesting_permission"
                ? "Requesting Camera Access..."
                : cameraState === "initializing"
                ? "Connecting Camera Hardware..."
                : cameraState === "permission_denied"
                ? "Camera Access Denied"
                : cameraState === "permission_blocked"
                ? "Camera Access Blocked in Browser"
                : cameraState === "not_found"
                ? "No Camera Detected"
                : cameraState === "timeout"
                ? "Camera Initializing Timed Out"
                : "Camera Unavailable"}
            </h4>

            <p className="text-xs text-slate-400 leading-relaxed">
              {continueWithoutCamera || isVideoOff
                ? "Your interview continues smoothly using your microphone and voice speech."
                : cameraState === "permission_blocked"
                ? "Camera access is blocked in your browser. Please enable camera permission in your browser settings and try again."
                : cameraState === "permission_denied"
                ? "Camera access is required for video, but you can continue the interview in audio-only mode."
                : cameraState === "timeout" || cameraState === "initialization_failed"
                ? "Camera couldn't be initialized on this device. You can retry or continue in audio mode."
                : errorMessage || "Connecting to candidate video stream..."}
            </p>
          </div>

          {/* Action Buttons: Allow Camera / Retry / Continue Without Camera */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {cameraState === "requesting_permission" && (
              <button
                type="button"
                onClick={handleContinueWithout}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Continue Without Camera
              </button>
            )}

            {(cameraState === "permission_denied" ||
              cameraState === "permission_blocked" ||
              cameraState === "initialization_failed" ||
              cameraState === "timeout" ||
              cameraState === "not_found") && (
              <>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry Camera</span>
                </button>
                <button
                  type="button"
                  onClick={handleContinueWithout}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  Continue Without Camera
                </button>
              </>
            )}

            {(continueWithoutCamera || isVideoOff) && (
              <button
                type="button"
                onClick={() => {
                  setContinueWithoutCamera(false);
                  if (onToggleVideo && isVideoOff) {
                    onToggleVideo();
                  } else {
                    startCamera();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Video className="h-3.5 w-3.5 text-brand-400" />
                <span>Enable Camera</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Left: Candidate Identity Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="rounded-full bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-md">
          {candidateName}
        </div>
      </div>

      {/* Top Right: Status Pills (Mic Level + Camera State) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
        {/* Dynamic Mic Level Pill */}
        <div
          role="status"
          aria-label={isMuted ? "Microphone muted" : `Microphone active at level ${audioLevel}%`}
          className="flex items-center gap-1.5 rounded-full bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 px-2.5 py-1 text-[11px] text-slate-300 shadow-md"
        >
          {isMuted ? (
            <MicOff className="h-3 w-3 text-rose-400" />
          ) : (
            <>
              <Mic className="h-3 w-3 text-emerald-400" />
              <div className="h-1.5 w-10 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(8, audioLevel))}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Video state indicator */}
        <div
          role="status"
          aria-label={isVideoOff ? "Video off" : isCameraLive ? "Video active" : "Video warning"}
          className="rounded-full bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 p-1 text-slate-300 shadow-md"
        >
          {isVideoOff || continueWithoutCamera ? (
            <CameraOff className="h-3.5 w-3.5 text-rose-400" />
          ) : isCameraLive ? (
            <Camera className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          )}
        </div>
      </div>

      {/* Bottom Overlay Bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 flex items-center justify-between text-xs text-slate-300 z-20">
        <span className="font-mono text-[11px] text-slate-400">
          Candidate Feed {isCameraLive ? "(Mirrored)" : "(Audio-Only Mode)"}
        </span>
        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
        </span>
      </div>
    </div>
  );
}

