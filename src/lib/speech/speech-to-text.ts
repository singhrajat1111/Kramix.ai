export interface STTCallbacks {
  onTranscriptChange: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onSilenceTimeout?: () => void;
  onListeningStateChange?: (isListening: boolean) => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export class SpeechToTextEngine {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  // Non-aggressive 4.5 second pause detection allows natural candidate thought pauses
  private silenceThresholdMs = 4500;
  private currentTranscript = "";

  constructor() {
    if (typeof window !== "undefined") {
      const windowObj = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      };
      const SpeechRecognitionClass = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";
      }
    }
  }

  isSupported(): boolean {
    return Boolean(this.recognition);
  }

  startListening(callbacks: STTCallbacks): void {
    if (!this.recognition) {
      callbacks.onError("Browser speech recognition is not supported in this environment. Text fallback mode is enabled.");
      callbacks.onListeningStateChange?.(false);
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.currentTranscript = "";
    this.isListening = true;
    callbacks.onListeningStateChange?.(true);

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.currentTranscript += finalTranscript;
      }

      const activeText = (this.currentTranscript + interimTranscript).trim();
      callbacks.onTranscriptChange(activeText, false);

      // Non-aggressive silence detection reset
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      if (activeText.length > 15) {
        this.silenceTimer = setTimeout(() => {
          if (callbacks.onSilenceTimeout && this.isListening) {
            callbacks.onSilenceTimeout();
          }
        }, this.silenceThresholdMs);
      }
    };

    this.recognition.onerror = (event: { error: string }) => {
      if (event.error === "no-speech") return;
      callbacks.onError(`Microphone recognition issue: ${event.error || "Please speak clearly or use text input"}`);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        try {
          this.recognition?.start();
        } catch {
          // Restart gracefully
        }
      } else {
        callbacks.onListeningStateChange?.(false);
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      callbacks.onListeningStateChange?.(false);
      callbacks.onError(`Could not initialize microphone: ${e instanceof Error ? e.message : "Hardware busy or denied"}`);
    }
  }

  stopListening(): string {
    this.isListening = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
    }

    return this.currentTranscript.trim();
  }
}
