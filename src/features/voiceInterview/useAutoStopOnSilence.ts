// Auto-stops the microphone after a trailing pause, so a voice interview
// answer feels like a real conversation ("say your answer, then it just
// knows you're done") instead of requiring a manual "Stop" click. The
// manual Stop button in VoiceInterview.tsx stays as an override — this is
// purely additive automation on top of useSpeechRecognition.ts.
import { useEffect, useRef } from "react";

// Time to allow before the candidate has said anything yet — long enough to
// think before speaking without the mic cutting out prematurely.
export const AUTO_STOP_GRACE_MS = 6000;
// Trailing silence, once they've started talking, before treating the
// answer as finished.
export const AUTO_STOP_SILENCE_MS = 2500;

/** Pure decision: how long to wait before auto-stopping, given whether the
 * transcript already has content. Extracted for direct unit testing — see
 * useAutoStopOnSilence.test.ts. */
export function getAutoStopDelayMs(
  hasContent: boolean,
  graceMs: number = AUTO_STOP_GRACE_MS,
  silenceMs: number = AUTO_STOP_SILENCE_MS,
): number {
  return hasContent ? silenceMs : graceMs;
}

type RecognitionLike = {
  status: string;
  transcript: string;
  stop: () => void;
};

/**
 * Watches a `useSpeechRecognition` result and calls `stop()` after a
 * trailing pause in speech. Resets its timer on every transcript change
 * (the Web Speech API fires incremental results while the candidate is
 * still talking), so continuous speech never gets cut off — only silence
 * does. Does nothing while not actively listening.
 */
export function useAutoStopOnSilence(
  recognition: RecognitionLike,
  options?: { graceMs?: number; silenceMs?: number },
): void {
  const graceMs = options?.graceMs ?? AUTO_STOP_GRACE_MS;
  const silenceMs = options?.silenceMs ?? AUTO_STOP_SILENCE_MS;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef(recognition.stop);
  // Keep the latest stop() for the timer to call. Done in an effect, declared
  // before the timer effect, rather than during render.
  useEffect(() => {
    stopRef.current = recognition.stop;
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recognition.status !== "listening") return;

    const hasContent = recognition.transcript.trim().length > 0;
    const delay = getAutoStopDelayMs(hasContent, graceMs, silenceMs);
    timerRef.current = setTimeout(() => {
      stopRef.current();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [recognition.status, recognition.transcript, graceMs, silenceMs]);
}
