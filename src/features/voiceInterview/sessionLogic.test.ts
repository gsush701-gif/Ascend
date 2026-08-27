import { describe, it, expect } from "vitest";
import {
  assembleTranscript,
  combinedTranscript,
  isTranscriptSubmittable,
  isValidVoiceResponse,
  sanitizeVoiceResponses,
  upsertResponse,
  computeSessionProgress,
} from "./sessionLogic";
import type { VoiceInterviewResponse } from "../../types/voiceInterview";

describe("assembleTranscript", () => {
  it("returns empty strings for no parts", () => {
    expect(assembleTranscript([])).toEqual({ finalText: "", interimText: "" });
  });

  it("joins only final parts into finalText", () => {
    const result = assembleTranscript([
      { transcript: "I built", isFinal: true },
      { transcript: "a REST API", isFinal: true },
    ]);
    expect(result.finalText).toBe("I built a REST API");
    expect(result.interimText).toBe("");
  });

  it("keeps interim (not-yet-final) text separate", () => {
    const result = assembleTranscript([
      { transcript: "I built a REST API", isFinal: true },
      { transcript: "and then I", isFinal: false },
    ]);
    expect(result.finalText).toBe("I built a REST API");
    expect(result.interimText).toBe("and then I");
  });

  it("recomputes from the full list rather than accumulating duplicates", () => {
    // Simulates the Web Speech API re-sending an updated interim chunk
    // before it finalizes — the caller always passes the full results list.
    const first = assembleTranscript([{ transcript: "hello", isFinal: false }]);
    expect(first.interimText).toBe("hello");
    const second = assembleTranscript([{ transcript: "hello world", isFinal: false }]);
    expect(second.interimText).toBe("hello world");
  });

  it("ignores blank/whitespace-only chunks", () => {
    const result = assembleTranscript([
      { transcript: "  ", isFinal: true },
      { transcript: "actual answer", isFinal: true },
      { transcript: "", isFinal: false },
    ]);
    expect(result.finalText).toBe("actual answer");
    expect(result.interimText).toBe("");
  });
});

describe("combinedTranscript", () => {
  it("joins final and interim when both present", () => {
    expect(combinedTranscript("I built a", "REST API")).toBe("I built a REST API");
  });

  it("returns just final text when interim is empty", () => {
    expect(combinedTranscript("Done talking.", "")).toBe("Done talking.");
  });

  it("returns just interim text when final is empty (stopped mid-utterance)", () => {
    expect(combinedTranscript("", "still speaking")).toBe("still speaking");
  });

  it("returns empty string when both are empty", () => {
    expect(combinedTranscript("", "")).toBe("");
  });
});

describe("isTranscriptSubmittable", () => {
  it("rejects empty or too-short transcripts", () => {
    expect(isTranscriptSubmittable("")).toBe(false);
    expect(isTranscriptSubmittable("short")).toBe(false);
  });

  it("rejects whitespace padding used to fake length", () => {
    expect(isTranscriptSubmittable("   \n\n   ")).toBe(false);
  });

  it("accepts a transcript at/above the minimum length", () => {
    expect(isTranscriptSubmittable("This is a real answer.")).toBe(true);
  });
});

function makeResponse(overrides: Partial<VoiceInterviewResponse> = {}): VoiceInterviewResponse {
  return {
    questionIndex: 0,
    transcript: "My answer to the question.",
    feedback: "Solid structure.",
    strengths: ["Clear"],
    improvements: ["Add more detail"],
    answeredAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("isValidVoiceResponse", () => {
  it("accepts a well-formed entry", () => {
    expect(isValidVoiceResponse(makeResponse())).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(isValidVoiceResponse(null)).toBe(false);
    expect(isValidVoiceResponse(undefined)).toBe(false);
    expect(isValidVoiceResponse("string")).toBe(false);
    expect(isValidVoiceResponse(42)).toBe(false);
  });

  it("rejects a negative or non-integer questionIndex", () => {
    expect(isValidVoiceResponse(makeResponse({ questionIndex: -1 }))).toBe(false);
    expect(isValidVoiceResponse(makeResponse({ questionIndex: 1.5 }))).toBe(false);
  });

  it("rejects wrong types for string/array fields", () => {
    expect(isValidVoiceResponse({ ...makeResponse(), transcript: 5 })).toBe(false);
    expect(isValidVoiceResponse({ ...makeResponse(), strengths: "not an array" })).toBe(false);
    expect(isValidVoiceResponse({ ...makeResponse(), strengths: [1, 2] })).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { answeredAt: _answeredAt, ...missingAnsweredAt } = makeResponse();
    expect(isValidVoiceResponse(missingAnsweredAt)).toBe(false);
  });
});

describe("sanitizeVoiceResponses", () => {
  it("returns an empty array for non-array input", () => {
    expect(sanitizeVoiceResponses(null)).toEqual([]);
    expect(sanitizeVoiceResponses(undefined)).toEqual([]);
    expect(sanitizeVoiceResponses("garbage")).toEqual([]);
  });

  it("drops malformed entries but keeps well-formed ones", () => {
    const good = makeResponse();
    const result = sanitizeVoiceResponses([good, { bogus: true }, null, 5]);
    expect(result).toEqual([good]);
  });
});

describe("upsertResponse", () => {
  it("appends a new response for an unanswered question", () => {
    const result = upsertResponse([], makeResponse({ questionIndex: 0 }));
    expect(result).toHaveLength(1);
    expect(result[0].questionIndex).toBe(0);
  });

  it("replaces (not duplicates) the entry for an already-answered question", () => {
    const first = makeResponse({ questionIndex: 1, transcript: "first take" });
    const revised = makeResponse({ questionIndex: 1, transcript: "second take" });
    const result = upsertResponse([first], revised);
    expect(result).toHaveLength(1);
    expect(result[0].transcript).toBe("second take");
  });

  it("keeps the array sorted by questionIndex regardless of insertion order", () => {
    let result = upsertResponse([], makeResponse({ questionIndex: 2 }));
    result = upsertResponse(result, makeResponse({ questionIndex: 0 }));
    result = upsertResponse(result, makeResponse({ questionIndex: 1 }));
    expect(result.map((r) => r.questionIndex)).toEqual([0, 1, 2]);
  });
});

describe("computeSessionProgress", () => {
  const questions = [
    { question: "Q1", category: "behavioral" },
    { question: "Q2", category: "technical" },
    { question: "Q3", category: "behavioral" },
  ];

  it("reports zero progress and nextIndex 0 for a fresh session", () => {
    const progress = computeSessionProgress(questions, []);
    expect(progress).toEqual({ answered: 0, total: 3, remaining: 3, isComplete: false, nextIndex: 0 });
  });

  it("tracks partial progress and the next unanswered index", () => {
    const progress = computeSessionProgress(questions, [makeResponse({ questionIndex: 0 })]);
    expect(progress.answered).toBe(1);
    expect(progress.remaining).toBe(2);
    expect(progress.nextIndex).toBe(1);
    expect(progress.isComplete).toBe(false);
  });

  it("skips over an out-of-order answered question to find the true next gap", () => {
    const progress = computeSessionProgress(questions, [
      makeResponse({ questionIndex: 0 }),
      makeResponse({ questionIndex: 2 }),
    ]);
    expect(progress.nextIndex).toBe(1);
    expect(progress.answered).toBe(2);
  });

  it("reports complete once every question has a response", () => {
    const progress = computeSessionProgress(questions, [
      makeResponse({ questionIndex: 0 }),
      makeResponse({ questionIndex: 1 }),
      makeResponse({ questionIndex: 2 }),
    ]);
    expect(progress.isComplete).toBe(true);
    expect(progress.nextIndex).toBeNull();
    expect(progress.remaining).toBe(0);
  });

  it("does not report complete for an empty question set", () => {
    expect(computeSessionProgress([], []).isComplete).toBe(false);
  });
});
