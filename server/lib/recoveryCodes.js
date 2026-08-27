// MFA recovery codes (Phase 7 Task 10 — MFA). Supabase's native TOTP MFA
// API (auth.mfa.enroll/challenge/verify/unenroll) does not provide
// traditional single-use recovery codes — verified against the installed
// @supabase/supabase-js@2.112.4 (@supabase/auth-js@2.112.4) type defs: the
// only public MFA surface is enroll/challenge/verify/challengeAndVerify/
// unenroll/listFactors/getAuthenticatorAssuranceLevel (see
// node_modules/@supabase/auth-js/dist/main/lib/types.d.ts's GoTrueMFAApi) —
// nothing recovery-code-shaped exists. This file is the app-level
// complement: generation, hashing, and constant-time verification of codes
// stored (as salted hashes only) in `mfa_recovery_codes`
// (supabase/migrations/022_mfa_recovery_codes.sql).
//
// Uses Node's built-in `crypto` only — no new dependency, same convention as
// server/lib/tokenCrypto.js. Unlike tokenCrypto's AES (reversible, because
// the plaintext GitHub token must be read back later), recovery codes use
// one-way salted scrypt hashing, like a password: the plaintext is shown to
// the user exactly once at generation time and is never recoverable again.

const crypto = require("crypto");

// Excludes visually-ambiguous characters (0/O, 1/I/L) so a code copied onto
// paper or read off a screen is never misread.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_CHARS = 10; // split into two groups of 5 for readability, e.g. "AB3XZ-7HK2Q"
const DEFAULT_COUNT = 10;
const SCRYPT_KEYLEN = 64;
const SALT_LENGTH_BYTES = 16;

/** Uppercases and strips whitespace/dashes so formatting doesn't affect matching. */
function normalizeCode(code) {
  return String(code == null ? "" : code)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

function randomCode() {
  const bytes = crypto.randomBytes(CODE_CHARS);
  let out = "";
  for (let i = 0; i < CODE_CHARS; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/**
 * Generates `count` unique plaintext recovery codes (formatted "XXXXX-XXXXX").
 * Uniqueness is enforced within the batch via a Set — collision odds are
 * already astronomically low (32^10 space) but this makes the guarantee
 * exact rather than probabilistic.
 * @param {number} [count]
 * @returns {string[]}
 */
function generateRecoveryCodes(count = DEFAULT_COUNT) {
  const codes = new Set();
  while (codes.size < count) {
    codes.add(randomCode());
  }
  return Array.from(codes);
}

/**
 * Hashes one plaintext code for storage. Format: `<saltHex>:<hashHex>`,
 * mirroring tokenCrypto's single-string-per-column convention.
 * @param {string} code
 * @returns {string}
 */
function hashRecoveryCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    throw new TypeError("hashRecoveryCode: code must be a non-empty string");
  }
  const salt = crypto.randomBytes(SALT_LENGTH_BYTES);
  const derived = crypto.scryptSync(normalized, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/**
 * Constant-time check of a plaintext code against one stored hash. Never
 * throws on malformed input/storage — returns false instead, since a
 * corrupt row should fail closed (reject), not crash the request.
 * @param {string} code plaintext, as submitted by the user
 * @param {string} storedHash `<saltHex>:<hashHex>`, from hashRecoveryCode()
 * @returns {boolean}
 */
function verifyRecoveryCodeHash(code, storedHash) {
  if (typeof storedHash !== "string" || !storedHash.includes(":")) return false;
  const normalized = normalizeCode(code);
  if (!normalized) return false;

  const [saltHex, hashHex] = storedHash.split(":");
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length !== SALT_LENGTH_BYTES || expected.length !== SCRYPT_KEYLEN) return false;
    const derived = crypto.scryptSync(normalized, salt, expected.length);
    return crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

/**
 * Pure matching logic for POST /api/mfa/verify-recovery-code: given the
 * caller's stored recovery-code rows and a submitted plaintext code, finds
 * the id of the single unused row whose hash matches, or null. Deliberately
 * does NOT touch the database — the route handler uses the returned id to
 * mark that one row used (`update ... set used_at = now()`), which keeps
 * this function pure and unit-testable without mocking Supabase, and keeps
 * the single source of truth for "is this row already used" in the caller's
 * fetched snapshot rather than duplicated here.
 * @param {Array<{ id: string, code_hash: string, used_at: string|null }>} rows
 * @param {string} submittedCode
 * @returns {string|null} the matching row's id, or null if no unused row matches
 */
function findMatchingUnusedCode(rows, submittedCode) {
  if (!Array.isArray(rows)) return null;
  const normalized = normalizeCode(submittedCode);
  if (!normalized) return null;

  for (const row of rows) {
    if (!row || row.used_at) continue; // used codes are never eligible again
    if (verifyRecoveryCodeHash(normalized, row.code_hash)) {
      return row.id;
    }
  }
  return null;
}

module.exports = {
  DEFAULT_COUNT,
  normalizeCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCodeHash,
  findMatchingUnusedCode,
};
