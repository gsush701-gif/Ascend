const MIN_MESSAGE = 3;
const MAX_MESSAGE = 2000;
const MAX_EMAIL = 200;
const MAX_PAGE = 200;

/**
 * Validates the body of POST /api/feedback. Returns { ok: true, value } with
 * trimmed, length-capped fields, or { ok: false, error } with a message that is
 * safe to show the person. The email is optional and only loosely checked: it
 * is there so we can reply, not to authenticate anyone.
 *
 * @param {unknown} body
 */
function parseFeedback(body) {
  const b = body && typeof body === "object" ? body : {};

  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length < MIN_MESSAGE) {
    return { ok: false, error: "Please write a few words of feedback." };
  }
  if (message.length > MAX_MESSAGE) {
    return { ok: false, error: `Feedback must be ${MAX_MESSAGE} characters or fewer.` };
  }

  let email = null;
  if (typeof b.email === "string" && b.email.trim() !== "") {
    const e = b.email.trim();
    if (e.length > MAX_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return { ok: false, error: "That email address doesn't look right." };
    }
    email = e;
  }

  // Which screen the feedback came from. Only a path is wanted, never a query
  // string (it could carry a token or other personal data).
  let page = null;
  if (typeof b.page === "string" && b.page.startsWith("/")) {
    page = b.page.split(/[?#]/)[0].slice(0, MAX_PAGE);
  }

  return { ok: true, value: { message, email, page } };
}

module.exports = { parseFeedback, MAX_MESSAGE };
