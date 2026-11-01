import { describe, expect, it } from "vitest";
import { getReadiness, readinessProgress } from "./readiness";
import type { TrackerItem } from "../../types/tracker";

const base = {
  id: "1",
  company: "Acme",
  role: "Intern",
  status: "Wishlist",
  alignment: 0,
  createdAt: "",
  updatedAt: "",
  nextStep: "",
} as unknown as TrackerItem;

const snap = (skills: { name: string; status: "hit" | "miss"; importance?: "required" | "preferred" }[]) =>
  ({ alignment: 50, coverage: 50, skills, missingSignals: [], actions: [], alignmentHistory: [] }) as TrackerItem["reportSnapshot"];

const done = (items: ReturnType<typeof getReadiness>, key: string) => items.find((i) => i.key === key)?.done;

describe("getReadiness", () => {
  it("starts with nothing done for a bare role", () => {
    const items = getReadiness(base);
    expect(readinessProgress(items)).toEqual({ done: 0, total: 6 });
    expect(items.find((i) => i.key === "gaps")?.hint).toMatch(/analysis first/i);
  });

  it("tracks the analysis and the required skills separately", () => {
    const withGaps = getReadiness({
      ...base,
      reportSnapshot: snap([
        { name: "Docker", status: "miss", importance: "required" },
        { name: "K8s", status: "miss", importance: "preferred" },
      ]),
    });
    expect(done(withGaps, "analyzed")).toBe(true);
    expect(done(withGaps, "gaps")).toBe(false);
    expect(withGaps.find((i) => i.key === "gaps")?.hint).toBe("1 required skill still missing from your resume.");

    const covered = getReadiness({
      ...base,
      reportSnapshot: snap([
        { name: "Docker", status: "hit", importance: "required" },
        { name: "K8s", status: "miss", importance: "preferred" },
      ]),
    });
    expect(done(covered, "gaps")).toBe(true);
  });

  it("marks the cover letter, interview prep, deadline and applied steps from the role's data", () => {
    const items = getReadiness({
      ...base,
      status: "Interview",
      coverLetter: "Dear team...",
      interviewPrep: { questions: [], generatedAt: "now" },
      deadline: "2026-12-01",
    });
    expect(done(items, "coverLetter")).toBe(true);
    expect(done(items, "interview")).toBe(true);
    expect(done(items, "deadline")).toBe(true);
    expect(done(items, "applied")).toBe(true);
  });

  it("does not count a blank cover letter or a role that is only analyzed as applied", () => {
    const items = getReadiness({ ...base, status: "Analyzed", coverLetter: "   ", deadline: "  " });
    expect(done(items, "coverLetter")).toBe(false);
    expect(done(items, "deadline")).toBe(false);
    expect(done(items, "applied")).toBe(false);
  });
});
