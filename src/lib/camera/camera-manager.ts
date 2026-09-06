"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type CameraLifecycleState =
  | "idle"
  | "requesting_permission"
  | "initializing"
  | "ready"
  | "permission_denied"
  | "permission_blocked"
  | "initialization_failed"
  | "not_found"
  | "timeout";

export interface UseCameraManagerOptions {
  videoElementRef?: React.RefObject<HTMLVideoElement | null>;
  onStateChange?: (state: CameraLifecycleState) => void;
  autoInitialize?: boolean;
}

export interface CameraManagerReturn {
  state: CameraLifecycleState;
  errorMessage: string | null;
  stream: MediaStream | null;
  retryAttempt: number;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  attachToVideo: (videoEl: HTMLVideoElement | null) => Promise<boolean>;
}

export function useCameraManager(options: UseCameraManagerOptions = {}): CameraManagerReturn {
  const { videoElementRef, onStateChange, autoInitialize = true } = options;

  const [state, setState] = useState<CameraLifecycleState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);

  const streamRef = useRef<MediaStream | null>(null);
  const isAcquiringRef = useRef<boolean>(false);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const targetVideoRef = useRef<HTMLVideoElement | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const updateState = useCallback(
    (newState: CameraLifecycleState, msg: string | null = null) => {
      if (!isMountedRef.current) return;
      setState(newState);
      setErrorMessage(msg);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    clearWatchdog();
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
    setStream(null);

    const videoEl = targetVideoRef.current || videoElementRef?.current;
    if (videoEl) {
      try {
        videoEl.srcObject = null;
      } catch {
        // Ignore detachment errors
      }
    }

    isAcquiringRef.current = false;
  }, [clearWatchdog, videoElementRef]);

  const attachToVideo = useCallback(
    async (videoEl: HTMLVideoElement | null): Promise<boolean> => {
      if (!videoEl) return false;
      targetVideoRef.current = videoEl;

      const activeStream = streamRef.current;
      if (!activeStream) return false;

      try {
        videoEl.srcObject = activeStream;
        // Mobile browsers require playsInline and muted for local video preview
        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.muted = true;

        await videoEl.play().catch((playErr) => {
          // Playback might be blocked if user interaction is needed on mobile
          console.warn("Camera video.play notice:", playErr);
        });
        return true;
      } catch (err) {
        console.warn("Camera attachment notice:", err);
        return false;
      }
    },
    []
  );

  const startCamera = useCallback(async (): Promise<boolean> => {
    // Prevent multiple concurrent getUserMedia() calls
    if (isAcquiringRef.current) {
      return false;
    }
    isAcquiringRef.current = true;

    // Check environment support
    if (typeof window === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      isAcquiringRef.current = false;
      updateState(
        "initialization_failed",
        "Camera API (getUserMedia) is not supported in this browser."
      );
      return false;
    }

    // Stop existing tracks safely before re-requesting
    stopCamera();

    updateState("requesting_permission");

    // 8-second watchdog to prevent freezing in 'requesting_permission' or 'initializing'
    clearWatchdog();
    watchdogTimerRef.current = setTimeout(() => {
      if (isAcquiringRef.current) {
        console.warn("Camera acquisition timed out after 8s");
        isAcquiringRef.current = false;
        stopCamera();
        updateState("timeout", "Camera initialization timed out. Please retry or continue in avatar mode.");
      }
    }, 8000);

    let acquiredStream: MediaStream | null = null;
    let attempt = 1;

    // Attempt 1: Optimal constraints with user facing mode
    const optimalConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
      audio: false,
    };

    try {
      acquiredStream = await navigator.mediaDevices.getUserMedia(optimalConstraints);
    } catch (firstErr: unknown) {
      const err = firstErr as { name?: string; message?: string };
      console.warn("Optimal camera constraint acquisition notice:", err?.name, err?.message);

      // Handle explicit permission denials immediately without retry
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        clearWatchdog();
        isAcquiringRef.current = false;

        // Check if permissions query reports permanently blocked
        let isBlocked = false;
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
            if (perm.state === "denied") {
              isBlocked = true;
            }
          }
        } catch {
          // Permissions query not supported for camera on some browsers
        }

        if (isBlocked) {
          updateState(
            "permission_blocked",
            "Camera access is blocked in your browser settings. Please allow camera access and reload."
          );
        } else {
          updateState(
            "permission_denied",
            "Camera permission was denied. You can enable camera or continue in audio-only mode."
          );
        }
        return false;
      }

      if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        clearWatchdog();
        isAcquiringRef.current = false;
        updateState("not_found", "No video input devices found on this device.");
        return false;
      }

      // Attempt 2: Relaxed fallback constraint ({ video: true })
      attempt = 2;
      setRetryAttempt(2);
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (secondErr: unknown) {
        clearWatchdog();
        isAcquiringRef.current = false;
        const err2 = secondErr as { name?: string; message?: string };
        console.warn("Fallback camera acquisition notice:", err2?.name, err2?.message);

        if (err2?.name === "NotAllowedError" || err2?.name === "PermissionDeniedError") {
          updateState("permission_denied", "Camera permission denied.");
        } else if (err2?.name === "NotFoundError" || err2?.name === "DevicesNotFoundError") {
          updateState("not_found", "No video camera detected.");
        } else if (err2?.name === "NotReadableError") {
          updateState("initialization_failed", "Camera is already in use by another application.");
        } else {
          updateState("initialization_failed", "Camera couldn't be initialized on this device.");
        }
        return false;
      }
    }

    clearWatchdog();
    isAcquiringRef.current = false;

    if (!isMountedRef.current || !acquiredStream) {
      acquiredStream?.getTracks().forEach((t) => t.stop());
      return false;
    }

    updateState("initializing");
    streamRef.current = acquiredStream;
    setStream(acquiredStream);
    setRetryAttempt(attempt);

    // Watch for device disconnect
    const videoTrack = acquiredStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        console.warn("Camera track ended unexpectedly (disconnected or revoked)");
        stopCamera();
        updateState("initialization_failed", "Camera device disconnected or revoked.");
      };
    }

    // Attach stream to video element
    const videoEl = targetVideoRef.current || videoElementRef?.current;
    if (videoEl) {
      await attachToVideo(videoEl);
    }

    updateState("ready");
    return true;
  }, [clearWatchdog, stopCamera, updateState, attachToVideo, videoElementRef]);

  // Initial lifecycle effect
  useEffect(() => {
    isMountedRef.current = true;

    if (autoInitialize) {
      startCamera();
    }

    // Handle device changes (plugging / unplugging camera)
    const handleDeviceChange = () => {
      if (isMountedRef.current && state !== "ready" && !isAcquiringRef.current) {
        startCamera();
      }
    };

    if (typeof window !== "undefined" && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }

    return () => {
      isMountedRef.current = false;
      clearWatchdog();
      if (typeof window !== "undefined" && navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    errorMessage,
    stream,
    retryAttempt,
    startCamera,
    stopCamera,
    attachToVideo,
  };
}
