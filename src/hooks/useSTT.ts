import { useState, useEffect, useRef, useCallback } from "react";

export interface UseSTTOptions {
  language?: string;
  continuous?: boolean;
  onTranscriptChange?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useSTT(options: UseSTTOptions = {}) {
  const { language = "en-US", continuous = true, onTranscriptChange, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);

  const onTranscriptChangeRef = useRef(onTranscriptChange);
  onTranscriptChangeRef.current = onTranscriptChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        let finalChunk = "";
        let interimChunk = "";
        let bestConfidence = 0.90;

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalChunk += item[0].transcript + " ";
          } else {
            interimChunk += item[0].transcript;
          }
          if (item[0].confidence) {
            bestConfidence = item[0].confidence;
          }
        }

        const combined = (finalChunk + interimChunk).trim();
        setTranscript(combined);
        setConfidence(bestConfidence);
        onTranscriptChangeRef.current?.(combined, true);
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setPermissionDenied(true);
          shouldListenRef.current = false;
          setIsListening(false);
        } else if (event.error === "no-speech") {
          // Normal silence, don't abort unless user stopped
        } else {
          onErrorRef.current?.(event.error);
        }
      };

      recognition.onend = () => {
        // If user still wants listening and wasn't denied permission, auto-restart
        if (shouldListenRef.current && !permissionDenied) {
          try {
            recognition.start();
            setIsListening(true);
            return;
          } catch (_) {}
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      setIsSupported(false);
    }

    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [language, continuous, permissionDenied]);

  const startListening = useCallback(() => {
    shouldListenRef.current = true;
    if (!recognitionRef.current) return;
    try {
      setTranscript("");
      setConfidence(null);
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      // If already started, ignore error
      setIsListening(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.warn("Could not stop speech recognition:", err);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setConfidence(null);
  }, []);

  const resetSession = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    setTranscript("");
    setConfidence(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
  }, []);

  return {
    isListening,
    transcript,
    confidence,
    isSupported,
    permissionDenied,
    startListening,
    stopListening,
    resetTranscript,
    resetSession,
  };
}
