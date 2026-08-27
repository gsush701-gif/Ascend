import { describe, it, expect } from "vitest";
import {
  computePublicSkills,
  computeLatestResumeStrength,
  computePublicAlignmentHistory,
  computePublicProfileStats,
  filterPublicProfileFields,
  MAX_SKILLS,
} from "./publicProfile.js";

function role({
  alignment = 0,
  created_at = "2026-01-01T00:00:00.000Z",
  updated_at = "2026-01-01T00:00:00.000Z",
  report_snapshot = null,
} = {}) {
  return { alignment, created_at, updated_at, report_snapshot };
}

describe("computePublicSkills", () => {
  it("collects only 'hit' skills, deduplicated, most-recently-updated role first", () => {
    const rows = [
      role({
        updated_at: "2026-01-01T00:00:00.000Z",
        report_snapshot: {
          skills: [
            { name: "python", status: "hit" },
            { name: "docker", status: "miss" },
          ],
        },
      }),
      role({
        updated_at: "2026-02-01T00:00:00.000Z",
        report_snapshot: {
          skills: [
            { name: "react", status: "hit" },
            { name: "python", status: "hit" },
          ],
        },
      }),
    ];
    const skills = computePublicSkills(rows);
    // Most recent role's skills come first; "python" (seen again in the
    // older role) isn't duplicated; "docker" never had a "hit" so it's excluded.
    expect(skills).toEqual(["react", "python"]);
  });

  it("caps at MAX_SKILLS", () => {
    const manySkills = Array.from({ length: MAX_SKILLS + 5 }, (_, i) => ({
      name: `skill-${i}`,
      status: "hit",
    }));
    const rows = [role({ report_snapshot: { skills: manySkills } })];
    expect(computePublicSkills(rows)).toHaveLength(MAX_SKILLS);
  });

  it("returns an empty array when there are no roles or no hits", () => {
    expect(computePublicSkills([])).toEqual([]);
    expect(computePublicSkills([role({ report_snapshot: { skills: [] } })])).toEqual([]);
    expect(computePublicSkills([role({ report_snapshot: null })])).toEqual([]);
  });
});

describe("computeLatestResumeStrength", () => {
  it("returns the most recently updated role's cached resume strength", () => {
    const rows = [
      role({ updated_at: "2026-01-01T00:00:00.000Z", report_snapshot: { resumeStrengthAtSave: 40 } }),
      role({ updated_at: "2026-03-01T00:00:00.000Z", report_snapshot: { resumeStrengthAtSave: 72 } }),
      role({ updated_at: "2026-02-01T00:00:00.000Z", report_snapshot: { resumeStrengthAtSave: 55 } }),
    ];
    expect(computeLatestResumeStrength(rows)).toBe(72);
  });

  it("skips roles without a cached resume strength and returns null if none have one", () => {
    const rows = [
      role({ report_snapshot: { skills: [] } }),
      role({ report_snapshot: null }),
    ];
    expect(computeLatestResumeStrength(rows)).toBeNull();
  });
});

describe("computePublicAlignmentHistory", () => {
  it("prefers each role's own alignmentHistory array when present", () => {
    const rows = [
      role({
        report_snapshot: {
          alignmentHistory: [
            { alignment: 10, createdAt: "2026-01-01T00:00:00.000Z" },
            { alignment: 20, createdAt: "2026-01-02T00:00:00.000Z" },
          ],
        },
      }),
    ];
    expect(computePublicAlignmentHistory(rows)).toEqual([
      { alignment: 10, createdAt: "2026-01-01T00:00:00.000Z" },
      { alignment: 20, createdAt: "2026-01-02T00:00:00.000Z" },
    ]);
  });

  it("falls back to a single point from the role's own alignment/created_at when there's a snapshot but no history array", () => {
    const rows = [role({ alignment: 65, created_at: "2026-03-01T00:00:00.000Z", report_snapshot: {} })];
    expect(computePublicAlignmentHistory(rows)).toEqual([
      { alignment: 65, createdAt: "2026-03-01T00:00:00.000Z" },
    ]);
  });

  it("ignores roles with no report_snapshot at all", () => {
    const rows = [role({ alignment: 65, report_snapshot: null })];
    expect(computePublicAlignmentHistory(rows)).toEqual([]);
  });

  it("sorts ascending by date and caps to the most recent MAX_ALIGNMENT_POINTS", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      role({
        alignment: i,
        created_at: new Date(2026, 0, i + 1).toISOString(),
        report_snapshot: {},
      }),
    ).reverse(); // shuffle order to prove sorting happens
    const result = computePublicAlignmentHistory(rows);
    expect(result).toHaveLength(10);
    expect(result[0].alignment).toBe(5); // oldest of the most-recent 10
    expect(result[result.length - 1].alignment).toBe(14);
    for (let i = 1; i < result.length; i++) {
      expect(new Date(result[i].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result[i - 1].createdAt).getTime(),
      );
    }
  });
});

describe("filterPublicProfileFields — visibility gating (security-relevant)", () => {
  const stats = {
    skills: ["python", "react"],
    resumeStrength: 80,
    alignmentHistory: [{ alignment: 50, createdAt: "2026-01-01T00:00:00.000Z" }],
  };

  it("includes everything when all flags are on and a target role is supplied", () => {
    const out = filterPublicProfileFields(
      stats,
      { showSkills: true, showAlignmentHistory: true, showTargetRole: true },
      "Software Engineer",
    );
    expect(out).toEqual({
      resumeStrength: 80,
      skills: ["python", "react"],
      alignmentHistory: [{ alignment: 50, createdAt: "2026-01-01T00:00:00.000Z" }],
      targetRole: "Software Engineer",
    });
  });

  it("omits skills entirely (not just empties it) when showSkills is false", () => {
    const out = filterPublicProfileFields(
      stats,
      { showSkills: false, showAlignmentHistory: true, showTargetRole: false },
      "Software Engineer",
    );
    expect(out).not.toHaveProperty("skills");
  });

  it("omits alignmentHistory entirely when showAlignmentHistory is false", () => {
    const out = filterPublicProfileFields(
      stats,
      { showSkills: true, showAlignmentHistory: false, showTargetRole: false },
      "Software Engineer",
    );
    expect(out).not.toHaveProperty("alignmentHistory");
  });

  it("never includes targetRole when showTargetRole is false, even if one is supplied", () => {
    const out = filterPublicProfileFields(
      stats,
      { showSkills: false, showAlignmentHistory: false, showTargetRole: false },
      "Software Engineer",
    );
    expect(out).not.toHaveProperty("targetRole");
  });

  it("omits targetRole when showTargetRole is true but there's no target role set", () => {
    const out = filterPublicProfileFields(
      stats,
      { showSkills: false, showAlignmentHistory: false, showTargetRole: true },
      null,
    );
    expect(out).not.toHaveProperty("targetRole");
  });

  it("always includes resumeStrength regardless of flags (no dedicated toggle exists)", () => {
    const out = filterPublicProfileFields(
      stats,
      { showSkills: false, showAlignmentHistory: false, showTargetRole: false },
      null,
    );
    expect(out.resumeStrength).toBe(80);
  });

  it("with everything off, the response contains nothing beyond resumeStrength — no id/email/user fields ever appear", () => {
    const out = filterPublicProfileFields(
      stats,
      { showSkills: false, showAlignmentHistory: false, showTargetRole: false },
      null,
    );
    expect(Object.keys(out).sort()).toEqual(["resumeStrength"]);
  });
});

describe("computePublicProfileStats", () => {
  it("composes all three computations from the same role rows", () => {
    const rows = [
      role({
        alignment: 30,
        updated_at: "2026-01-01T00:00:00.000Z",
        report_snapshot: {
          skills: [{ name: "sql", status: "hit" }],
          resumeStrengthAtSave: 60,
        },
      }),
    ];
    expect(computePublicProfileStats(rows)).toEqual({
      skills: ["sql"],
      resumeStrength: 60,
      alignmentHistory: [{ alignment: 30, createdAt: "2026-01-01T00:00:00.000Z" }],
    });
  });
});
