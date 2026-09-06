export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onBoundary?: (charIndex: number) => void;
}

export function splitTextIntoSentences(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  // Split on sentence-ending punctuation followed by space or end of text
  const matches = clean.match(/[^.!?\n]+[.!?\n]+(\s+|$)|[^.!?\n]+$/g);
  if (!matches || matches.length === 0) return [clean];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

export class TextToSpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private currentSessionId = 0;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private sentenceQueue: string[] = [];
  private currentCallbacks: TTSCallbacks | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

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
            v.name.includes("David") ||
            v.name.includes("Arthur"))
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

  /**
   * Play text completely, chunked by sentences so Chromium does not stall on long utterances.
   * onEnd callback fires strictly when the entire queue of sentences is drained.
   */
  speak(text: string, callbacks?: TTSCallbacks): void {
    if (!this.synth) {
      callbacks?.onError?.("Speech synthesis not supported in this browser.");
      callbacks?.onEnd?.();
      return;
    }

    // Safely stop any prior active speech session
    this.stop();

    const cleanText = text.trim();
    if (!cleanText) {
      callbacks?.onEnd?.();
      return;
    }

    const sentences = splitTextIntoSentences(cleanText);
    if (sentences.length === 0) {
      callbacks?.onEnd?.();
      return;
    }

    const sessionId = ++this.currentSessionId;
    this.sentenceQueue = [...sentences];
    this.currentCallbacks = callbacks || null;

    // Start Chromium keep-alive heartbeat (pauses/resumes every 10s to prevent silent stall)
    this.startKeepAlive();

    // Start playing the first sentence in queue
    this.playNextSentence(sessionId, true);
  }

  /**
   * Promise-based speak helper that resolves ONLY after the full audio has finished.
   */
  speakAsync(text: string, callbacks?: TTSCallbacks): Promise<void> {
    return new Promise((resolve) => {
      this.speak(text, {
        onStart: () => callbacks?.onStart?.(),
        onBoundary: (idx) => callbacks?.onBoundary?.(idx),
        onError: (err) => {
          callbacks?.onError?.(err);
          resolve();
        },
        onEnd: () => {
          callbacks?.onEnd?.();
          resolve();
        },
      });
    });
  }

  private playNextSentence(sessionId: number, isFirstSentence: boolean): void {
    if (sessionId !== this.currentSessionId) return;

    if (this.sentenceQueue.length === 0) {
      this.completeSession(sessionId);
      return;
    }

    const sentence = this.sentenceQueue.shift()!;
    const utterance = new SpeechSynthesisUtterance(sentence);
    this.activeUtterance = utterance;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    // Set a generous watchdog per sentence (1500ms per word + 15s) strictly as a failsafe
    const wordCount = sentence.split(/\s+/).length;
    const sentenceWatchdogMs = Math.max(12000, (wordCount * 1500) + 10000);
    this.resetWatchdog(sessionId, sentenceWatchdogMs);

    utterance.onstart = () => {
      if (sessionId !== this.currentSessionId) return;
      this.isSpeaking = true;
      if (isFirstSentence) {
        this.currentCallbacks?.onStart?.();
      }
    };

    utterance.onboundary = (e) => {
      if (sessionId !== this.currentSessionId) return;
      // Refresh watchdog on active boundary movement
      this.resetWatchdog(sessionId, sentenceWatchdogMs);
      this.currentCallbacks?.onBoundary?.(e.charIndex);
    };

    utterance.onend = () => {
      if (sessionId !== this.currentSessionId) return;
      this.clearWatchdog();
      this.activeUtterance = null;
      // Play next queued sentence
      this.playNextSentence(sessionId, false);
    };

    utterance.onerror = (e) => {
      if (sessionId !== this.currentSessionId) return;
      this.clearWatchdog();
      this.activeUtterance = null;

      if (e.error === "canceled" || e.error === "interrupted") {
        return;
      }

      console.warn("TTS sentence playback notice:", e.error);
      // Attempt next sentence if available, else complete
      if (this.sentenceQueue.length > 0) {
        this.playNextSentence(sessionId, false);
      } else {
        this.completeSession(sessionId);
      }
    };

    try {
      this.synth?.speak(utterance);
    } catch (err) {
      console.warn("TTS speak exception:", err);
      this.completeSession(sessionId);
    }
  }

  private completeSession(sessionId: number): void {
    if (sessionId !== this.currentSessionId) return;
    this.cleanupSession();
    this.currentCallbacks?.onEnd?.();
  }

  private startKeepAlive(): void {
    this.clearKeepAlive();
    // Pinging pause/resume every 10 seconds prevents Chromium SpeechSynthesis from sleeping
    this.keepAliveTimer = setInterval(() => {
      if (this.synth && this.isSpeaking && !this.synth.paused) {
        try {
          this.synth.pause();
          this.synth.resume();
        } catch {
          // Ignore keep-alive errors
        }
      }
    }, 10000);
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private resetWatchdog(sessionId: number, durationMs: number): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (sessionId === this.currentSessionId && this.isSpeaking) {
        console.warn("TTS watchdog trigger: sentence took longer than expected, advancing queue");
        this.playNextSentence(sessionId, false);
      }
    }, durationMs);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private cleanupSession(): void {
    this.clearKeepAlive();
    this.clearWatchdog();
    this.isSpeaking = false;
    this.sentenceQueue = [];
    this.activeUtterance = null;
  }

  stop(): void {
    this.currentSessionId++;
    this.cleanupSession();
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore cancel errors
      }
    }
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}
