// Gives the voice interview's interviewer a real spoken voice (Week 2 voice
// upgrade), via POST /api/interview-speech (server/lib/elevenlabs.js). Falls
// back to the browser's free built-in speechSynthesis voice whenever the
// server route isn't available — a missing/unconfigured ELEVENLABS_API_KEY,
// a network error, anything — so the interview always keeps working, same
// "try the real thing, degrade honestly" pattern as useSpeechRecognition.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../config/api";

export type InterviewerVoiceStatus = "idle" | "loading" | "speaking";

export type UseInterviewerVoiceResult = {
  status: InterviewerVoiceStatus;
  /** Speaks one line of text and resolves once playback finishes (or is
   * stopped). Never rejects — a failure just falls back silently. */
  speak: (text: string) => Promise<void>;
  /** Stops whatever is currently playing/speaking. */
  stop: () => void;
};

function speakWithBrowserFallback(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

export function useInterviewerVoice(accessToken?: string): UseInterviewerVoiceResult {
  const [status, setStatus] = useState<InterviewerVoiceStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanupObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    cleanupObjectUrl();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStatus("idle");
  }, [cleanupObjectUrl]);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setStatus("loading");
      try {
        const res = await fetch(`${API_BASE}/api/interview-speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ text: trimmed }),
        });
        if (!res.ok) throw new Error(`interview-speech failed (${res.status})`);

        const blob = await res.blob();
        cleanupObjectUrl();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const audio = audioRef.current;
        audio.src = url;

        await new Promise<void>((resolve) => {
          const finish = () => resolve();
          audio.onended = finish;
          audio.onerror = finish;
          setStatus("speaking");
          audio.play().catch(() => finish());
        });
      } catch {
        // Server TTS unavailable (not configured, rate-limited, network
        // error, autoplay blocked) — degrade to the free browser voice
        // rather than leaving the question silent.
        setStatus("speaking");
        await speakWithBrowserFallback(trimmed);
      } finally {
        cleanupObjectUrl();
        setStatus("idle");
      }
    },
    [accessToken, cleanupObjectUrl],
  );

  return { status, speak, stop };
}
