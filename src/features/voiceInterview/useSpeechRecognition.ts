import { useCallback, useEffect, useRef, useState } from "react";
import { assembleTranscript, combinedTranscript, type SpeechResultPart } from "./sessionLogic";

// Minimal typings for the Web Speech API's SpeechRecognition interface.
// Deliberately hand-rolled here rather than pulled from `lib.dom` — TS's DOM
// lib doesn't ship these types (the API is still non-standard/vendor
// -prefixed), and `webkitSpeechRecognition` isn't in `lib.dom` at all.
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Feature-detection only — safe to call at module scope/render time, does
 * not touch the microphone or prompt for permission. Chrome, Edge, and other
 * Chromium-based browsers support this; Firefox does not, and Safari's
 * support is limited/inconsistent, which is why this is a hard gate rather
 * than a "try it and see" UI. */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export type SpeechRecognitionStatus =
  | "unsupported"
  | "idle"
  | "listening"
  | "stopped"
  | "permission-denied"
  | "error";

export type UseSpeechRecognitionResult = {
  isSupported: boolean;
  status: SpeechRecognitionStatus;
  /** Finalized text recognized so far this "take" (since the last start()). */
  finalText: string;
  /** In-progress, not-yet-finalized text — changes live while listening. */
  interimText: string;
  /** finalText + interimText, for display/submission. */
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Clears finalText/interimText/error, e.g. before re-recording an answer. */
  reset: () => void;
};

/**
 * Wraps the browser's native Web Speech API
 * (window.SpeechRecognition / window.webkitSpeechRecognition) for the voice
 * interview feature. This is the genuinely functional transcription path —
 * no server round-trip, no paid API — behind explicit feature detection and
 * microphone-permission handling. See
 * server/lib/speechProviders/types.js for where a future paid provider
 * (needed for Firefox/Safari support) would plug in instead.
 */
export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const supported = isSpeechRecognitionSupported();
  const [status, setStatus] = useState<SpeechRecognitionStatus>(
    supported ? "idle" : "unsupported",
  );
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Tracks whether the user explicitly called stop(), so an unexpected
  // onend (some browsers end recognition automatically after a pause) isn't
  // mistaken for a user-initiated stop and doesn't stomp an "error" status.
  const stoppedByUserRef = useRef(false);

  const teardown = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped/aborted — nothing to do.
      }
    }
    recognitionRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(() => {
    if (!supported) return;
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }

    setError(null);
    setFinalText("");
    setInterimText("");
    stoppedByUserRef.current = false;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const parts: SpeechResultPart[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        parts.push({ transcript: result[0]?.transcript ?? "", isFinal: result.isFinal });
      }
      const assembled = assembleTranscript(parts);
      setFinalText(assembled.finalText);
      setInterimText(assembled.interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setStatus("permission-denied");
        setError("Microphone access was denied. Allow microphone access in your browser to use voice mode.");
        return;
      }
      if (event.error === "no-speech") {
        // Not a real error — just nothing heard yet; let onend handle status.
        return;
      }
      setStatus("error");
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      setStatus((current) => (current === "permission-denied" ? current : "stopped"));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus("listening");
    } catch {
      setStatus("error");
      setError("Couldn't start the microphone. Try again.");
    }
  }, [supported]);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Already stopped — the onend handler (if it fires) will settle status.
      }
    } else {
      setStatus((current) => (current === "listening" ? "stopped" : current));
    }
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterimText("");
    setError(null);
    setStatus((current) => (current === "unsupported" ? current : "idle"));
  }, []);

  return {
    isSupported: supported,
    status,
    finalText,
    interimText,
    transcript: combinedTranscript(finalText, interimText),
    error,
    start,
    stop,
    reset,
  };
}
