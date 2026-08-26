import { describe, it, expect } from "vitest";
import {
  normalizeForDedup,
  findDuplicateRole,
  formatDuplicateWarning,
} from "./duplicateDetection";
import type { TrackerItem } from "../../types/tracker";

function makeItem(overrides: Partial<TrackerItem> = {}): TrackerItem {
  return {
    id: overrides.id ?? "item-1",
    company: overrides.company ?? "Acme Corp",
    role: overrides.role ?? "Software Engineer Intern",
    status: overrides.status ?? "Wishlist",
    alignment: overrides.alignment ?? 0,
    createdAt: overrides.createdAt ?? "2026-01-15T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-15T00:00:00.000Z",
    nextStep: overrides.nextStep ?? "Apply",
    jobUrl: overrides.jobUrl,
    ...overrides,
  };
}

describe("normalizeForDedup", () => {
  it("lowercases and trims", () => {
    expect(normalizeForDedup("  Acme Corp  ")).toBe("acme corp");
    expect(normalizeForDedup("ACME CORP")).toBe("acme corp");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeForDedup("Acme   Corp")).toBe("acme corp");
    expect(normalizeForDedup("Acme\tCorp\n")).toBe("acme corp");
  });

  it("handles null/undefined/empty", () => {
    expect(normalizeForDedup(undefined)).toBe("");
    expect(normalizeForDedup(null)).toBe("");
    expect(normalizeForDedup("")).toBe("");
    expect(normalizeForDedup("   ")).toBe("");
  });
});

describe("findDuplicateRole", () => {
  it("returns null when there are no existing items", () => {
    expect(findDuplicateRole([], { company: "Acme", role: "SWE" })).toBeNull();
  });

  it("returns null when company differs even if title matches", () => {
    const existing = [makeItem({ company: "Acme Corp", role: "SWE Intern" })];
    const result = findDuplicateRole(existing, { company: "Globex", role: "SWE Intern" });
    expect(result).toBeNull();
  });

  it("matches on case-insensitive, trimmed company + exact title", () => {
    const existing = [makeItem({ company: "Acme Corp", role: "SWE Intern" })];
    const result = findDuplicateRole(existing, {
      company: "  ACME corp  ",
      role: "  swe intern  ",
    });
    expect(result).not.toBeNull();
    expect(result?.item.company).toBe("Acme Corp");
    expect(result?.matchScore).toBe(90);
  });

  it("does not match when company is the same but title differs and no URL given", () => {
    const existing = [makeItem({ company: "Acme Corp", role: "SWE Intern" })];
    const result = findDuplicateRole(existing, { company: "Acme Corp", role: "Data Analyst Intern" });
    expect(result).toBeNull();
  });

  it("matches on exact job_url even when titles differ", () => {
    const existing = [
      makeItem({
        company: "Acme Corp",
        role: "SWE Intern",
        jobUrl: "https://acme.example.com/jobs/123",
      }),
    ];
    const result = findDuplicateRole(existing, {
      company: "Acme Corp",
      role: "Software Engineer Intern (Summer)",
      jobUrl: "https://acme.example.com/jobs/123",
    });
    expect(result).not.toBeNull();
    expect(result?.matchScore).toBe(95);
  });

  it("treats URLs as equal ignoring case, whitespace, and trailing slash", () => {
    const existing = [
      makeItem({
        company: "Acme Corp",
        role: "SWE Intern",
        jobUrl: "HTTPS://Acme.example.com/jobs/123/",
      }),
    ];
    const result = findDuplicateRole(existing, {
      company: "Acme Corp",
      role: "Different title entirely",
      jobUrl: "  https://acme.example.com/jobs/123  ",
    });
    expect(result).not.toBeNull();
  });

  it("scores 100 when both title and URL match", () => {
    const existing = [
      makeItem({
        company: "Acme Corp",
        role: "SWE Intern",
        jobUrl: "https://acme.example.com/jobs/123",
      }),
    ];
    const result = findDuplicateRole(existing, {
      company: "Acme Corp",
      role: "SWE Intern",
      jobUrl: "https://acme.example.com/jobs/123",
    });
    expect(result?.matchScore).toBe(100);
  });

  it("does not match on URL alone when the candidate provides no URL", () => {
    const existing = [
      makeItem({ company: "Acme Corp", role: "SWE Intern", jobUrl: "https://acme.example.com/jobs/123" }),
    ];
    const result = findDuplicateRole(existing, { company: "Acme Corp", role: "Totally different role" });
    expect(result).toBeNull();
  });

  it("ignores candidates with an empty/whitespace-only company", () => {
    const existing = [makeItem({ company: "Acme Corp", role: "SWE Intern" })];
    expect(findDuplicateRole(existing, { company: "   ", role: "SWE Intern" })).toBeNull();
  });

  it("picks the highest-scoring match when multiple roles at the same company exist", () => {
    const existing = [
      makeItem({ id: "a", company: "Acme Corp", role: "SWE Intern", jobUrl: "https://acme.example.com/other" }),
      makeItem({ id: "b", company: "Acme Corp", role: "SWE Intern", jobUrl: "https://acme.example.com/jobs/123" }),
    ];
    const result = findDuplicateRole(existing, {
      company: "Acme Corp",
      role: "SWE Intern",
      jobUrl: "https://acme.example.com/jobs/123",
    });
    expect(result?.item.id).toBe("b");
    expect(result?.matchScore).toBe(100);
  });
});

describe("formatDuplicateWarning", () => {
  it("includes company, role, formatted date, and match score", () => {
    const item = makeItem({
      company: "Acme Corp",
      role: "SWE Intern",
      createdAt: "2026-02-03T12:00:00.000Z",
    });
    const message = formatDuplicateWarning({ item, matchScore: 90 });
    expect(message).toContain("Acme Corp");
    expect(message).toContain("SWE Intern");
    expect(message).toContain("90%");
    expect(message).toContain("You already tracked this job.");
  });
});
