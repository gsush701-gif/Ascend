import { describe, it, expect } from "vitest";
import { getResumeStoragePathsToDelete } from "./accountDeletion.js";

describe("getResumeStoragePathsToDelete — Storage cleanup targets for account deletion", () => {
  it("extracts storage_path from each row", () => {
    const rows = [{ storage_path: "user-1/a.pdf" }, { storage_path: "user-1/b.pdf" }];
    expect(getResumeStoragePathsToDelete(rows)).toEqual(["user-1/a.pdf", "user-1/b.pdf"]);
  });

  it("returns an empty array for no rows", () => {
    expect(getResumeStoragePathsToDelete([])).toEqual([]);
  });

  it("returns an empty array for null/undefined input rather than throwing", () => {
    expect(getResumeStoragePathsToDelete(null)).toEqual([]);
    expect(getResumeStoragePathsToDelete(undefined)).toEqual([]);
  });

  it("skips null/undefined row entries", () => {
    const rows = [null, { storage_path: "user-1/a.pdf" }, undefined];
    expect(getResumeStoragePathsToDelete(rows)).toEqual(["user-1/a.pdf"]);
  });

  it("skips rows with a missing, non-string, or blank storage_path", () => {
    const rows = [
      {},
      { storage_path: null },
      { storage_path: 12345 },
      { storage_path: "" },
      { storage_path: "   " },
      { storage_path: "user-1/valid.pdf" },
    ];
    expect(getResumeStoragePathsToDelete(rows)).toEqual(["user-1/valid.pdf"]);
  });

  it("deduplicates repeated storage paths (e.g. a re-uploaded/overwritten resume)", () => {
    const rows = [
      { storage_path: "user-1/a.pdf" },
      { storage_path: "user-1/a.pdf" },
      { storage_path: "user-1/b.pdf" },
    ];
    expect(getResumeStoragePathsToDelete(rows)).toEqual(["user-1/a.pdf", "user-1/b.pdf"]);
  });

  it("includes soft-deleted resume rows — deleteResume() only sets deleted_at and never removes the Storage object", () => {
    const rows = [
      { storage_path: "user-1/kept.pdf", deleted_at: null },
      { storage_path: "user-1/soft-deleted.pdf", deleted_at: "2026-01-01T00:00:00.000Z" },
    ];
    expect(getResumeStoragePathsToDelete(rows)).toEqual(["user-1/kept.pdf", "user-1/soft-deleted.pdf"]);
  });
});
