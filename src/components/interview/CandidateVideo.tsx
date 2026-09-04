"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Mic, MicOff, User, AlertCircle, RefreshCw } from "lucide-react";

interface CandidateVideoProps {
  isMuted: boolean;
  isVideoOff: boolean;
  audioLevel?: number; // 0-100
  candidateName?: string;
  className?: string;
}

export function CandidateVideo({
  isMuted,
  isVideoOff,
  audioLevel = 0,
  candidateName = "Candidate (You)",
  className = "",
}: CandidateVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraStatus, setCameraStatus] = useState<
    "READY" | "INITIALIZING" | "PAUSED" | "ERROR" | "DISCONNECTED"
  >("INITIALIZING");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stop active media tracks safely
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Initialize or re-attach camera stream
  const setupCamera = useCallback(async () => {
    if (isVideoOff) {
      stopTracks();
      setCameraStatus("PAUSED");
      return;
    }

    setCameraStatus("INITIALIZING");
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }

      // Stop any existing tracks before acquiring new ones
      stopTracks();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false, // Audio managed separately via STT / AudioContext
      });

      streamRef.current = stream;

      // Handle track ended (e.g. webcam unplugged or OS permission revoked)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setCameraStatus("DISCONNECTED");
          setErrorMessage("Camera device disconnected or revoked");
          stopTracks();
        };
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {
          // Autoplay policy or DOM detachment
        });
      }

      setCameraStatus("READY");
    } catch (err) {
      console.warn("Candidate camera setup warning:", err);
      setCameraStatus("ERROR");
      setErrorMessage(
        err instanceof Error ? err.message : "Camera access denied or unavailable"
      );
      stopTracks();
    }
  }, [isVideoOff, stopTracks]);

  // Handle video toggle or initial mount
  useEffect(() => {
    setupCamera();

    // Listen for device changes (plugging/unplugging webcam)
    const handleDeviceChange = () => {
      if (!isVideoOff && cameraStatus !== "READY") {
        setupCamera();
      }
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
      stopTracks();
    };
  }, [isVideoOff, setupCamera, stopTracks, cameraStatus]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full h-full min-h-[380px] rounded-2xl border border-slate-800/90 bg-[#080b12] overflow-hidden shadow-2xl ${className}`}
    >
      {/* Video stream or graceful audio-only fallback */}
      {cameraStatus === "READY" && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover -scale-x-100"
          aria-label="Local candidate camera feed"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
          <div className="h-24 w-24 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-400 shadow-inner">
            <User className="h-12 w-12 text-slate-500" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-200 block">
              {cameraStatus === "PAUSED"
                ? "Camera Paused"
                : cameraStatus === "DISCONNECTED"
                ? "Camera Disconnected"
                : cameraStatus === "ERROR"
                ? "Audio-Only Mode (Camera Unavailable)"
                : "Initializing Camera..."}
            </span>
            <p className="text-[11px] text-slate-500 max-w-xs">
              {cameraStatus === "PAUSED"
                ? "Video feed is muted by candidate. Audio remains active."
                : cameraStatus === "ERROR" || cameraStatus === "DISCONNECTED"
                ? "Your interview will continue seamlessly with audio speech."
                : "Connecting local video hardware..."}
            </p>
          </div>

          {(cameraStatus === "ERROR" || cameraStatus === "DISCONNECTED") && (
            <button
              type="button"
              onClick={setupCamera}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Camera</span>
            </button>
          )}
        </div>
      )}

      {/* Top Left: Candidate Identity Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="rounded-full bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-md">
          {candidateName}
        </div>
      </div>

      {/* Top Right: Status Pills (Mic Level + Camera State) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
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
          aria-label={isVideoOff ? "Video off" : cameraStatus === "READY" ? "Video active" : "Video warning"}
          className="rounded-full bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 p-1 text-slate-300 shadow-md"
        >
          {isVideoOff ? (
            <CameraOff className="h-3.5 w-3.5 text-rose-400" />
          ) : cameraStatus === "READY" ? (
            <Camera className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          )}
        </div>
      </div>

      {/* Bottom Overlay Bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 flex items-center justify-between text-xs text-slate-300">
        <span className="font-mono text-[11px] text-slate-400">
          Candidate Feed {cameraStatus === "READY" && !isVideoOff ? "(Mirrored)" : "(Audio-Only)"}
        </span>
        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
        </span>
      </div>
    </div>
  );
}
