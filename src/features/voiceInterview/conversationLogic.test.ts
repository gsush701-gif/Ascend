import { describe, it, expect } from "vitest";
import {
  initialConversationState,
  appendTurn,
  countCandidateTurns,
  isNearingBudget,
  progressDotsFilled,
  advanceConversationState,
  formatTranscriptForDisplay,
  TARGET_CANDIDATE_TURNS,
} from "./conversationLogic";
import type { ConversationState, ConversationTurn } from "../../types/voiceInterview";

describe("initialConversationState", () => {
  it("starts empty/active with zero turns", () => {
    expect(initialConversationState()).toEqual({
      topicsCovered: [],
      currentTopic: null,
      followUpCountForTopic: 0,
      turnCount: 0,
      stage: "active",
    });
  });
});

describe("appendTurn", () => {
  it("appends a turn without mutating the input array", () => {
    const original: ConversationTurn[] = [];
    const next = appendTurn(original, "interviewer", "  Tell me about yourself.  ");
    expect(original).toEqual([]);
    expect(next).toHaveLength(1);
    expect(next[0].speaker).toBe("interviewer");
    expect(next[0].text).toBe("Tell me about yourself.");
    expect(typeof next[0].at).toBe("string");
  });
});

describe("countCandidateTurns", () => {
  it("counts only candidate turns", () => {
    const transcript: ConversationTurn[] = [
      { speaker: "interviewer", text: "Hi", at: "t1" },
      { speaker: "candidate", text: "Hi there", at: "t2" },
      { speaker: "interviewer", text: "Next question", at: "t3" },
      { speaker: "candidate", text: "Answer", at: "t4" },
    ];
    expect(countCandidateTurns(transcript)).toBe(2);
  });
});

describe("isNearingBudget", () => {
  it("is false well before the target", () => {
    expect(isNearingBudget(2, 14)).toBe(false);
  });

  it("is true within 2 turns of the target", () => {
    expect(isNearingBudget(12, 14)).toBe(true);
    expect(isNearingBudget(14, 14)).toBe(true);
  });

  it("defaults to TARGET_CANDIDATE_TURNS", () => {
    expect(isNearingBudget(TARGET_CANDIDATE_TURNS)).toBe(true);
  });
});

describe("progressDotsFilled", () => {
  it("fills all dots once complete", () => {
    expect(progressDotsFilled(3, 5, true)).toBe(5);
  });

  it("never fills every dot before completion", () => {
    expect(progressDotsFilled(14, 5, false, 14)).toBe(4);
  });

  it("fills zero dots at the very start", () => {
    expect(progressDotsFilled(0, 5, false, 14)).toBe(0);
  });

  it("scales proportionally to the target", () => {
    expect(progressDotsFilled(7, 5, false, 14)).toBe(3);
  });
});

describe("advanceConversationState", () => {
  const base = initialConversationState();

  it("records the previous topic as covered when the topic changes", () => {
    const withTopic = { ...base, currentTopic: "background" };
    const next = advanceConversationState(withTopic, 3, "TRANSITION_TOPIC", "problem solving");
    expect(next.topicsCovered).toEqual(["background"]);
    expect(next.currentTopic).toBe("problem solving");
    expect(next.followUpCountForTopic).toBe(0);
  });

  it("increments the follow-up counter when staying on the same topic", () => {
    const withTopic = { ...base, currentTopic: "background", followUpCountForTopic: 1 };
    const next = advanceConversationState(withTopic, 2, "FOLLOW_UP", "background");
    expect(next.followUpCountForTopic).toBe(2);
    expect(next.topicsCovered).toEqual([]);
  });

  it("keeps counting follow-ups when the model re-words the topic label (no endless loop)", () => {
    let state: ConversationState = { ...base, currentTopic: "maintenance scheduling", followUpCountForTopic: 0 };
    state = advanceConversationState(state, 2, "FOLLOW_UP", "maintenance tools");
    state = advanceConversationState(state, 3, "EXPLORE_DETAIL", "tool selection reasoning");
    expect(state.followUpCountForTopic).toBe(2);
  });

  it("starts the counter at 0 on the opening turn, then counts from there", () => {
    const opening = advanceConversationState(base, 0, "FOLLOW_UP", "background");
    expect(opening.followUpCountForTopic).toBe(0);
    const next = advanceConversationState(opening, 1, "FOLLOW_UP", "background");
    expect(next.followUpCountForTopic).toBe(1);
  });

  it("marks the stage as closing on CLOSE_INTERVIEW", () => {
    const next = advanceConversationState(base, 14, "CLOSE_INTERVIEW", "closing remarks");
    expect(next.stage).toBe("closing");
  });

  it("keeps the current topic when the AI omits one", () => {
    const withTopic = { ...base, currentTopic: "background" };
    const next = advanceConversationState(withTopic, 1, "FOLLOW_UP", null);
    expect(next.currentTopic).toBe("background");
  });
});

describe("formatTranscriptForDisplay", () => {
  it("renders speaker-labeled lines", () => {
    const transcript: ConversationTurn[] = [
      { speaker: "interviewer", text: "Tell me about yourself.", at: "t1" },
      { speaker: "candidate", text: "I'm a maintenance tech.", at: "t2" },
    ];
    expect(formatTranscriptForDisplay(transcript)).toBe(
      "Interviewer: Tell me about yourself.\nYou: I'm a maintenance tech.",
    );
  });
});
