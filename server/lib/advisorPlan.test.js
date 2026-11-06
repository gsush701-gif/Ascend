import { describe, it, expect } from "vitest";
import { computePlan, topRecurringGap } from "./advisorPlan.js";

const NOW = new Date("2026-11-10T12:00:00Z");
const day = (n) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);
const ago = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

let nextId = 1;
function role(over = {}) {
  return {
    id: `r${nextId++}`,
    company: "Acme",
    role: "SWE Intern",
    status: "Wishlist",
    created_at: ago(2),
    updated_at: ago(1),
    deadline: null,
    deadline_at: null,
    report_snapshot: { alignment: 80, skills: [] },
    cover_letter: "dear team",
    ...over,
  };
}

const plan = (input) => computePlan({ now: NOW, resumeCount: 1, goal: { title: "g" }, ...input });
const signals = (p) => p.items.map((i) => i.signal);

describe("computePlan: a brand new student", () => {
  it("asks for a resume, a first posting and a goal, with no roles", () => {
    const p = computePlan({ now: NOW, roles: [], resumeCount: 0, goal: null });
    expect(p.thin).toBe(true);
    expect(signals(p)).toEqual(["add-resume", "first-role", "set-goal"]);
  });

  it("drops the resume step once there is one", () => {
    const p = computePlan({ now: NOW, roles: [], resumeCount: 1, goal: { title: "g" } });
    expect(signals(p)).toEqual(["first-role"]);
  });
});

describe("computePlan: time-critical signals", () => {
  it("flags an overdue role that was never applied to", () => {
    const p = plan({ roles: [role({ deadline: day(-3) })] });
    expect(p.items[0].signal).toBe("overdue");
    expect(p.items[0].title).toContain("closed 3 days ago");
  });

  it("does not call an applied role overdue", () => {
    const p = plan({ roles: [role({ status: "Applied", deadline: day(-3), updated_at: ago(1) })] });
    expect(signals(p)).not.toContain("overdue");
  });

  it("reads the typed deadline when the free-text one is empty", () => {
    const p = plan({ roles: [role({ deadline: null, deadline_at: `${day(-1)}T00:00:00Z` })] });
    expect(signals(p)).toContain("overdue");
  });

  it("puts an interview this week at the top", () => {
    const p = plan({
      roles: [role({ status: "Interview", interview_at: `${day(2)}T15:00:00Z` }), role({ deadline: day(-2) })],
    });
    expect(p.items[0].signal).toBe("overdue"); // 100 beats 95
    expect(p.items[1].signal).toBe("interview-soon");
    expect(p.items[1].action.path).toMatch(/interview-prep$/);
  });

  it("names the first missing step for a role closing soon", () => {
    const base = { deadline: day(3) };
    expect(plan({ roles: [role({ ...base, report_snapshot: null })] }).items[0].action.label).toBe("Analyze it");
    expect(
      plan({ roles: [role({ ...base, report_snapshot: { alignment: 45, skills: [] } })] }).items[0].action.label,
    ).toBe("Tailor your resume");
    expect(plan({ roles: [role({ ...base, cover_letter: null })] }).items[0].action.label).toBe(
      "Write the cover letter",
    );
    expect(plan({ roles: [role(base)] }).items[0].action.label).toBe("Apply now");
  });

  it("nudges a follow-up after ten quiet days, or when the follow-up date arrives", () => {
    const quiet = plan({ roles: [role({ status: "Applied", updated_at: ago(12) })] });
    expect(quiet.items[0].signal).toBe("follow-up");
    const dated = plan({ roles: [role({ status: "Recruiter Contact", follow_up_at: `${day(0)}T00:00:00Z` })] });
    expect(dated.items[0].signal).toBe("follow-up");
    const fresh = plan({ roles: [role({ status: "Applied", updated_at: ago(3) })] });
    expect(signals(fresh)).not.toContain("follow-up");
  });
});

describe("computePlan: quality and habit signals", () => {
  it("asks for an analysis of a role with no report", () => {
    const p = plan({ roles: [role({ report_snapshot: null, status: "Wishlist" })] });
    expect(signals(p)).toContain("needs-analysis");
  });

  it("flags a weak fit only when the student cares about the role", () => {
    const weak = { report_snapshot: { alignment: 40, skills: [] } };
    expect(signals(plan({ roles: [role({ ...weak, priority: "high" })] }))).toContain("weak-fit");
    expect(signals(plan({ roles: [role(weak)] }))).not.toContain("weak-fit");
  });

  it("finds a skill missing across at least two roles", () => {
    const miss = (name) => ({ alignment: 70, skills: [{ name, status: "miss", importance: "required" }] });
    const roles = [role({ report_snapshot: miss("docker") }), role({ report_snapshot: miss("docker") })];
    expect(topRecurringGap(roles)).toEqual({ skill: "docker", count: 2 });
    expect(topRecurringGap([roles[0]])).toBeNull();
    expect(signals(plan({ roles }))).toContain("recurring-gap");
  });

  it("ignores preferred skills when finding the recurring gap", () => {
    const pref = { alignment: 70, skills: [{ name: "rust", status: "miss", importance: "preferred" }] };
    expect(topRecurringGap([role({ report_snapshot: pref }), role({ report_snapshot: pref })])).toBeNull();
  });

  it("suggests the strongest saved role when few applications went out", () => {
    const roles = [
      role({ id: "weak", report_snapshot: { alignment: 50, skills: [] } }),
      role({ id: "strong", report_snapshot: { alignment: 85, skills: [] } }),
    ];
    const t = plan({ roles }).items.find((i) => i.signal === "thin-pipeline");
    expect(t.roleId).toBe("strong");
  });

  it("notices a quiet week", () => {
    const p = plan({ roles: [role({ status: "Rejected", created_at: ago(30), updated_at: ago(20) })] });
    expect(signals(p)).toContain("gone-quiet");
  });
});

describe("computePlan: goals", () => {
  it("says to set a goal when there is none", () => {
    expect(signals(plan({ roles: [role()], goal: null }))).toContain("set-goal");
  });

  it("flags being behind pace on an application target", () => {
    const goal = {
      title: "Land an internship",
      applications_target: 20,
      created_at: ago(20),
      target_date: day(10),
    };
    const p = plan({ roles: [role({ status: "Applied", created_at: ago(5), updated_at: ago(1) })], goal });
    expect(signals(p)).toContain("goal-behind");
  });

  it("stays quiet when on pace", () => {
    const goal = { title: "g", applications_target: 2, created_at: ago(20), target_date: day(10) };
    const applied = [role({ status: "Applied", created_at: ago(5) }), role({ status: "Applied", created_at: ago(4) })];
    expect(signals(plan({ roles: applied, goal }))).not.toContain("goal-behind");
  });
});

describe("computePlan: ranking and limits", () => {
  it("returns at most three items and only one per role", () => {
    const roles = [
      role({ id: "a", deadline: day(-5), report_snapshot: null }),
      role({ id: "b", deadline: day(2) }),
      role({ id: "c", status: "Applied", updated_at: ago(15) }),
      role({ id: "d", report_snapshot: null }),
    ];
    const p = plan({ roles });
    expect(p.items.length).toBe(3);
    const ids = p.items.map((i) => i.roleId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.items.map((i) => i.priority)).toEqual([...p.items.map((i) => i.priority)].sort((x, y) => y - x));
  });

  it("copes with missing or malformed rows", () => {
    expect(() => computePlan({ now: NOW, roles: [{ id: "x", status: "Wishlist", deadline: "soon-ish" }] })).not.toThrow();
    expect(computePlan({ now: NOW }).items.length).toBeGreaterThan(0);
  });
});
