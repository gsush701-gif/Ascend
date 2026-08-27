import { describe, it, expect } from "vitest";
import {
  nextVersionNumber,
  defaultVersionName,
  resolveDisplayName,
  duplicateVersionName,
  pickPromotedVersion,
} from "./versionLogic";

describe("nextVersionNumber", () => {
  it("starts at 1 for a role with no versions", () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it("returns max + 1", () => {
    expect(nextVersionNumber([1])).toBe(2);
    expect(nextVersionNumber([1, 2, 3])).toBe(4);
  });

  it("is not fooled by out-of-order input", () => {
    expect(nextVersionNumber([3, 1, 2])).toBe(4);
  });

  it("ignores gaps left by earlier deletes (never reuses a number)", () => {
    expect(nextVersionNumber([1, 5])).toBe(6);
  });
});

describe("defaultVersionName / resolveDisplayName", () => {
  it("formats a default name from the version number", () => {
    expect(defaultVersionName(3)).toBe("Version 3");
  });

  it("prefers a real name when present", () => {
    expect(resolveDisplayName("My Great Draft", 3)).toBe("My Great Draft");
  });

  it("falls back to the default for null/undefined/blank names", () => {
    expect(resolveDisplayName(null, 3)).toBe("Version 3");
    expect(resolveDisplayName(undefined, 3)).toBe("Version 3");
    expect(resolveDisplayName("   ", 3)).toBe("Version 3");
  });

  it("trims a real name", () => {
    expect(resolveDisplayName("  Padded  ", 1)).toBe("Padded");
  });
});

describe("duplicateVersionName", () => {
  it("prefixes a named version", () => {
    expect(duplicateVersionName("Cover letter for Acme", 2)).toBe(
      "Copy of Cover letter for Acme",
    );
  });

  it("prefixes the default name when the original is unnamed", () => {
    expect(duplicateVersionName(null, 2)).toBe("Copy of Version 2");
    expect(duplicateVersionName("", 2)).toBe("Copy of Version 2");
  });
});

describe("pickPromotedVersion", () => {
  it("returns null when nothing remains", () => {
    expect(pickPromotedVersion([])).toBeNull();
  });

  it("promotes the highest version number", () => {
    const result = pickPromotedVersion([
      { id: "a", versionNumber: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", versionNumber: 3, updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "c", versionNumber: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(result?.id).toBe("b");
  });

  it("breaks ties on updatedAt (most recent wins)", () => {
    const result = pickPromotedVersion([
      { id: "old", versionNumber: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", versionNumber: 2, updatedAt: "2026-02-01T00:00:00.000Z" },
    ]);
    expect(result?.id).toBe("new");
  });

  it("never promotes the just-deleted version (it is simply not in the input)", () => {
    // Simulates deleting the active version (versionNumber: 5) — the caller
    // passes only the versions that remain after the delete.
    const remainingAfterDeletingActive = [
      { id: "keep-1", versionNumber: 3, updatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "keep-2", versionNumber: 4, updatedAt: "2026-01-03T00:00:00.000Z" },
    ];
    const result = pickPromotedVersion(remainingAfterDeletingActive);
    expect(result?.id).toBe("keep-2");
  });

  it("returns the single remaining version when only one is left", () => {
    const result = pickPromotedVersion([
      { id: "only", versionNumber: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(result?.id).toBe("only");
  });
});
