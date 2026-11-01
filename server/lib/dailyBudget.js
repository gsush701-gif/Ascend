/**
 * A small in-memory "N per UTC day" counter. Used as a circuit breaker on the
 * anonymous (logged-out) AI calls, so that if a bot farm rotates IP addresses
 * to dodge the per-IP limiters the Groq bill still has a ceiling. Counts reset
 * when the UTC date changes; a restart also resets them (acceptable: it only
 * ever errs towards allowing a little more, never towards blocking real users).
 */
function createDailyBudget({ cap, now = () => new Date() }) {
  let day = null;
  let used = 0;

  function roll() {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = 0;
    }
  }

  return {
    /** Takes one unit from today's budget. Returns false (and takes nothing) once it's spent. */
    tryConsume() {
      roll();
      if (used >= cap) return false;
      used += 1;
      return true;
    },
    remaining() {
      roll();
      return Math.max(0, cap - used);
    },
  };
}

module.exports = { createDailyBudget };
