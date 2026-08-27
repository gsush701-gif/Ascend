import { describe, it, expect } from "vitest";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCodeHash,
  findMatchingUnusedCode,
  normalizeCode,
  DEFAULT_COUNT,
} from "./recoveryCodes.js";

describe("normalizeCode", () => {
  it("uppercases, trims, and strips dashes/whitespace", () => {
    expect(normalizeCode(" ab3xz-7hk2q ")).toBe("AB3XZ7HK2Q");
  });

  it("returns an empty string for null/undefined/blank input", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(undefined)).toBe("");
    expect(normalizeCode("   ")).toBe("");
  });
});

describe("generateRecoveryCodes — generation produces unique codes", () => {
  it("generates the default count of codes", () => {
    expect(generateRecoveryCodes()).toHaveLength(DEFAULT_COUNT);
  });

  it("generates a requested count of codes", () => {
    expect(generateRecoveryCodes(5)).toHaveLength(5);
    expect(generateRecoveryCodes(20)).toHaveLength(20);
  });

  it("every generated code is unique within the batch", () => {
    const codes = generateRecoveryCodes(50);
    expect(new Set(codes).size).toBe(50);
  });

  it("every code matches the XXXXX-XXXXX format with an unambiguous alphabet", () => {
    const codes = generateRecoveryCodes(30);
    for (const code of codes) {
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });

  it("two separate calls don't produce overlapping codes (astronomically unlikely, but confirms no shared/reset PRNG state)", () => {
    const batch1 = generateRecoveryCodes(20);
    const batch2 = generateRecoveryCodes(20);
    const overlap = batch1.filter((c) => batch2.includes(c));
    expect(overlap).toEqual([]);
  });
});

describe("hashRecoveryCode / verifyRecoveryCodeHash — round trip", () => {
  it("a freshly generated code verifies against its own hash", () => {
    const [code] = generateRecoveryCodes(1);
    const hash = hashRecoveryCode(code);
    expect(verifyRecoveryCodeHash(code, hash)).toBe(true);
  });

  it("verification is case-insensitive and dash-insensitive (matches normalizeCode)", () => {
    const hash = hashRecoveryCode("AB3XZ-7HK2Q");
    expect(verifyRecoveryCodeHash("ab3xz7hk2q", hash)).toBe(true);
    expect(verifyRecoveryCodeHash(" AB3XZ-7HK2Q ", hash)).toBe(true);
  });

  it("a wrong code is rejected", () => {
    const hash = hashRecoveryCode("AB3XZ-7HK2Q");
    expect(verifyRecoveryCodeHash("ZZZZZ-ZZZZZ", hash)).toBe(false);
  });

  it("two hashes of the same plaintext differ (random salt per call)", () => {
    const hash1 = hashRecoveryCode("AB3XZ-7HK2Q");
    const hash2 = hashRecoveryCode("AB3XZ-7HK2Q");
    expect(hash1).not.toBe(hash2);
    expect(verifyRecoveryCodeHash("AB3XZ-7HK2Q", hash1)).toBe(true);
    expect(verifyRecoveryCodeHash("AB3XZ-7HK2Q", hash2)).toBe(true);
  });

  it("throws on an empty/blank plaintext rather than hashing an empty string", () => {
    expect(() => hashRecoveryCode("")).toThrow();
    expect(() => hashRecoveryCode("   ")).toThrow();
  });

  it("rejects malformed stored hashes instead of throwing", () => {
    expect(verifyRecoveryCodeHash("AB3XZ-7HK2Q", "not-a-valid-hash")).toBe(false);
    expect(verifyRecoveryCodeHash("AB3XZ-7HK2Q", "")).toBe(false);
    expect(verifyRecoveryCodeHash("AB3XZ-7HK2Q", null)).toBe(false);
    expect(verifyRecoveryCodeHash("AB3XZ-7HK2Q", "deadbeef:notevenhex!!")).toBe(false);
  });

  it("rejects an empty/blank submitted code against a real hash", () => {
    const hash = hashRecoveryCode("AB3XZ-7HK2Q");
    expect(verifyRecoveryCodeHash("", hash)).toBe(false);
    expect(verifyRecoveryCodeHash(null, hash)).toBe(false);
  });
});

describe("findMatchingUnusedCode — the pure matching logic behind POST /api/mfa/verify-recovery-code", () => {
  function makeRows(plaintexts) {
    return plaintexts.map((code, i) => ({
      id: `row-${i}`,
      code_hash: hashRecoveryCode(code),
      used_at: null,
    }));
  }

  it("the correct code matches its row and returns that row's id", () => {
    const rows = makeRows(["AAAAA-11111", "BBBBB-22222", "CCCCC-33333"]);
    expect(findMatchingUnusedCode(rows, "BBBBB-22222")).toBe("row-1");
  });

  it("a wrong code is rejected (returns null)", () => {
    const rows = makeRows(["AAAAA-11111", "BBBBB-22222"]);
    expect(findMatchingUnusedCode(rows, "ZZZZZ-99999")).toBeNull();
  });

  it("a used code is rejected on a second attempt, even though the hash still matches", () => {
    const rows = makeRows(["AAAAA-11111", "BBBBB-22222"]);
    // First attempt succeeds.
    const matchedId = findMatchingUnusedCode(rows, "AAAAA-11111");
    expect(matchedId).toBe("row-0");

    // The route handler would now mark that row used — simulate that here,
    // then confirm the same plaintext code no longer matches anything.
    rows[0].used_at = new Date().toISOString();
    expect(findMatchingUnusedCode(rows, "AAAAA-11111")).toBeNull();

    // The other, still-unused code is unaffected.
    expect(findMatchingUnusedCode(rows, "BBBBB-22222")).toBe("row-1");
  });

  it("returns null for an empty rows array", () => {
    expect(findMatchingUnusedCode([], "AAAAA-11111")).toBeNull();
  });

  it("returns null for non-array input instead of throwing", () => {
    expect(findMatchingUnusedCode(null, "AAAAA-11111")).toBeNull();
    expect(findMatchingUnusedCode(undefined, "AAAAA-11111")).toBeNull();
  });

  it("returns null for a blank submitted code", () => {
    const rows = makeRows(["AAAAA-11111"]);
    expect(findMatchingUnusedCode(rows, "")).toBeNull();
    expect(findMatchingUnusedCode(rows, null)).toBeNull();
  });

  it("skips null/undefined row entries without throwing", () => {
    const rows = [null, ...makeRows(["AAAAA-11111"]), undefined];
    expect(findMatchingUnusedCode(rows, "AAAAA-11111")).toBe("row-0");
  });

  it("is case/format tolerant end to end", () => {
    const rows = makeRows(["AB3XZ-7HK2Q"]);
    expect(findMatchingUnusedCode(rows, "ab3xz7hk2q")).toBe("row-0");
  });
});
