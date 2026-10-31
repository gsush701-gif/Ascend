import { describe, it, expect } from "vitest";
import { getResumeStoragePathsToDelete, getUserFolderObjectPaths, isSubscriptionAlreadyGone, USER_FOLDER_BUCKETS } from "./accountDeletion.js";

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

describe("getUserFolderObjectPaths — per-role PDF cleanup for account deletion", () => {
  it("prefixes each listed file with the user's folder", () => {
    const listing = [{ name: "role1-abc.pdf" }, { name: "role2-def.pdf" }];
    expect(getUserFolderObjectPaths("user-1", listing)).toEqual(["user-1/role1-abc.pdf", "user-1/role2-def.pdf"]);
  });

  it("skips entries with no usable name and tolerates bad input", () => {
    expect(getUserFolderObjectPaths("user-1", [null, {}, { name: "  " }, { name: 5 }, { name: "ok.pdf" }])).toEqual([
      "user-1/ok.pdf",
    ]);
    expect(getUserFolderObjectPaths("user-1", null)).toEqual([]);
    expect(getUserFolderObjectPaths("", [{ name: "a.pdf" }])).toEqual([]);
  });

  it("covers both per-role buckets", () => {
    expect(USER_FOLDER_BUCKETS).toEqual(expect.arrayContaining(["role-resumes", "job-postings"]));
  });
});

describe("isSubscriptionAlreadyGone — when a Stripe cancel failure may be ignored", () => {
  it("treats a missing subscription as already gone", () => {
    expect(isSubscriptionAlreadyGone({ code: "resource_missing" })).toBe(true);
    expect(isSubscriptionAlreadyGone({ statusCode: 404 })).toBe(true);
  });

  it("does not ignore real failures, so the account is not deleted while billing continues", () => {
    expect(isSubscriptionAlreadyGone({ code: "rate_limit", statusCode: 429 })).toBe(false);
    expect(isSubscriptionAlreadyGone({ statusCode: 500 })).toBe(false);
    expect(isSubscriptionAlreadyGone(new Error("network"))).toBe(false);
    expect(isSubscriptionAlreadyGone(null)).toBe(false);
  });
});
