/**
 * The earlier turns of a Kairos conversation, sent by the browser so a follow-up
 * like "what about the second one?" makes sense. It is only conversation text:
 * the model is told to use it for continuity and never as a source of facts about
 * the candidate, which still come only from rows the server fetched itself.
 */

const MAX_TURNS = 6;
const MAX_CONTENT = 800;

/**
 * Turns whatever the client sent into a short, safe list of {role, content}.
 * Keeps only the last few well-formed user/assistant turns and trims each one;
 * anything else (other roles, non-strings, empty text) is dropped.
 */
function sanitizeAdviceHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.trim().length > 0,
    )
    .slice(-MAX_TURNS)
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, MAX_CONTENT) }));
}

/** The history as a block of text for the prompt, or "" when there is none. */
function formatAdviceHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return "";
  const lines = history.map((turn) => `${turn.role === "user" ? "Candidate" : "Advisor"}: ${turn.content}`);
  return (
    "Earlier in this conversation (only for continuity, such as what \"it\" refers to; " +
    "it is not a source of facts about the candidate):\n" +
    `${lines.join("\n")}\n\n`
  );
}

module.exports = { sanitizeAdviceHistory, formatAdviceHistory, MAX_TURNS, MAX_CONTENT };
