"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Mic, MicOff, Volume2, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw, HelpCircle } from "lucide-react";

export function DeviceDiagnostic() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const [cameraStatus, setCameraStatus] = useState<"pending" | "granted" | "denied" | "not_found">("pending");
  const [micStatus, setMicStatus] = useState<"pending" | "granted" | "denied" | "not_found">("pending");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [checking, setChecking] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Device test toggles
  const [previewVideoOff, setPreviewVideoOff] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    // Check browser media support
    if (typeof window !== "undefined") {
      const hasMedia = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (!hasMedia) {
        setErrorMessage("Your browser does not support standard media streams (getUserMedia). Text fallback mode will be enabled.");
        setChecking(false);
      } else {
        requestMediaPermissions();
      }
    }

    return () => {
      isMountedRef.current = false;
      stopStreams();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const requestMediaPermissions = async () => {
    setChecking(true);
    setErrorMessage(null);
    stopStreams();

    let combinedStream: MediaStream = new MediaStream();
    let videoTrackOk = false;
    let audioTrackOk = false;

    // 1. Try acquiring Video Track
    try {
      let videoStream: MediaStream;
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });
      } catch {
        // Fallback to relaxed video: true constraint for browsers that reject specific constraints
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      videoStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
      videoTrackOk = true;
      setCameraStatus("granted");
    } catch (vErr: unknown) {
      const err = vErr as Error;
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraStatus("not_found");
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraStatus("denied");
      } else {
        setCameraStatus("not_found");
      }
    }

    // 2. Try acquiring Audio Track
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
      audioTrackOk = true;
      setMicStatus("granted");

      // Set up volume analyzer
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(audioStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setAudioLevel(level);
          animationFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      }
    } catch (aErr: unknown) {
      const err = aErr as Error;
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setMicStatus("not_found");
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicStatus("denied");
      } else {
        setMicStatus("not_found");
      }
    }

    if (!isMountedRef.current) {
      combinedStream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = combinedStream;

    // Attach video stream if available
    if (videoTrackOk && videoRef.current) {
      videoRef.current.srcObject = combinedStream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.setAttribute("webkit-playsinline", "true");
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }

    if (!videoTrackOk && !audioTrackOk) {
      setErrorMessage("Neither camera nor microphone could be accessed. You can still proceed using our keyboard text-fallback mode.");
    } else if (!videoTrackOk) {
      setErrorMessage("No video camera stream detected. Microphone is active; text avatar fallback will be used for your feed.");
    } else if (!audioTrackOk) {
      setErrorMessage("No microphone detected. Camera is active; you will be prompted to submit responses via keyboard text input.");
    }

    setChecking(false);
  };

  const handleTogglePreviewVideo = () => {
    const next = !previewVideoOff;
    setPreviewVideoOff(next);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
  };

  const handleTogglePreviewMute = () => {
    const next = !previewMuted;
    setPreviewMuted(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
  };

  const handleStartInterview = () => {
    stopStreams();
    router.push("/interview");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-brand-400" />
              Pre-Interview Environment Diagnostic
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Verify your video feed and audio levels before sitting in front of the AI interviewer.
            </p>
          </div>
          <button
            type="button"
            onClick={requestMediaPermissions}
            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 border border-slate-700 bg-slate-800/60 rounded-md px-3 py-1.5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retest Devices</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-100">Hardware Status Notification</p>
              <p className="text-[11px] opacity-90 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Camera Video Mirror */}
          <div className="flex flex-col space-y-2">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-surface-200/90 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover -scale-x-100 ${previewVideoOff ? "hidden" : "block"}`}
              />
              {(cameraStatus !== "granted" || previewVideoOff) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center">
                  <CameraOff className="h-8 w-8 text-slate-500 mb-2" />
                  <span className="text-xs text-slate-300">
                    {checking
                      ? "Probing video stream..."
                      : previewVideoOff
                      ? "Preview video paused"
                      : cameraStatus === "denied"
                      ? "Camera access denied in browser"
                      : "No camera detected on this system"}
                  </span>
                  {cameraStatus === "denied" && (
                    <span className="text-[10px] text-amber-400 mt-1 max-w-[200px]">
                      Click the lock or camera icon in your address bar and set to Allow.
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-slate-400" />
                Video Feed:
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    cameraStatus === "granted"
                      ? "text-emerald-400"
                      : cameraStatus === "denied"
                      ? "text-rose-400"
                      : "text-amber-400"
                  }`}
                >
                  {cameraStatus === "granted" ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Working
                    </>
                  ) : cameraStatus === "denied" ? (
                    "Denied"
                  ) : (
                    "Not Found"
                  )}
                </span>
                {cameraStatus === "granted" && (
                  <button
                    type="button"
                    onClick={handleTogglePreviewVideo}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline font-mono ml-1"
                  >
                    {previewVideoOff ? "Enable" : "Pause"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Audio & Environment Checklist */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              {/* Mic Status & Level Meter */}
              <div className="rounded-lg border border-slate-800 bg-surface-100/70 p-3.5">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-brand-400" />
                    Microphone Input
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold text-[11px] ${
                        micStatus === "granted"
                          ? "text-emerald-400"
                          : micStatus === "denied"
                          ? "text-rose-400"
                          : "text-amber-400"
                      }`}
                    >
                      {micStatus === "granted"
                        ? previewMuted
                          ? "Muted"
                          : "Active"
                        : micStatus === "denied"
                        ? "Denied"
                        : "Not Found"}
                    </span>
                    {micStatus === "granted" && (
                      <button
                        type="button"
                        onClick={handleTogglePreviewMute}
                        className="text-[10px] text-slate-400 hover:text-slate-200 underline font-mono"
                      >
                        {previewMuted ? "Unmute" : "Mute"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Audio Level Meter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Input Volume Activity</span>
                    <span className="font-mono">{previewMuted ? 0 : audioLevel}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        previewMuted
                          ? "bg-slate-700"
                          : audioLevel > 50
                          ? "bg-emerald-400"
                          : audioLevel > 15
                          ? "bg-brand-500"
                          : "bg-slate-600"
                      }`}
                      style={{ width: `${previewMuted ? 4 : Math.max(4, audioLevel)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Speak a few words to confirm microphone pickup and input level.
                  </p>
                </div>
              </div>

              {/* Browser Diagnostics */}
              <div className="rounded-lg border border-slate-800 bg-surface-100/70 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Volume2 className="h-3.5 w-3.5" />
                    Speech Synthesis & Audio API
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Privacy Guarantee
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium">Zero Server Recording</span>
                </div>
              </div>
            </div>

            {/* Privacy Assurance Banner */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3 text-[11px] text-slate-400 leading-relaxed">
              <p>
                <strong className="text-slate-300">Privacy Guarantee:</strong> Kramix strictly processes all camera and microphone video frames locally in your browser. No video recordings are uploaded to remote servers.
              </p>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-5 mt-6">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
            Text fallback mode is always accessible during the interview.
          </span>
          <button
            type="button"
            onClick={handleStartInterview}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-7 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-600/25 transition-all hover:translate-x-0.5"
          >
            <span>Enter Interview Room</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
