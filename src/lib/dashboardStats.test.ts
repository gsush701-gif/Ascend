import { describe, expect, it } from "vitest";
import { getComingUp, getOverdueCount, getTopSkillGaps, getUpcomingDeadlines } from "./dashboardStats";
import type { TrackerItem } from "../types/tracker";

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function role(id: string, deadline?: string): TrackerItem {
  return {
    id,
    company: "Acme",
    role: `Role ${id}`,
    status: "Applied",
    alignment: 70,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    nextStep: "",
    deadline,
  } as TrackerItem;
}

describe("deadlines picked from the date input", () => {
  it("counts a deadline due today as today, not overdue", () => {
    const [d] = getUpcomingDeadlines([role("a", ymd(0))]);
    expect(d.daysText).toBe("Today");
    expect(d.isOverdue).toBe(false);
    expect(getOverdueCount([role("a", ymd(0))])).toBe(0);
  });

  it("counts days until a future date exactly", () => {
    const [d] = getUpcomingDeadlines([role("a", ymd(3))]);
    expect(d.daysText).toBe("3 days");
  });

  it("marks yesterday as overdue", () => {
    const [d] = getUpcomingDeadlines([role("a", ymd(-1))]);
    expect(d.isOverdue).toBe(true);
    expect(getOverdueCount([role("a", ymd(-1))])).toBe(1);
  });

  it("ignores roles with no valid deadline", () => {
    expect(getUpcomingDeadlines([role("a"), role("b", "soon")])).toEqual([]);
  });
});

describe("getTopSkillGaps", () => {
  const withSkills = (id: string, status: TrackerItem["status"], skills: { name: string; status: "hit" | "miss"; importance?: "required" | "preferred" }[]): TrackerItem =>
    ({
      ...role(id),
      status,
      reportSnapshot: { alignment: 60, coverage: 60, skills, missingSignals: [], actions: [], alignmentHistory: [] },
    }) as TrackerItem;

  it("ranks skills by how many open roles miss them", () => {
    const gaps = getTopSkillGaps([
      withSkills("a", "Applied", [{ name: "Docker", status: "miss" }, { name: "Jest", status: "miss", importance: "preferred" }]),
      withSkills("b", "Wishlist", [{ name: "docker", status: "miss" }, { name: "SQL", status: "hit" }]),
      withSkills("c", "Applied", [{ name: "Jest", status: "miss", importance: "preferred" }]),
    ]);
    expect(gaps[0]).toEqual({ name: "Docker", roles: 2, required: true });
    expect(gaps[1]).toEqual({ name: "Jest", roles: 2, required: false });
    expect(gaps.find((g) => g.name === "SQL")).toBeUndefined();
  });

  it("ignores closed roles and counts a skill once per role", () => {
    const gaps = getTopSkillGaps([
      withSkills("a", "Rejected", [{ name: "Go", status: "miss" }]),
      withSkills("b", "Applied", [
        { name: "Rust", status: "miss" },
        { name: "rust", status: "miss" },
      ]),
    ]);
    expect(gaps).toEqual([{ name: "Rust", roles: 1, required: true }]);
  });

  it("is empty when nothing was analyzed", () => {
    expect(getTopSkillGaps([role("a")])).toEqual([]);
  });
});

describe("getComingUp", () => {
  const NOW = new Date(2026, 10, 10, 15, 0, 0);
  const at = (offsetDays: number) => {
    const d = new Date(2026, 10, 10 + offsetDays, 9, 0, 0);
    return d.toISOString();
  };
  const ymdOf = (offsetDays: number) => {
    const d = new Date(2026, 10, 10 + offsetDays);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it("lists deadlines, interviews and follow-ups soonest first", () => {
    const items = [
      { ...role("a", ymdOf(5)), status: "Wishlist" },
      { ...role("b"), status: "Interview", interviewAt: at(2) },
      { ...role("c"), status: "Applied", followUpAt: at(0) },
    ] as TrackerItem[];
    const out = getComingUp(items, NOW);
    expect(out.map((o) => `${o.id}:${o.kind}:${o.daysFromNow}`)).toEqual(["c:Follow-up:0", "b:Interview:2", "a:Deadline:5"]);
  });

  it("skips the deadline once applied, past interviews, closed roles and stale items", () => {
    const items = [
      { ...role("a", ymdOf(3)), status: "Applied" },
      { ...role("b"), status: "Interview", interviewAt: at(-1) },
      { ...role("c", ymdOf(3)), status: "Rejected" },
      { ...role("d", ymdOf(-30)), status: "Wishlist" },
      { ...role("e", ymdOf(90)), status: "Wishlist" },
    ] as TrackerItem[];
    expect(getComingUp(items, NOW)).toEqual([]);
  });

  it("marks a missed deadline as overdue", () => {
    const [d] = getComingUp([{ ...role("a", ymdOf(-2)), status: "Ready to Apply" } as TrackerItem], NOW);
    expect(d.isOverdue).toBe(true);
    expect(d.daysFromNow).toBe(-2);
  });
});
