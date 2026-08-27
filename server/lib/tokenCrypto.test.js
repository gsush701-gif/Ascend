import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_KEY_HEX = "0123456789abcdef".repeat(4); // 64 hex chars = 32 bytes

describe("tokenCrypto — not configured (TOKEN_ENCRYPTION_KEY absent)", () => {
  const original = process.env.TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = original;
  });

  it("reports isTokenCryptoConfigured as false", async () => {
    const { isTokenCryptoConfigured } = await import("./tokenCrypto.js");
    expect(isTokenCryptoConfigured).toBe(false);
  });

  it("encryptToken fails closed (throws) rather than storing plaintext", async () => {
    const { encryptToken, TokenCryptoNotConfiguredError } = await import("./tokenCrypto.js");
    expect(() => encryptToken("gho_realtoken")).toThrow(TokenCryptoNotConfiguredError);
  });

  it("decryptToken also refuses to run", async () => {
    const { decryptToken, TokenCryptoNotConfiguredError } = await import("./tokenCrypto.js");
    expect(() => decryptToken("anything")).toThrow(TokenCryptoNotConfiguredError);
  });
});

describe("tokenCrypto — malformed key rejected (fails closed, not a weaker fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("treats a too-short hex key as not configured", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "abcd1234";
    const { isTokenCryptoConfigured } = await import("./tokenCrypto.js");
    expect(isTokenCryptoConfigured).toBe(false);
  });

  it("treats a non-hex string as not configured", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "not-a-hex-key-at-all-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
    const { isTokenCryptoConfigured } = await import("./tokenCrypto.js");
    expect(isTokenCryptoConfigured).toBe(false);
  });
});

describe("tokenCrypto — configured", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY_HEX;
  });
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("reports isTokenCryptoConfigured as true", async () => {
    const { isTokenCryptoConfigured } = await import("./tokenCrypto.js");
    expect(isTokenCryptoConfigured).toBe(true);
  });

  it("round-trips a real-shaped GitHub access token", async () => {
    const { encryptToken, decryptToken } = await import("./tokenCrypto.js");
    const token = "gho_16C7e42F292c6912E7710c838347Ae178B4a";
    const ciphertext = encryptToken(token);
    expect(ciphertext).not.toContain(token);
    expect(decryptToken(ciphertext)).toBe(token);
  });

  it("round-trips unicode and edge-case strings", async () => {
    const { encryptToken, decryptToken } = await import("./tokenCrypto.js");
    for (const token of ["a", "🔒 emoji token 🔑", "x".repeat(5000), "with:colons:in:it"]) {
      expect(decryptToken(encryptToken(token))).toBe(token);
    }
  });

  it("produces a different ciphertext each time (random IV) even for the same plaintext", async () => {
    const { encryptToken } = await import("./tokenCrypto.js");
    const a = encryptToken("same-token");
    const b = encryptToken("same-token");
    expect(a).not.toBe(b);
  });

  it("ciphertext is in the documented <iv>:<authTag>:<data> hex format", async () => {
    const { encryptToken } = await import("./tokenCrypto.js");
    const ciphertext = encryptToken("token123");
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) expect(part).toMatch(/^[0-9a-f]+$/);
    expect(Buffer.from(parts[0], "hex")).toHaveLength(12); // IV
    expect(Buffer.from(parts[1], "hex")).toHaveLength(16); // GCM auth tag
  });

  it("rejects empty-string plaintext", async () => {
    const { encryptToken } = await import("./tokenCrypto.js");
    expect(() => encryptToken("")).toThrow(TypeError);
  });

  // --- Tamper rejection: the core guarantee this module exists for ---

  it("rejects ciphertext with a flipped bit in the encrypted data", async () => {
    const { encryptToken, decryptToken, TokenDecryptionError } = await import("./tokenCrypto.js");
    const ciphertext = encryptToken("secret-access-token");
    const [iv, tag, data] = ciphertext.split(":");
    const dataBuf = Buffer.from(data, "hex");
    dataBuf[0] ^= 0xff; // flip the first byte
    const tampered = `${iv}:${tag}:${dataBuf.toString("hex")}`;
    expect(() => decryptToken(tampered)).toThrow(TokenDecryptionError);
  });

  it("rejects ciphertext with a tampered auth tag", async () => {
    const { encryptToken, decryptToken, TokenDecryptionError } = await import("./tokenCrypto.js");
    const ciphertext = encryptToken("secret-access-token");
    const [iv, tag, data] = ciphertext.split(":");
    const tagBuf = Buffer.from(tag, "hex");
    tagBuf[0] ^= 0xff;
    const tampered = `${iv}:${tagBuf.toString("hex")}:${data}`;
    expect(() => decryptToken(tampered)).toThrow(TokenDecryptionError);
  });

  it("rejects ciphertext with a substituted IV", async () => {
    const { encryptToken, decryptToken, TokenDecryptionError } = await import("./tokenCrypto.js");
    const a = encryptToken("token-a");
    const b = encryptToken("token-b");
    const [, tagA, dataA] = a.split(":");
    const [ivB] = b.split(":");
    const tampered = `${ivB}:${tagA}:${dataA}`;
    expect(() => decryptToken(tampered)).toThrow(TokenDecryptionError);
  });

  it("rejects a garbage/non-ciphertext string outright", async () => {
    const { decryptToken, TokenDecryptionError } = await import("./tokenCrypto.js");
    expect(() => decryptToken("not-valid-ciphertext")).toThrow(TokenDecryptionError);
    expect(() => decryptToken("")).toThrow(TokenDecryptionError);
    expect(() => decryptToken("a:b")).toThrow(TokenDecryptionError); // wrong part count
    expect(() => decryptToken("zz:zz:zz")).toThrow(TokenDecryptionError); // "zz" isn't valid hex
  });

  it("rejects ciphertext truncated mid-string", async () => {
    const { encryptToken, decryptToken, TokenDecryptionError } = await import("./tokenCrypto.js");
    const ciphertext = encryptToken("a-longer-secret-access-token-value");
    const truncated = ciphertext.slice(0, Math.floor(ciphertext.length / 2));
    expect(() => decryptToken(truncated)).toThrow(TokenDecryptionError);
  });

  it("fails decryption when a ciphertext from a different key is decrypted with this key", async () => {
    const { encryptToken } = await import("./tokenCrypto.js");
    const ciphertext = encryptToken("cross-key-token");

    vi.resetModules();
    process.env.TOKEN_ENCRYPTION_KEY = "f".repeat(64); // a different valid 32-byte hex key
    const { decryptToken, TokenDecryptionError } = await import("./tokenCrypto.js");
    expect(() => decryptToken(ciphertext)).toThrow(TokenDecryptionError);
  });
});
