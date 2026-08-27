import { describe, it, expect, vi } from "vitest";
import {
  getWeekRangeUtc,
  getWeekStats,
  getTopMissingSkill,
  getOverdueCount,
  getReportRecommendations,
  computeWeeklyReportContent,
  upsertWeeklyReport,
  buildWeeklyReportEmail,
  runWeeklyReportJob,
} from "./weeklyReport.js";

/**
 * Minimal fake of the Supabase query-builder chain this file's DB-touching
 * functions use, mirroring the established pattern in server/lib/billing.test.js
 * (this repo's convention: feature agents never use the real service-role
 * client against production data for their own testing — see billing.test.js's
 * own header comment). Routes by table name; a `weekly_reports` upsert against
 * a key already in `store` simulates the real unique-index conflict by
 * returning no row, exactly like Postgres's `ON CONFLICT ... DO NOTHING` does
 * with `ignoreDuplicates: true`.
 */
function createFakeSupabaseAdmin({ profiles = [], rolesByUser = {}, goalsByUser = {}, authEmails = {} } = {}) {
  const store = new Map(); // `${user_id}:${week_start}` -> row
  const calls = { upserts: [], updates: [] };
  let nextId = 1;

  function from(table) {
    if (table === "profiles") {
      return { select: () => ({ eq: () => Promise.resolve({ data: profiles, error: null }) }) };
    }
    if (table === "roles") {
      return {
        select: () => ({
          eq: (_col, userId) => Promise.resolve({ data: rolesByUser[userId] || [], error: null }),
        }),
      };
    }
    if (table === "career_goals") {
      return {
        select: () => ({
          eq: (_col, userId) => ({
            order: () => Promise.resolve({ data: goalsByUser[userId] || [], error: null }),
          }),
        }),
      };
    }
    if (table === "weekly_reports") {
      return {
        upsert: (row) => {
          calls.upserts.push(row);
          const key = `${row.user_id}:${row.week_start}`;
          return {
            select: () => ({
              maybeSingle: () => {
                if (store.has(key)) {
                  // Simulates ON CONFLICT (user_id, week_start) DO NOTHING.
                  return Promise.resolve({ data: null, error: null });
                }
                const newRow = { id: `row-${nextId++}`, email_sent_at: null, created_at: "2026-01-01T00:00:00.000Z", ...row };
                store.set(key, newRow);
                return Promise.resolve({ data: newRow, error: null });
              },
            }),
          };
        },
        select: () => ({
          eq: (_c1, userId) => ({
            eq: (_c2, weekStart) => ({
              maybeSingle: () => Promise.resolve({ data: store.get(`${userId}:${weekStart}`) || null, error: null }),
            }),
          }),
        }),
        update: (patch) => {
          calls.updates.push(patch);
          return {
            eq: (_col, id) => {
              for (const row of store.values()) {
                if (row.id === id) Object.assign(row, patch);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    }
    throw new Error(`createFakeSupabaseAdmin: unexpected table "${table}"`);
  }

  return {
    from: vi.fn(from),
    auth: {
      admin: {
        getUserById: vi.fn((userId) =>
          authEmails[userId]
            ? Promise.resolve({ data: { user: { email: authEmails[userId] } }, error: null })
            : Promise.resolve({ data: null, error: new Error("user not found") }),
        ),
      },
    },
    _store: store,
    _calls: calls,
  };
}

function roleRow(overrides = {}) {
  return {
    company: "Acme Corp",
    status: "Applied",
    created_at: "2026-08-25T00:00:00.000Z",
    deadline: null,
    report_snapshot: null,
    ...overrides,
  };
}

describe("getWeekRangeUtc", () => {
  it("returns the Monday 00:00 UTC start and following Monday as an exclusive end", () => {
    // 2026-08-26 is a Wednesday (UTC)
    const now = new Date("2026-08-26T15:00:00.000Z");
    const { weekStart, weekEnd } = getWeekRangeUtc(now);
    expect(weekStart.getUTCDay()).toBe(1); // Monday
    expect(weekStart.toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(weekStart.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(weekEnd.getTime()).toBeGreaterThan(now.getTime());
  });

  it("handles a Sunday correctly (week start is the Monday before, not after)", () => {
    const now = new Date("2026-08-30T12:00:00.000Z"); // Sunday
    const { weekStart } = getWeekRangeUtc(now);
    expect(weekStart.toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });
});

describe("getWeekStats", () => {
  const { weekStart, weekEnd } = getWeekRangeUtc(new Date("2026-08-26T12:00:00.000Z"));

  it("returns zeros and no fake response rate for no items", () => {
    const stats = getWeekStats([], weekStart, weekEnd);
    expect(stats).toEqual({ applications: 0, interviews: 0, offers: 0, responseRatePercent: null, sampleTooSmall: true });
  });

  it("counts applications/interviews/offers within the week only", () => {
    const items = [
      { status: "Applied", createdAt: "2026-08-25T00:00:00.000Z" }, // in week
      { status: "Interview", createdAt: "2026-08-24T01:00:00.000Z" }, // in week
      { status: "Offer", createdAt: "2026-08-20T00:00:00.000Z" }, // before week
      { status: "Wishlist", createdAt: "2026-08-26T00:00:00.000Z" }, // in week, not applied
    ];
    const stats = getWeekStats(items, weekStart, weekEnd);
    expect(stats.applications).toBe(2);
    expect(stats.interviews).toBe(1);
    expect(stats.offers).toBe(0);
  });

  it("suppresses response rate below MIN_SAMPLE_SIZE", () => {
    const items = [
      { status: "Applied", createdAt: "2026-08-25T00:00:00.000Z" },
      { status: "Interview", createdAt: "2026-08-25T00:00:00.000Z" },
    ];
    const stats = getWeekStats(items, weekStart, weekEnd);
    expect(stats.sampleTooSmall).toBe(true);
    expect(stats.responseRatePercent).toBeNull();
  });

  it("computes a real response rate once the sample is large enough", () => {
    const items = [
      { status: "Applied", createdAt: "2026-08-25T00:00:00.000Z" },
      { status: "Applied", createdAt: "2026-08-25T00:00:00.000Z" },
      { status: "Interview", createdAt: "2026-08-25T00:00:00.000Z" },
    ];
    const stats = getWeekStats(items, weekStart, weekEnd);
    expect(stats.sampleTooSmall).toBe(false);
    expect(stats.responseRatePercent).toBe(33);
  });
});

describe("getTopMissingSkill", () => {
  it("returns null when nothing recurs across at least 2 roles", () => {
    const items = [
      { reportSnapshot: { skills: [{ name: "Docker", status: "miss", importance: "required" }] } },
    ];
    expect(getTopMissingSkill(items)).toBeNull();
  });

  it("returns the skill missing across the most roles, ignoring hits and preferred-only misses", () => {
    const items = [
      { reportSnapshot: { skills: [{ name: "Docker", status: "miss", importance: "required" }] } },
      { reportSnapshot: { skills: [{ name: "Docker", status: "miss", importance: "required" }] } },
      { reportSnapshot: { skills: [{ name: "Python", status: "hit", importance: "required" }] } },
      { reportSnapshot: { skills: [{ name: "K8s", status: "miss", importance: "preferred" }] } },
    ];
    expect(getTopMissingSkill(items)).toEqual({ skill: "Docker", count: 2 });
  });
});

describe("getOverdueCount", () => {
  it("counts only past deadlines, ignoring blank/invalid ones", () => {
    const now = new Date("2026-08-26T12:00:00.000Z");
    const items = [
      { deadline: "2026-08-01" }, // overdue
      { deadline: "2026-09-01" }, // future
      { deadline: "" },
      { deadline: "not-a-date" },
    ];
    expect(getOverdueCount(items, now)).toBe(1);
  });
});

describe("getReportRecommendations", () => {
  it("leads with a low-data notice below MIN_SAMPLE_SIZE applications", () => {
    const items = [{ status: "Applied", createdAt: "2026-08-01T00:00:00.000Z" }];
    const recs = getReportRecommendations(items);
    expect(recs[0]).toMatch(/track a few more applications/i);
  });

  it("never returns more than 2 recommendations", () => {
    const items = Array.from({ length: 10 }, () => ({
      status: "Applied",
      createdAt: "2026-08-01T00:00:00.000Z",
      deadline: "2020-01-01",
    }));
    expect(getReportRecommendations(items).length).toBeLessThanOrEqual(2);
  });

  it("always returns at least one recommendation", () => {
    const items = Array.from({ length: 5 }, () => ({ status: "Applied", createdAt: "2026-08-01T00:00:00.000Z" }));
    expect(getReportRecommendations(items).length).toBeGreaterThanOrEqual(1);
  });

  it("surfaces goal progress when an active goal exists", () => {
    const items = Array.from({ length: 5 }, () => ({ status: "Applied", createdAt: "2026-08-01T00:00:00.000Z" }));
    const goals = [{ id: "g1", title: "Land an internship", createdAt: "2026-07-01T00:00:00.000Z", applicationsTarget: 20 }];
    const recs = getReportRecommendations(items, goals);
    expect(recs.some((r) => r.includes("Land an internship"))).toBe(true);
  });
});

describe("computeWeeklyReportContent", () => {
  it("builds the stored content shape from raw role/goal rows", () => {
    const now = new Date("2026-08-26T12:00:00.000Z");
    const roles = [roleRow({ status: "Applied" }), roleRow({ status: "Interview" }), roleRow({ status: "Applied" })];
    const { weekStart, weekEnd, content } = computeWeeklyReportContent(roles, [], now);
    expect(weekStart).toBe("2026-08-24");
    expect(weekEnd).toBe("2026-08-30");
    expect(content.stats.applications).toBe(3);
    expect(content.stats.interviews).toBe(1);
    expect(Array.isArray(content.recommendations)).toBe(true);
    expect(content.recommendations.length).toBeGreaterThan(0);
    expect(typeof content.generatedAt).toBe("string");
  });
});

describe("buildWeeklyReportEmail", () => {
  it("includes the key numbers and a link back to the report page", () => {
    const content = {
      stats: { applications: 4, interviews: 2, offers: 1, responseRatePercent: 50, sampleTooSmall: false },
      recommendations: ["Do the thing."],
      topMissingSkill: { skill: "Docker", count: 3 },
    };
    const { subject, html, text } = buildWeeklyReportEmail(content, "https://ascend.app");
    expect(subject).toMatch(/weekly/i);
    expect(text).toContain("Applications: 4");
    expect(text).toContain("https://ascend.app/report");
    expect(html).toContain("https://ascend.app/report");
    expect(html).toContain("Docker");
  });

  it("escapes user-influenced text in the HTML body", () => {
    const content = {
      stats: { applications: 1, interviews: 0, offers: 0, responseRatePercent: null, sampleTooSmall: true },
      recommendations: ["<script>alert(1)</script>"],
      topMissingSkill: null,
    };
    const { html } = buildWeeklyReportEmail(content, "https://ascend.app");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("upsertWeeklyReport — duplicate prevention", () => {
  it("inserts a fresh row when none exists yet for that (user, week)", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin();
    const { inserted, row } = await upsertWeeklyReport(supabaseAdmin, {
      userId: "user-1",
      weekStart: "2026-08-24",
      weekEnd: "2026-08-30",
      content: { stats: {} },
    });
    expect(inserted).toBe(true);
    expect(row.user_id).toBe("user-1");
  });

  it("skips (does not error, does not create a second row) on a repeat call for the same week", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin();
    const args = { userId: "user-1", weekStart: "2026-08-24", weekEnd: "2026-08-30", content: { stats: {} } };
    const first = await upsertWeeklyReport(supabaseAdmin, args);
    const second = await upsertWeeklyReport(supabaseAdmin, args);

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    // Skip re-fetches the existing row rather than returning nothing, so the
    // caller can still see whether it was already emailed.
    expect(second.row.id).toBe(first.row.id);
    expect(supabaseAdmin._store.size).toBe(1);
  });
});

describe("runWeeklyReportJob — end-to-end batch behavior", () => {
  it("processes every opted-in user, creates one row each, and sends email once RESEND is wired", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({
      profiles: [{ id: "user-1" }, { id: "user-2" }],
      rolesByUser: {
        "user-1": [roleRow({ status: "Applied" }), roleRow({ status: "Applied" }), roleRow({ status: "Applied" })],
        "user-2": [],
      },
      authEmails: { "user-1": "one@example.com", "user-2": "two@example.com" },
    });
    const sendEmail = vi.fn(() => Promise.resolve({ sent: true }));

    const summary = await runWeeklyReportJob({
      supabaseAdmin,
      sendEmail,
      frontendUrl: "https://ascend.app",
      now: new Date("2026-08-26T12:00:00.000Z"),
    });

    expect(summary.processed).toBe(2);
    expect(summary.created).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.emailed).toBe(2);
    expect(summary.errors).toEqual([]);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    // email_sent_at gets recorded back onto the row.
    for (const row of supabaseAdmin._store.values()) {
      expect(row.email_sent_at).not.toBeNull();
    }
  });

  it("a second run for the same week skips every user (no duplicate rows, no duplicate emails) without erroring", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({
      profiles: [{ id: "user-1" }],
      rolesByUser: { "user-1": [roleRow()] },
      authEmails: { "user-1": "one@example.com" },
    });
    const sendEmail = vi.fn(() => Promise.resolve({ sent: true }));
    const now = new Date("2026-08-26T12:00:00.000Z");

    const first = await runWeeklyReportJob({ supabaseAdmin, sendEmail, frontendUrl: "https://ascend.app", now });
    const second = await runWeeklyReportJob({ supabaseAdmin, sendEmail, frontendUrl: "https://ascend.app", now });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.errors).toEqual([]);
    expect(sendEmail).toHaveBeenCalledTimes(1); // not re-sent on the skip
    expect(supabaseAdmin._store.size).toBe(1); // still exactly one row
  });

  it("one user's failure doesn't abort processing of the rest of the batch", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({
      profiles: [{ id: "user-broken" }, { id: "user-fine" }],
      rolesByUser: {
        // user-broken has no entry in rolesByUser -> fine, returns [] safely;
        // instead force a failure via a table the fake doesn't recognize by
        // monkey-patching this one user's roles fetch to throw.
        "user-fine": [roleRow()],
      },
      authEmails: { "user-fine": "fine@example.com" },
    });
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = vi.fn((table) => {
      const builder = originalFrom(table);
      if (table === "roles") {
        return {
          select: () => ({
            eq: (_col, userId) => {
              if (userId === "user-broken") return Promise.resolve({ data: null, error: new Error("boom") });
              return builder.select().eq(_col, userId);
            },
          }),
        };
      }
      return builder;
    });

    const sendEmail = vi.fn(() => Promise.resolve({ sent: true }));
    const summary = await runWeeklyReportJob({
      supabaseAdmin,
      sendEmail,
      frontendUrl: "https://ascend.app",
      now: new Date("2026-08-26T12:00:00.000Z"),
    });

    expect(summary.processed).toBe(2);
    expect(summary.created).toBe(1); // user-fine still succeeded
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].userId).toBe("user-broken");
  });

  it("does nothing (no error) when no user has weekly_reports_enabled", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({ profiles: [] });
    const sendEmail = vi.fn();
    const summary = await runWeeklyReportJob({ supabaseAdmin, sendEmail, frontendUrl: "https://ascend.app" });
    expect(summary).toEqual({ processed: 0, created: 0, skipped: 0, emailed: 0, errors: [] });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
