// Keeps personal details out of places that don't need them: the AI provider,
// the error tracker, and the analytics table. Everything here is a pure
// function so it can be tested without any service running.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// North-American style numbers with an optional country code, written with
// brackets, spaces, dots or dashes: (555) 123-4567, 555.123.4567, +1 555 123 4567.
// The lookarounds stop it from biting into longer runs of digits.
const PHONE_RE = /(?<![\d.])(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

/**
 * Replaces email addresses and phone numbers in resume text with placeholders
 * before the text is sent to the AI provider. Scoring a resume against a job,
 * or rewording a bullet, never needs to know how to reach the student, so
 * those details stay on our side. Placeholders (not blanks) are used so the
 * model can still tell the resume has contact details.
 *
 * Not for prompts that must reproduce the details, such as reading a resume
 * into the editor or writing a cover letter header.
 *
 * @param {unknown} text
 * @returns {string}
 */
function redactContactDetails(text) {
  if (typeof text !== "string" || !text) return "";
  return text.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
}

const SENSITIVE_HEADER_RE = /^(authorization|cookie|set-cookie|x-cron-secret|stripe-signature|x-api-key)$/i;

/**
 * Strips user content from an error report before it leaves the server. The
 * tracker attaches the incoming request to each error, and here a request
 * body is a resume, a job description, an interview answer or a recovery
 * code. An error report needs the route and the stack trace, not those.
 *
 * Removes the request body, cookies and query string, drops credential
 * headers, and keeps only the id of the user. Returns the same event object.
 *
 * @param {any} event
 */
function scrubErrorEvent(event) {
  if (!event || typeof event !== "object") return event;

  const request = event.request;
  if (request && typeof request === "object") {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    if (typeof request.url === "string") request.url = request.url.split(/[?#]/)[0];
    if (request.headers && typeof request.headers === "object") {
      for (const name of Object.keys(request.headers)) {
        if (SENSITIVE_HEADER_RE.test(name)) delete request.headers[name];
      }
    }
  }

  if (event.user && typeof event.user === "object") {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  return event;
}

const MAX_METADATA_KEYS = 10;
const MAX_METADATA_STRING = 100;

/**
 * Cleans the `metadata` of a product event sent by the browser to POST
 * /api/track. Only short, flat values are kept (a few strings, numbers and
 * booleans), so the events table cannot be used to store free text.
 *
 * `vid` is the random per-browser id used to count visitors on the logged-out
 * pages. It is promised to be unconnected to any account, so it is dropped
 * from events sent by a signed-in user: those are counted by user id instead.
 *
 * @param {unknown} metadata
 * @param {{ signedIn?: boolean }} [opts]
 * @returns {Record<string, string | number | boolean> | null}
 */
function sanitizeTrackMetadata(metadata, { signedIn = false } = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;

  const out = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (kept >= MAX_METADATA_KEYS) break;
    if (!/^[A-Za-z0-9_]{1,40}$/.test(key)) continue;
    if (signedIn && key === "vid") continue;
    if (typeof value === "string") {
      out[key] = value.slice(0, MAX_METADATA_STRING);
    } else if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      out[key] = value;
    } else {
      continue;
    }
    kept += 1;
  }
  return kept > 0 ? out : null;
}

module.exports = { redactContactDetails, scrubErrorEvent, sanitizeTrackMetadata };
