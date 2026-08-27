// GitHub OAuth integration (Phase 7 Task 9). No GitHub OAuth App is
// registered for this project — GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET don't
// exist anywhere, and creating them requires the owner's own GitHub account
// and dashboard action (see server/.env.example for the exact steps). This
// module builds the real, working architecture gated behind those env vars
// (plus TOKEN_ENCRYPTION_KEY — see server/lib/tokenCrypto.js) being present,
// following this codebase's "configured-or-honest-no-op" convention
// (server/lib/stripe.js, server/lib/jobProviders/). `isGithubConfigured`
// governs whether GET /api/github/connect (server/index.js) returns a real
// authorize URL or a clear "not configured" response.
//
// --- CSRF state protection ---
// GitHub's OAuth callback (GET /api/github/callback) is a plain browser
// redirect with no Authorization header, so it can't use this app's normal
// optionalAuth/req.user pattern to know which user is completing the flow,
// and it must defend against a forged callback (an attacker tricking a
// victim's browser into completing an OAuth flow the attacker initiated,
// linking the attacker's GitHub account to the victim's Ascend account).
// Rather than adding a new short-lived-state DB table, the `state` value
// GitHub round-trips is a self-contained, HMAC-signed token:
//   base64url(JSON{ uid, exp, nonce }) + "." + HMAC-SHA256(payload)
// signed with TOKEN_ENCRYPTION_KEY (already required for this feature to be
// configured at all, so no separate secret to manage). `verifyState` checks
// the signature with a constant-time comparison, then checks expiry — a
// tampered uid/exp, a wrong signature, or an expired state are all rejected
// before the callback ever exchanges the code or touches the database.

const crypto = require("crypto");
const { isTokenCryptoConfigured } = require("./tokenCrypto");

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI; // this server's own public /api/github/callback URL — must exactly match what's registered in the GitHub OAuth App
const STATE_SECRET = process.env.TOKEN_ENCRYPTION_KEY; // reused: already a required, securely-generated secret when this feature is configured

const isGithubConfigured = Boolean(
  GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && GITHUB_REDIRECT_URI && isTokenCryptoConfigured,
);

if (!isGithubConfigured) {
  console.warn(
    "[github] GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_REDIRECT_URI / TOKEN_ENCRYPTION_KEY not all set — " +
      "the GitHub integration is disabled. GET /api/github/connect returns a clear " +
      "'not configured' response instead of a broken OAuth redirect.",
  );
}

/** This server's own registered callback URL — only meaningful once `isGithubConfigured` is true. */
function getRedirectUri() {
  return GITHUB_REDIRECT_URI;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough for a real GitHub authorize+consent flow, short enough to limit replay window

/** Public repos only unless the user explicitly opts in — see the route's
 * `includePrivate` handling and the "Design" doc comment on the connect route. */
function buildScope(includePrivate) {
  return includePrivate ? "read:user,repo" : "read:user,public_repo";
}

function base64UrlEncode(buf) {
  return buf.toString("base64url");
}
function base64UrlDecode(str) {
  return Buffer.from(str, "base64url");
}

function sign(payloadB64) {
  return crypto.createHmac("sha256", STATE_SECRET).update(payloadB64).digest("base64url");
}

/**
 * Generates a signed, expiring, per-user CSRF state token. Never persisted
 * server-side — the token itself is the only source of truth, verified by
 * `verifyState` below.
 * @param {string} userId
 * @returns {string}
 */
function generateState(userId) {
  if (!STATE_SECRET) throw new Error("[github] Cannot generate OAuth state: TOKEN_ENCRYPTION_KEY is not configured.");
  const payload = {
    uid: userId,
    exp: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Verifies a state token produced by `generateState`. Returns
 * `{ valid: true, userId }` or `{ valid: false, reason }` — never throws for
 * a malformed/tampered/expired token, so callers can always branch cleanly.
 * @param {string} state
 * @returns {{ valid: boolean, userId?: string, reason?: string }}
 */
function verifyState(state) {
  if (!STATE_SECRET) return { valid: false, reason: "not_configured" };
  if (typeof state !== "string" || !state) return { valid: false, reason: "missing" };

  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return { valid: false, reason: "malformed" };
  const payloadB64 = state.slice(0, dotIndex);
  const providedSig = state.slice(dotIndex + 1);

  let expectedSigBuf, providedSigBuf;
  try {
    expectedSigBuf = Buffer.from(sign(payloadB64), "base64url");
    providedSigBuf = Buffer.from(providedSig, "base64url");
  } catch {
    return { valid: false, reason: "malformed" };
  }
  // timingSafeEqual throws on a length mismatch — check that first (a
  // length mismatch isn't itself a secret-dependent signal, it's just wrong).
  if (
    expectedSigBuf.length !== providedSigBuf.length ||
    !crypto.timingSafeEqual(expectedSigBuf, providedSigBuf)
  ) {
    return { valid: false, reason: "bad_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (!payload || typeof payload.uid !== "string" || typeof payload.exp !== "number") {
    return { valid: false, reason: "malformed" };
  }
  if (Date.now() > payload.exp) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, userId: payload.uid };
}

/**
 * Builds the GitHub OAuth authorize URL. Only ever called once
 * `isGithubConfigured` is true.
 */
function buildAuthorizeUrl({ state, redirectUri, includePrivate }) {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: buildScope(includePrivate),
    state,
    allow_signup: "false",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges an OAuth `code` for an access token. Throws on any failure —
 * callers (the /api/github/callback route) are responsible for catching and
 * returning a clean error redirect rather than leaking this failure's
 * details to the browser.
 */
async function exchangeCodeForToken(code, redirectUri) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || "GitHub token exchange failed");
  }
  return { accessToken: data.access_token, scope: data.scope || "" };
}

async function githubApiRequest(path, accessToken) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Ascend-App",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API request to ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Fetches the authenticated GitHub user's login/id — used right after the
 * token exchange to know who just connected. */
async function fetchGithubUser(accessToken) {
  const user = await githubApiRequest("/user", accessToken);
  return { login: user.login, id: user.id };
}

/**
 * Lists the authenticated user's own repositories (owner-affiliated only —
 * not every repo they can merely see, e.g. as an org member), newest-pushed
 * first, up to `perPage` per call. Deliberately does NOT call GitHub's
 * per-repo languages endpoint (that's one extra API call per repo, and this
 * list can be dozens of repos) — the single-call `/user/repos` response
 * already includes each repo's primary `language`, which is folded into a
 * one-entry `languages` object here so the DB column's shape stays
 * consistent with what a future richer sync could populate. This is a
 * deliberate scope-vs-API-call-count tradeoff, not an oversight.
 */
async function fetchGithubRepos(accessToken, { perPage = 100, page = 1 } = {}) {
  const params = new URLSearchParams({
    affiliation: "owner",
    sort: "pushed",
    direction: "desc",
    per_page: String(Math.min(perPage, 100)),
    page: String(page),
  });
  const repos = await githubApiRequest(`/user/repos?${params.toString()}`, accessToken);
  return (Array.isArray(repos) ? repos : []).map((r) => ({
    githubRepoId: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description || null,
    languages: r.language ? { [r.language]: true } : null,
    topics: Array.isArray(r.topics) ? r.topics : [],
    isPrivate: Boolean(r.private),
    pushedAt: r.pushed_at || null,
  }));
}

module.exports = {
  isGithubConfigured,
  getRedirectUri,
  buildScope,
  generateState,
  verifyState,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGithubUser,
  fetchGithubRepos,
};
