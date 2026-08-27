// AES-256-GCM encryption for the GitHub OAuth access token at rest
// (Phase 7 Task 9 — GitHub integration). Uses Node's built-in `crypto`
// module only — no new dependency needed. Gated behind TOKEN_ENCRYPTION_KEY
// (a 32-byte key, hex-encoded — generate one with `openssl rand -hex 32`,
// documented in server/.env.example). If that env var isn't set, the whole
// GitHub integration must refuse to store new tokens rather than storing
// them in plaintext or silently skipping encryption — see
// `isTokenCryptoConfigured` below and its use in server/lib/github.js's
// `isGithubConfigured`.
//
// Ciphertext format (single string, so it fits in one `text` column):
//   <ivHex>:<authTagHex>:<ciphertextHex>
// GCM's authentication tag is what makes `decryptToken` fail loudly on any
// tampering (a flipped bit, a truncated string, a wrong key) instead of
// silently returning corrupted plaintext — see tokenCrypto.test.js for the
// tamper-rejection cases this is verified against.

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // 96-bit IV, the GCM-recommended size

const rawKey = process.env.TOKEN_ENCRYPTION_KEY;

function parseKey(hex) {
  if (!hex) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  const buf = Buffer.from(hex, "hex");
  return buf.length === KEY_LENGTH_BYTES ? buf : null;
}

const key = parseKey(rawKey);
const isTokenCryptoConfigured = Boolean(key);

if (!isTokenCryptoConfigured) {
  console.warn(
    "[tokenCrypto] TOKEN_ENCRYPTION_KEY not set (or not a valid 32-byte hex " +
      "string) — token encryption is disabled. The GitHub integration will " +
      "refuse to store new tokens until this is configured. Generate one " +
      "with: openssl rand -hex 32",
  );
}

class TokenCryptoNotConfiguredError extends Error {
  constructor() {
    super("TOKEN_ENCRYPTION_KEY is not configured on the server — refusing to store a token unencrypted.");
    this.name = "TokenCryptoNotConfiguredError";
    this.statusCode = 503;
  }
}

class TokenDecryptionError extends Error {
  constructor(message = "Failed to decrypt token — ciphertext is invalid, tampered with, or was encrypted with a different key.") {
    super(message);
    this.name = "TokenDecryptionError";
  }
}

/**
 * Encrypts `plaintext` (the real GitHub access token) into a single string
 * safe to store in a `text` column. Fails closed — throws
 * TokenCryptoNotConfiguredError rather than storing plaintext or a weaker
 * fallback — if TOKEN_ENCRYPTION_KEY isn't configured.
 * @param {string} plaintext
 * @returns {string} `<ivHex>:<authTagHex>:<ciphertextHex>`
 */
function encryptToken(plaintext) {
  if (!isTokenCryptoConfigured) throw new TokenCryptoNotConfiguredError();
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new TypeError("encryptToken: plaintext must be a non-empty string");
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string produced by `encryptToken`. Throws TokenDecryptionError
 * (never returns silently-wrong data) if the ciphertext is malformed, was
 * tampered with, or was encrypted under a different key — GCM's
 * authentication tag guarantees this. Throws TokenCryptoNotConfiguredError
 * if TOKEN_ENCRYPTION_KEY isn't set.
 * @param {string} ciphertext `<ivHex>:<authTagHex>:<ciphertextHex>`
 * @returns {string} the original plaintext
 */
function decryptToken(ciphertext) {
  if (!isTokenCryptoConfigured) throw new TokenCryptoNotConfiguredError();
  if (typeof ciphertext !== "string") {
    throw new TokenDecryptionError("Ciphertext must be a string.");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new TokenDecryptionError("Ciphertext is not in the expected <iv>:<authTag>:<data> format.");
  }
  const [ivHex, authTagHex, dataHex] = parts;

  let iv, authTag, data;
  try {
    iv = Buffer.from(ivHex, "hex");
    authTag = Buffer.from(authTagHex, "hex");
    data = Buffer.from(dataHex, "hex");
  } catch {
    throw new TokenDecryptionError("Ciphertext contains invalid hex.");
  }

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== 16 || data.length === 0) {
    throw new TokenDecryptionError("Ciphertext has malformed component lengths.");
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (e) {
    // createDecipheriv/final() throw on an invalid auth tag (tampered
    // ciphertext) or a key mismatch — never return partial/garbage plaintext.
    throw new TokenDecryptionError(`Token decryption failed: ${e.message}`);
  }
}

module.exports = {
  isTokenCryptoConfigured,
  encryptToken,
  decryptToken,
  TokenCryptoNotConfiguredError,
  TokenDecryptionError,
};
