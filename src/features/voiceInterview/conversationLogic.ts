// Pure, testable rules for the dynamic voice interview conversation engine
// (Week 3) — replaces the fixed question-list model. Kept free of Supabase,
// fetch, and the Speech APIs so it's directly unit-testable, same philosophy
// as sessionLogic.ts (the fixed-question engine's pure logic, still used by
// legacy-shaped sessions). See conversationLogic.test.ts.

import type { ConversationState, ConversationTurn } from "../../types/voiceInterview";

/** A fresh conversation's starting state, before the opening turn arrives. */
export function initialConversationState(): ConversationState {
  return {
    topicsCovered: [],
    currentTopic: null,
    followUpCountForTopic: 0,
    turnCount: 0,
    stage: "active",
  };
}

/** Appends one turn to a transcript, stamping the current time — never
 * mutates the input array. */
export function appendTurn(
  transcript: ConversationTurn[],
  speaker: ConversationTurn["speaker"],
  text: string,
): ConversationTurn[] {
  return [...transcript, { speaker, text: text.trim(), at: new Date().toISOString() }];
}

export function countCandidateTurns(transcript: ConversationTurn[]): number {
  return transcript.filter((t) => t.speaker === "candidate").length;
}

// Soft target the interviewer paces itself against (also sent to the AI as
// context) — used client-side only for the progress-dots UI, never shown to
// the candidate as a literal "question N of M" count.
export const TARGET_CANDIDATE_TURNS = 9;
// Hard cap enforced server-side (server/index.js's POST /api/interview-turn)
// regardless of what the model decides — guarantees a session can never run
// away in length or cost. Mirrored here so the client's progress indicator
// and any client-side pacing hints agree with the server's actual cutoff.
export const MAX_CANDIDATE_TURNS = 12;

export function isNearingBudget(turnCount: number, targetTurns: number = TARGET_CANDIDATE_TURNS): boolean {
  return turnCount >= targetTurns - 2;
}

/** How many of a fixed number of progress dots should render "filled",
 * given how far into the soft turn budget the conversation is. Always
 * leaves at least one dot unfilled until the interview actually completes,
 * so progress never visually claims 100% before `isComplete`. */
export function progressDotsFilled(
  turnCount: number,
  totalDots: number,
  isComplete: boolean,
  targetTurns: number = TARGET_CANDIDATE_TURNS,
): number {
  if (isComplete) return totalDots;
  if (totalDots <= 0) return 0;
  const ratio = Math.min(turnCount / targetTurns, 1);
  return Math.min(totalDots - 1, Math.round(ratio * totalDots));
}

/** Rolls a turn's { action, topic } into the next persisted state — pure so
 * the exact bookkeeping rules (when the follow-up counter resets, when a
 * topic is recorded as covered) are independently testable. */
export function advanceConversationState(
  state: ConversationState,
  turnCount: number,
  action: string,
  topic: string | null,
): ConversationState {
  const topicChanged = topic != null && topic !== state.currentTopic;
  // The follow-up counter resets only on an actual topic transition (or the
  // opening turn) — never because the model re-worded its topic label. The
  // label drifting ("maintenance scheduling" -> "maintenance tools") used to
  // reset it every turn, so one topic could be probed forever.
  const startsNewTopic = action === "TRANSITION_TOPIC" || state.currentTopic === null;
  const topicsCovered =
    topicChanged && state.currentTopic
      ? [...state.topicsCovered, state.currentTopic]
      : state.topicsCovered;

  return {
    topicsCovered,
    currentTopic: topic ?? state.currentTopic,
    followUpCountForTopic: startsNewTopic ? 0 : state.followUpCountForTopic + 1,
    turnCount,
    stage: action === "CLOSE_INTERVIEW" ? "closing" : state.stage,
  };
}

/** Renders a transcript as plain "Interviewer: ...\nYou: ..." lines, for the
 * collapsible full-transcript view and for sending to the evaluation route. */
export function formatTranscriptForDisplay(transcript: ConversationTurn[]): string {
  return transcript
    .map((t) => `${t.speaker === "interviewer" ? "Interviewer" : "You"}: ${t.text}`)
    .join("\n");
}
