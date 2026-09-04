export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onBoundary?: (charIndex: number) => void;
}

export class TextToSpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private safetyTimeout: NodeJS.Timeout | null = null;
  private currentUtteranceId = 0;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices(): void {
    if (!this.synth) return;
    const updateVoices = () => {
      const voices = this.synth?.getVoices() || [];
      // Prefer natural English voices
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Daniel") ||
            v.name.includes("Samantha") ||
            v.name.includes("Guy") ||
            v.name.includes("David"))
      );
      this.selectedVoice = preferred || voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;
    };

    updateVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = updateVoices;
    }
  }

  isSupported(): boolean {
    return Boolean(this.synth);
  }

  speak(text: string, callbacks?: TTSCallbacks): void {
    if (!this.synth) {
      callbacks?.onError?.("Speech synthesis not supported in this browser.");
      callbacks?.onEnd?.();
      return;
    }

    // Force cancel any prior active utterance before queuing new one
    this.stop();

    const cleanText = text.trim();
    if (!cleanText) {
      callbacks?.onEnd?.();
      return;
    }

    const utteranceId = ++this.currentUtteranceId;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    // Safety timeout: estimated ~85ms per word + 3.5s buffer
    const estimatedDurationMs = Math.max(3500, (cleanText.split(/\s+/).length * 90) + 3500);
    this.safetyTimeout = setTimeout(() => {
      if (this.isSpeaking && this.currentUtteranceId === utteranceId) {
        this.stop();
        callbacks?.onEnd?.();
      }
    }, estimatedDurationMs);

    utterance.onstart = () => {
      if (this.currentUtteranceId !== utteranceId) return;
      this.isSpeaking = true;
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      if (this.currentUtteranceId !== utteranceId) return;
      this.clearSafetyTimeout();
      this.isSpeaking = false;
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      if (this.currentUtteranceId !== utteranceId) return;
      this.clearSafetyTimeout();
      this.isSpeaking = false;
      if (e.error !== "canceled" && e.error !== "interrupted") {
        callbacks?.onError?.(`TTS Error: ${e.error}`);
      }
      callbacks?.onEnd?.();
    };

    utterance.onboundary = (e) => {
      if (this.currentUtteranceId !== utteranceId) return;
      callbacks?.onBoundary?.(e.charIndex);
    };

    try {
      this.synth.speak(utterance);
    } catch (err) {
      this.clearSafetyTimeout();
      this.isSpeaking = false;
      callbacks?.onError?.(err instanceof Error ? err.message : "TTS failed to initialize");
      callbacks?.onEnd?.();
    }
  }

  private clearSafetyTimeout(): void {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
  }

  stop(): void {
    this.currentUtteranceId++;
    this.clearSafetyTimeout();
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore cancel errors
      }
      this.isSpeaking = false;
    }
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}
