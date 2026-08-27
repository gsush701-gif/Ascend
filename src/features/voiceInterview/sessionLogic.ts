// Pure, testable rules for the voice interview feature: assembling a
// transcript out of the browser's incremental Web Speech API results, and
// validating/merging the `responses` shape persisted to
// voice_interview_sessions.responses (supabase/migrations/023_voice_interview_sessions.sql).
// Kept free of the SpeechRecognition browser API and Supabase so they can be
// unit tested directly — see sessionLogic.test.ts. The stateful wiring lives
// in useSpeechRecognition.ts and hooks/useVoiceInterviewSessions.ts.

import type { VoiceInterviewQuestion, VoiceInterviewResponse } from "../../types/voiceInterview";

/** One chunk out of a SpeechRecognitionEvent's `results` list — deliberately
 * not the real DOM type so this stays independent of `lib.dom` speech-API
 * typings (which are incomplete/nonstandard) and directly unit-testable. */
export type SpeechResultPart = { transcript: string; isFinal: boolean };

/**
 * Combine every result chunk seen so far into a finalized transcript (all
 * `isFinal: true` chunks, joined) and the current interim (in-progress,
 * not-yet-final) text. The Web Speech API delivers results incrementally and
 * can re-send an updated interim chunk before it finalizes, so this always
 * recomputes from the full list rather than trying to diff/append — simpler
 * and can't double-count.
 */
export function assembleTranscript(parts: SpeechResultPart[]): {
  finalText: string;
  interimText: string;
} {
  const finalPieces: string[] = [];
  const interimPieces: string[] = [];
  for (const part of parts) {
    const text = part.transcript.trim();
    if (!text) continue;
    if (part.isFinal) finalPieces.push(text);
    else interimPieces.push(text);
  }
  return {
    finalText: finalPieces.join(" ").trim(),
    interimText: interimPieces.join(" ").trim(),
  };
}

/** The full transcript a user would see/submit: finalized text plus whatever
 * is still being recognized, so nothing spoken is silently dropped if the
 * user hits "Stop" mid-utterance. */
export function combinedTranscript(finalText: string, interimText: string): string {
  return [finalText, interimText].filter((s) => s.trim().length > 0).join(" ").trim();
}

/** Same minimum-content bar as the text-based flow's answer validation
 * (server/index.js's POST /api/interview-feedback requires >= 10 chars) so
 * voice mode can't submit an empty/near-empty transcript for feedback. */
export const MIN_TRANSCRIPT_LENGTH = 10;

export function isTranscriptSubmittable(transcript: string): boolean {
  return transcript.trim().length >= MIN_TRANSCRIPT_LENGTH;
}

/** Runtime shape check for one `responses[]` entry — guards against a
 * malformed row (e.g. hand-edited in the DB, or a future schema change)
 * before it's rendered or merged. */
export function isValidVoiceResponse(value: unknown): value is VoiceInterviewResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.questionIndex === "number" &&
    Number.isInteger(v.questionIndex) &&
    v.questionIndex >= 0 &&
    typeof v.transcript === "string" &&
    typeof v.feedback === "string" &&
    Array.isArray(v.strengths) &&
    v.strengths.every((s) => typeof s === "string") &&
    Array.isArray(v.improvements) &&
    v.improvements.every((s) => typeof s === "string") &&
    typeof v.answeredAt === "string"
  );
}

/** Filters a raw `responses` jsonb array down to well-formed entries,
 * dropping anything malformed rather than letting it crash rendering. */
export function sanitizeVoiceResponses(raw: unknown): VoiceInterviewResponse[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidVoiceResponse);
}

/**
 * Insert or replace the response for one question index, keeping the array
 * sorted by questionIndex — mirrors how a session is answered in order but
 * tolerates re-answering a question (regenerated feedback replaces, not
 * duplicates).
 */
export function upsertResponse(
  responses: VoiceInterviewResponse[],
  entry: VoiceInterviewResponse,
): VoiceInterviewResponse[] {
  const next = responses.filter((r) => r.questionIndex !== entry.questionIndex);
  next.push(entry);
  next.sort((a, b) => a.questionIndex - b.questionIndex);
  return next;
}

export type SessionProgress = {
  answered: number;
  total: number;
  remaining: number;
  isComplete: boolean;
  nextIndex: number | null;
};

/** Where a session currently stands, given its question set and the
 * responses recorded so far. `nextIndex` is the first not-yet-answered
 * question, or null once every question has a response. */
export function computeSessionProgress(
  questions: VoiceInterviewQuestion[],
  responses: VoiceInterviewResponse[],
): SessionProgress {
  const answeredIndexes = new Set(responses.map((r) => r.questionIndex));
  const total = questions.length;
  const answered = questions.reduce(
    (count, _q, i) => (answeredIndexes.has(i) ? count + 1 : count),
    0,
  );
  let nextIndex: number | null = null;
  for (let i = 0; i < total; i++) {
    if (!answeredIndexes.has(i)) {
      nextIndex = i;
      break;
    }
  }
  return {
    answered,
    total,
    remaining: total - answered,
    isComplete: total > 0 && answered >= total,
    nextIndex,
  };
}
