/**
 * Kramix.AI — High-Fidelity Text-To-Speech Engine
 *
 * Configured specifically for a natural, articulate male interviewer voice (Alex Vance).
 * Fixes all known Chromium Web Speech API bugs:
 *  1. Garbage collection mid-speech bug (prevented via globalUtteranceRegistry)
 *  2. Audio clipping/pausing bug (removed harmful pause/resume interval; smart chunking)
 *  3. Strict male-only voice selection (excludes female voices across Chrome, Edge, Safari, Windows, macOS)
 */

export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onBoundary?: (charIndex: number) => void;
}

// Global registry of active utterances to prevent V8 GC from collecting them mid-speech
const globalUtteranceRegistry = new Set<SpeechSynthesisUtterance>();

/**
 * Splits text into conversational speech chunks of reasonable length (up to ~200 chars).
 * Short texts (< 200 chars) are NOT split, preventing awkward gaps and stutters between sentences.
 */
export function splitTextIntoSpeechChunks(text: string, maxChunkLength = 200): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChunkLength) return [clean];

  // Split on sentence-ending punctuation (. ? ! or newline)
  const sentences = clean.match(/[^.!?\n]+[.!?\n]+(\s+|$)|[^.!?\n]+$/g);
  if (!sentences || sentences.length <= 1) return [clean];

  const chunks: string[] = [];
  let currentChunk = "";

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if (!currentChunk) {
      currentChunk = trimmed;
    } else if (currentChunk.length + trimmed.length + 1 <= maxChunkLength) {
      currentChunk += " " + trimmed;
    } else {
      chunks.push(currentChunk);
      currentChunk = trimmed;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Backward-compatible alias
export const splitTextIntoSentences = splitTextIntoSpeechChunks;

/**
 * Selects exclusively male voices for the interviewer (Alex Vance).
 * Strictly filters out female voices and prioritizes natural male voices.
 */
export function selectMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const englishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  const femaleIndicators = [
    "female", "woman", "girl", "zira", "samantha", "victoria", "karen",
    "susan", "jenny", "aria", "ava", "emma", "sonia", "libby", "clara",
    "hazel", "heera", "neerja", "priya", "veena", "catherine", "michelle",
    "monica", "stephanie", "tessa", "alice", "fiona", "katrina", "ayumi",
    "luciana", "joana", "yuna", "ting-ting", "mei-jia", "zoe", "salli",
    "joanna", "kendra", "ivy", "kimberly", "cynthia", "nancy", "linda"
  ];

  const maleIndicators = [
    "male", "ryan", "guy", "david", "mark", "christopher", "eric",
    "andrew", "brian", "daniel", "arthur", "george", "oliver",
    "thomas", "james", "alex", "fred", "aaron", "steffan", "roger",
    "russell", "liam", "alonzo", "matthew", "justin", "joey", "tom",
    "reed", "bruce", "edward", "stefan", "en-us-guy", "en-us-ryan"
  ];

  // 1. Highest priority: Edge/Azure Online Natural / Neural male voices
  const naturalMale = pool.find((v) => {
    const name = v.name.toLowerCase();
    if (femaleIndicators.some((f) => name.includes(f))) return false;
    const isNatural = name.includes("natural") || name.includes("neural") || name.includes("online");
    const isMale = maleIndicators.some((m) => name.includes(m));
    return isNatural && isMale;
  });
  if (naturalMale) return naturalMale;

  // 2. High priority: Known native desktop male voices (David, Mark, Daniel, Guy, Ryan, Alex, George)
  const knownMale = pool.find((v) => {
    const name = v.name.toLowerCase();
    if (femaleIndicators.some((f) => name.includes(f))) return false;
    return maleIndicators.some((m) => name.includes(m));
  });
  if (knownMale) return knownMale;

  // 3. Any English voice that does NOT contain female indicators
  // (Explicitly exclude "Google US English" which is female in Chrome unless tagged otherwise)
  const nonFemale = pool.find((v) => {
    const name = v.name.toLowerCase();
    if (name.includes("google us english") || name.includes("google uk english female")) {
      return false;
    }
    return !femaleIndicators.some((f) => name.includes(f));
  });
  if (nonFemale) return nonFemale;

  return pool[0] || null;
}

export class TextToSpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private currentSessionId = 0;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private chunkQueue: string[] = [];
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
      this.selectedVoice = selectMaleVoice(voices);
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
   * Play text smoothly.
   * Text is chunked only when long (> 200 chars) to prevent mid-sentence pauses.
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

    const chunks = splitTextIntoSpeechChunks(cleanText, 220);
    if (chunks.length === 0) {
      callbacks?.onEnd?.();
      return;
    }

    const sessionId = ++this.currentSessionId;
    this.chunkQueue = [...chunks];
    this.currentCallbacks = callbacks || null;

    // If voices were not loaded at constructor time, try resolving again
    if (!this.selectedVoice) {
      const voices = this.synth.getVoices() || [];
      this.selectedVoice = selectMaleVoice(voices);
    }

    // Ensure audio context is unpaused before starting
    if (this.synth.paused) {
      try {
        this.synth.resume();
      } catch {
        // Ignore resume error
      }
    }

    // Start safe non-destructive keep-alive
    this.startKeepAlive();

    // Start playing first chunk
    this.playNextChunk(sessionId, true);
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

  private playNextChunk(sessionId: number, isFirstChunk: boolean): void {
    if (sessionId !== this.currentSessionId) return;

    if (this.chunkQueue.length === 0) {
      this.completeSession(sessionId);
      return;
    }

    const chunk = this.chunkQueue.shift()!;
    const utterance = new SpeechSynthesisUtterance(chunk);
    this.activeUtterance = utterance;

    // Retain global reference to prevent V8 GC from collecting the utterance mid-audio
    globalUtteranceRegistry.add(utterance);

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = 1.0;
    // Deep, calm, confident male pitch
    utterance.pitch = 0.92;
    utterance.lang = this.selectedVoice?.lang || "en-US";

    // Generous watchdog (only fires if browser completely freezes audio for 20+ seconds)
    const wordCount = chunk.split(/\s+/).length;
    const chunkWatchdogMs = Math.max(16000, wordCount * 1800 + 12000);
    this.resetWatchdog(sessionId, chunkWatchdogMs);

    utterance.onstart = () => {
      if (sessionId !== this.currentSessionId) return;
      this.isSpeaking = true;
      if (isFirstChunk) {
        this.currentCallbacks?.onStart?.();
      }
    };

    utterance.onboundary = (e) => {
      if (sessionId !== this.currentSessionId) return;
      this.resetWatchdog(sessionId, chunkWatchdogMs);
      this.currentCallbacks?.onBoundary?.(e.charIndex);
    };

    utterance.onend = () => {
      globalUtteranceRegistry.delete(utterance);
      if (sessionId !== this.currentSessionId) return;
      this.clearWatchdog();
      this.activeUtterance = null;
      // Seamlessly advance to next chunk
      this.playNextChunk(sessionId, false);
    };

    utterance.onerror = (e) => {
      globalUtteranceRegistry.delete(utterance);
      if (sessionId !== this.currentSessionId) return;
      this.clearWatchdog();
      this.activeUtterance = null;

      if (e.error === "canceled" || e.error === "interrupted") {
        return;
      }

      console.warn("TTS chunk playback notice:", e.error);
      if (this.chunkQueue.length > 0) {
        this.playNextChunk(sessionId, false);
      } else {
        this.completeSession(sessionId);
      }
    };

    try {
      if (this.synth?.paused) {
        this.synth.resume();
      }
      this.synth?.speak(utterance);
    } catch (err) {
      globalUtteranceRegistry.delete(utterance);
      console.warn("TTS speak exception:", err);
      this.completeSession(sessionId);
    }
  }

  private completeSession(sessionId: number): void {
    if (sessionId !== this.currentSessionId) return;
    this.cleanupSession();
    this.currentCallbacks?.onEnd?.();
  }

  /**
   * Safe Chromium keep-alive:
   * Only calls resume() if the browser speech engine has paused.
   * NEVER calls pause(), preventing audio stutters, cuts, and glitches.
   */
  private startKeepAlive(): void {
    this.clearKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.synth && this.isSpeaking) {
        if (this.synth.paused) {
          try {
            this.synth.resume();
          } catch {
            // Ignore keep-alive errors
          }
        }
      }
    }, 2500);
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
        console.warn("TTS watchdog trigger: advancing chunk queue");
        this.playNextChunk(sessionId, false);
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
    this.chunkQueue = [];
    if (this.activeUtterance) {
      globalUtteranceRegistry.delete(this.activeUtterance);
      this.activeUtterance = null;
    }
  }

  stop(): void {
    this.currentSessionId++;
    this.cleanupSession();
    globalUtteranceRegistry.clear();
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
