// Guard rails for the job-tailored bullet rewrites (POST /api/tailor-bullets).
//
// The model is told never to invent facts, but a prompt is a request, not a
// guarantee, and a made-up number on a resume can cost a student the interview.
// So every suggestion is checked here before it is returned:
//   - the "original" it quotes must really be on the resume (no invented lines);
//   - the rewrite must not contain a number the original didn't (no invented
//     results); numbers inside [bracketed blanks] are placeholders and ignored;
//   - the "fill in" list is read from the brackets in the rewrite itself, never
//     from what the model claims.
// Anything that fails is dropped rather than repaired.

const MAX_BULLETS = 5;

/** Lowercase, collapse whitespace, strip leading bullet marks and smart quotes. */
function norm(text) {
  return String(text || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripBullet(text) {
  return String(text || "").replace(/^\s*[-•*·▪●–—]+\s*/, "").trim();
}

/** The [bracketed blanks] in a rewrite, without the brackets. */
function placeholdersIn(text) {
  const out = [];
  const re = /\[([^\]]{1,80})\]/g;
  let m;
  while ((m = re.exec(String(text || "")))) out.push(m[1].trim());
  return out;
}

const NUMBER_WORDS = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16",
  seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50",
  hundred: "100", hundreds: "100s", thousand: "1000", thousands: "1000s", million: "1000000",
  dozen: "12", dozens: "12s", half: "half", halved: "half", halving: "half", double: "double", doubled: "double", triple: "triple",
  tripled: "triple", twice: "twice",
};

/**
 * Number-like tokens, ignoring bracketed placeholders: digits (commas removed)
 * and number words normalised to digits, so "four" and "4" are the same number
 * and "cut it in half" counts as a claim that must already be in the original.
 */
function numbersIn(text) {
  const withoutBlanks = String(text || "").replace(/\[[^\]]*\]/g, " ");
  const out = new Set();
  for (const n of withoutBlanks.match(/\d[\d,]*(?:\.\d+)?/g) || []) out.add(n.replace(/,/g, ""));
  for (const word of withoutBlanks.toLowerCase().match(/[a-z]+/g) || []) {
    if (NUMBER_WORDS[word]) out.add(NUMBER_WORDS[word]);
  }
  return out;
}

// Verbs that claim more ownership than "helped" or "worked on". If the rewrite
// uses one and the original did not, the student is being talked up.
const OWNERSHIP_VERBS =
  /\b(led|lead|leading|owned|owning|managed|managing|directed|architected|spearheaded|pioneered|orchestrated|headed|founded|drove|oversaw)\b/i;

function claimsMoreOwnership(original, rewritten) {
  const match = String(rewritten).match(OWNERSHIP_VERBS);
  return Boolean(match) && !new RegExp(`\\b${match[1]}\\b`, "i").test(original);
}

/**
 * @param {unknown} raw the parsed model output, expected `{ bullets: [...] }`
 * @param {string} resumeText the resume the bullets must come from
 * @returns {{ original: string, rewritten: string, why: string, needs: string[] }[]}
 */
function validateTailoredBullets(raw, resumeText) {
  const list = raw && Array.isArray(raw.bullets) ? raw.bullets : [];
  const haystack = norm(resumeText);
  const kept = [];
  const seen = new Set();

  for (const b of list) {
    if (kept.length >= MAX_BULLETS) break;
    if (!b || typeof b.original !== "string" || typeof b.rewritten !== "string") continue;

    const original = stripBullet(b.original);
    const rewritten = stripBullet(b.rewritten);
    if (original.length < 12 || rewritten.length < 15 || rewritten.length > 400) continue;
    if (norm(original) === norm(rewritten)) continue;
    // The quoted line has to genuinely be on the resume.
    if (!haystack.includes(norm(original))) continue;
    if (seen.has(norm(original))) continue;

    // No invented results: every number in the rewrite must already be in the original.
    const allowed = numbersIn(original);
    let invented = false;
    for (const n of numbersIn(rewritten)) {
      if (!allowed.has(n)) {
        invented = true;
        break;
      }
    }
    if (invented) continue;
    // No talking the student up: "helped" must not become "led".
    if (claimsMoreOwnership(original, rewritten)) continue;

    seen.add(norm(original));
    kept.push({
      original,
      rewritten,
      why: typeof b.why === "string" ? b.why.trim().slice(0, 220) : "",
      needs: placeholdersIn(rewritten).slice(0, 3),
    });
  }
  return kept;
}

module.exports = { validateTailoredBullets, placeholdersIn, numbersIn, MAX_BULLETS };
