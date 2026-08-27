// Server-side computation for automated weekly career reports (Phase 7 Task
// 7). This is a CommonJS *port* of the existing browser module
// src/features/report/stats.ts (Phase 6a's on-demand report), not a
// from-scratch reinvention — the funnel-status groupings, the
// MIN_SAMPLE_SIZE=3 "not enough data yet" honesty threshold, and the
// recommendation priority order all mirror that file (and, transitively,
// src/lib/dashboardStats.ts / src/features/analytics/stats.ts /
// src/features/goals/progress.ts) exactly. It can't just `require()` those
// TS/ESM modules from this CommonJS server, so the specific pieces those
// modules use are reproduced here as plain JS working off raw Supabase rows
// (snake_case) instead of the frontend's camelCase `TrackerItem`/`CareerGoal`
// types.
//
// Nothing in this file talks to Supabase directly except the two read
// functions at the bottom (`fetchUserRoles`/`fetchUserGoals`) and the
// orchestration in `runWeeklyReportJob` — every stats/recommendation
// function above them is a pure function over plain arrays, so it's
// unit-testable without a real database (see weeklyReport.test.js).

const MIN_SAMPLE_SIZE = 3;

// Mirrors src/lib/dashboardStats.ts's status groupings exactly — do not
// let these drift from that file if the tracker's status list ever changes.
const APPLIED_PLUS_STATUSES = [
  "Applied",
  "Recruiter Contact",
  "Interview",
  "Technical Interview",
  "Final Interview",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
];
const INTERVIEW_PLUS_STATUSES = [
  "Interview",
  "Technical Interview",
  "Final Interview",
  "Offer",
  "Accepted",
];
const OFFER_PLUS_STATUSES = ["Offer", "Accepted"];

/** Maps one `roles` table row (as read by the service-role client) to just
 * the fields this file's stats functions need — deliberately not a full
 * TrackerItem port, since nothing here needs the rest. */
function rowToStatsItem(row) {
  return {
    status: row.status,
    createdAt: row.created_at,
    deadline: row.deadline ?? undefined,
    reportSnapshot: row.report_snapshot ?? undefined,
    company: row.company,
  };
}

function rowToGoal(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    applicationsTarget: row.applications_target ?? undefined,
  };
}

/**
 * Start of the current ISO week (Monday 00:00 UTC) containing `now`, and the
 * following Monday 00:00 UTC as an exclusive end bound. The client-side
 * on-demand report (src/features/report/stats.ts's startOfPeriod) buckets by
 * the *viewer's local time* since it only ever runs in a single browser at
 * view time; a scheduled server job has no single "the user's timezone" to
 * anchor to, so this deliberately uses UTC instead. Documented, not hidden:
 * a role added right at a week boundary could land in a different bucket
 * here than it would on the live Report page for a user far from UTC.
 */
function getWeekRangeUtc(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday start
  const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  const weekEnd = new Date(weekStart.getTime());
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return { weekStart, weekEnd };
}

function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

/** Same shape/logic as stats.ts's getPeriodStats, scoped to a single
 * pre-computed [start, end) UTC range instead of a ReportPeriod enum. */
function getWeekStats(items, weekStart, weekEnd) {
  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();
  const scoped = items.filter((i) => {
    const t = new Date(i.createdAt).getTime();
    return t >= startMs && t < endMs;
  });

  const applications = scoped.filter((i) => APPLIED_PLUS_STATUSES.includes(i.status)).length;
  const interviews = scoped.filter((i) => INTERVIEW_PLUS_STATUSES.includes(i.status)).length;
  const offers = scoped.filter((i) => OFFER_PLUS_STATUSES.includes(i.status)).length;

  const sampleTooSmall = applications < MIN_SAMPLE_SIZE;
  const responseRatePercent = !sampleTooSmall ? Math.round((interviews / applications) * 100) : null;

  return { applications, interviews, offers, responseRatePercent, sampleTooSmall };
}

/** Same logic as stats.ts's getTopMissingSkill: the required skill missing
 * across the most analyzed roles, or null if nothing recurs across >= 2. */
function getTopMissingSkill(items) {
  const counts = new Map();
  items.forEach((item) => {
    const skills = item.reportSnapshot?.skills ?? [];
    skills.forEach((s) => {
      if (s.status === "miss" && (s.importance ?? "required") === "required") {
        counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
      }
    });
  });
  let best = null;
  for (const [skill, count] of counts) {
    if (!best || count > best.count) best = { skill, count };
  }
  return best && best.count >= 2 ? best : null;
}

/** Mirrors dashboardStats.ts's getOverdueCount. */
function getOverdueCount(items, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return items.filter((item) => {
    const d = item.deadline?.trim();
    if (!d) return false;
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return false;
    date.setHours(0, 0, 0, 0);
    return date.getTime() < today.getTime();
  }).length;
}

/** Mirrors goals/progress.ts's getGoalProgress, applications-count only
 * (that's all getReportRecommendations below needs). */
function getGoalApplicationsProgress(goal, items) {
  const since = new Date(goal.createdAt).getTime();
  const scoped = items.filter((i) => new Date(i.createdAt).getTime() >= since);
  return scoped.filter((i) => APPLIED_PLUS_STATUSES.includes(i.status)).length;
}

/** Mirrors analytics/stats.ts's getApplicationsByCompany, interview-rate part only. */
function getBestCompanyInterviewRate(items) {
  const applied = items.filter((i) => APPLIED_PLUS_STATUSES.includes(i.status));
  const byCompany = new Map();
  for (const item of applied) {
    const key = (item.company || "").trim() || "Unknown company";
    const list = byCompany.get(key) ?? [];
    list.push(item);
    byCompany.set(key, list);
  }
  let best = null;
  for (const [company, list] of byCompany) {
    if (list.length < MIN_SAMPLE_SIZE) continue;
    const interviewCount = list.filter((i) => INTERVIEW_PLUS_STATUSES.includes(i.status)).length;
    const interviewRate = Math.round((interviewCount / list.length) * 100);
    if (!best || interviewRate > best.interviewRate) best = { company, interviewRate };
  }
  return best;
}

/**
 * Reproduces stats.ts's getReportRecommendations priority order exactly:
 * not-enough-data notice, overdue deadlines, goal progress, a recurring
 * missing skill, then best-company interview rate, falling back to a single
 * generic note. Operates over the user's *entire* role history (not just
 * this week), matching how the on-demand Report page calls it.
 */
function getReportRecommendations(items, goals = [], now = new Date()) {
  const recs = [];
  const totalApplied = items.filter((i) => APPLIED_PLUS_STATUSES.includes(i.status)).length;

  if (totalApplied < MIN_SAMPLE_SIZE) {
    recs.push(
      "Track a few more applications to unlock a meaningful response rate and category breakdown here.",
    );
  }

  const overdue = getOverdueCount(items, now);
  if (overdue > 0 && recs.length < 2) {
    recs.push(
      `${overdue} deadline${overdue !== 1 ? "s are" : " is"} overdue — follow up or update status on ${
        overdue === 1 ? "it" : "them"
      } in Roles.`,
    );
  }

  if (recs.length < 2 && goals.length > 0) {
    const goal = goals[0];
    const target = goal.applicationsTarget;
    if (typeof target === "number" && target > 0) {
      const applications = getGoalApplicationsProgress(goal, items);
      if (applications < target) {
        recs.push(`You're at ${applications}/${target} applications toward your goal "${goal.title}".`);
      } else {
        recs.push(`You've hit your applications target for "${goal.title}" — consider setting a new goal.`);
      }
    }
  }

  if (recs.length < 2) {
    const topMissing = getTopMissingSkill(items);
    if (topMissing) {
      recs.push(
        `"${topMissing.skill}" is missing across ${topMissing.count} of your analyzed roles — get a learning path for it from the Analyzer.`,
      );
    }
  }

  if (recs.length < 2) {
    const best = getBestCompanyInterviewRate(items);
    if (best) {
      recs.push(
        `Your applications to ${best.company} have the best interview rate (${best.interviewRate}%) — look for similar roles.`,
      );
    }
  }

  if (recs.length === 0) {
    recs.push("Keep applying consistently — patterns will show up here as you track more roles.");
  }

  return recs.slice(0, 2);
}

/** Builds the jsonb `content` payload stored on a `weekly_reports` row, from
 * already-fetched `roles`/`career_goals` rows for one user. Pure function —
 * no I/O — so the shape stored is fully unit-testable. */
function computeWeeklyReportContent(roleRows, goalRows, now = new Date()) {
  const { weekStart, weekEnd } = getWeekRangeUtc(now);
  const items = (roleRows || []).map(rowToStatsItem);
  const goals = (goalRows || []).map(rowToGoal);

  const stats = getWeekStats(items, weekStart, weekEnd);
  const recommendations = getReportRecommendations(items, goals, now);
  const topMissingSkill = getTopMissingSkill(items);

  return {
    weekStart: toDateOnly(weekStart),
    weekEnd: toDateOnly(new Date(weekEnd.getTime() - 1)), // inclusive last day of the week, for display
    content: {
      generatedAt: now.toISOString(),
      stats,
      recommendations,
      topMissingSkill,
    },
  };
}

/**
 * Upserts one `weekly_reports` row with "do nothing on conflict" against the
 * (user_id, week_start) unique index (supabase/migrations/019_weekly_reports.sql)
 * — the real duplicate-prevention mechanism. `ignoreDuplicates: true` makes
 * Postgres perform `ON CONFLICT (user_id, week_start) DO NOTHING`, so a
 * second call for a week that's already been generated for this user comes
 * back with no error and no row in `data` (a skip), never a thrown
 * unique-violation that could abort the rest of a batch job.
 *
 * Returns `{ inserted: true, row }` when this call created the row, or
 * `{ inserted: false, row }` when it already existed (row is re-fetched so
 * the caller can still see e.g. whether an email was already sent for it).
 */
async function upsertWeeklyReport(supabaseAdmin, { userId, weekStart, weekEnd, content }) {
  const { data, error } = await supabaseAdmin
    .from("weekly_reports")
    .upsert(
      { user_id: userId, week_start: weekStart, week_end: weekEnd, content },
      { onConflict: "user_id,week_start", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return { inserted: true, row: data };
  }

  // ignoreDuplicates skipped the insert — the row already exists. Re-fetch it
  // so the caller (email step) can see its email_sent_at.
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("weekly_reports")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (fetchError) throw fetchError;
  return { inserted: false, row: existing };
}

async function fetchUserRoles(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("status, created_at, deadline, report_snapshot, company")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

async function fetchUserGoals(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .from("career_goals")
    .select("id, title, created_at, applications_target")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Simple bounded-concurrency map — avoids firing one unbounded batch of
 * parallel requests per run (this repo has no promise-pool dependency
 * already installed, and pulling one in for a single call site isn't worth
 * it). Processes `items` in chunks of `limit`, awaiting each chunk fully
 * before starting the next; a single item's rejection is caught by the
 * caller's own per-item try/catch, not here, so one failure never stops the
 * rest of the chunk or later chunks.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((item, idx) => fn(item, i + idx)));
    results.push(...chunkResults);
  }
  return results;
}

/** Plain-text/HTML email body for one user's weekly report — a pure
 * function over the already-computed content, so its exact wording is
 * unit-testable without sending anything. Deliberately plain/minimal (no
 * external images, no tracking pixels) rather than a heavy HTML template. */
function buildWeeklyReportEmail(content, frontendUrl) {
  const { stats, recommendations, topMissingSkill } = content;
  const reportUrl = `${frontendUrl.replace(/\/+$/, "")}/report`;

  const responseRateLine =
    stats.responseRatePercent != null
      ? `Response rate: ${stats.responseRatePercent}%`
      : "Response rate: not enough data yet";

  const recLines = recommendations.map((r) => `- ${r}`).join("\n");
  const skillLine = topMissingSkill
    ? `Recurring gap: "${topMissingSkill.skill}" missing across ${topMissingSkill.count} analyzed roles.`
    : null;

  const text = [
    "Your weekly Ascend career report",
    "",
    `Applications: ${stats.applications}`,
    `Interviews: ${stats.interviews}`,
    `Offers: ${stats.offers}`,
    responseRateLine,
    "",
    "What to do next:",
    recLines,
    skillLine ? `\n${skillLine}` : "",
    "",
    `View the full report: ${reportUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  const html = `
    <div style="font-family: -apple-system, sans-serif; color: #0f172a; max-width: 480px;">
      <h2 style="margin: 0 0 12px;">Your weekly Ascend career report</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 4px 0;">Applications</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${stats.applications}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Interviews</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${stats.interviews}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Offers</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${stats.offers}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Response rate</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${
            stats.responseRatePercent != null ? `${stats.responseRatePercent}%` : "—"
          }</td>
        </tr>
      </table>
      <p style="font-weight: 600; margin-bottom: 6px;">What to do next</p>
      <ul style="padding-left: 18px; margin-top: 0;">
        ${recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
      ${skillLine ? `<p style="color: #475569;">${escapeHtml(skillLine)}</p>` : ""}
      <p style="margin-top: 20px;">
        <a href="${reportUrl}" style="color: #0891b2;">View your full report on Ascend →</a>
      </p>
    </div>
  `;

  return { subject: "Your weekly Ascend career report", html, text };
}

/**
 * Full weekly-report batch job: for every user with
 * `profiles.weekly_reports_enabled = true`, computes this week's report,
 * upserts it (skip-on-conflict — see upsertWeeklyReport), and, if this call
 * actually created the row (not a skip) and Resend is configured, sends the
 * email and records `email_sent_at`. One user's failure is caught and
 * recorded per-user; it never aborts the rest of the batch.
 *
 * @param {object} opts
 * @param {object} opts.supabaseAdmin service-role Supabase client
 * @param {(args: {to: string, subject: string, html: string, text: string}) => Promise<{sent: boolean}>} opts.sendEmail
 * @param {string} opts.frontendUrl used to build the "view full report" link
 * @param {Date} [opts.now]
 * @param {number} [opts.concurrency]
 * @returns {Promise<{ processed: number, created: number, skipped: number, emailed: number, errors: Array<{userId: string, error: string}> }>}
 */
async function runWeeklyReportJob({ supabaseAdmin, sendEmail, frontendUrl, now = new Date(), concurrency = 5 }) {
  const { data: enabledProfiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("weekly_reports_enabled", true);

  if (profilesError) throw profilesError;

  const summary = { processed: 0, created: 0, skipped: 0, emailed: 0, errors: [] };
  if (!enabledProfiles || enabledProfiles.length === 0) return summary;

  await mapWithConcurrency(enabledProfiles, concurrency, async (profile) => {
    const userId = profile.id;
    summary.processed += 1;
    try {
      const [roleRows, goalRows] = await Promise.all([
        fetchUserRoles(supabaseAdmin, userId),
        fetchUserGoals(supabaseAdmin, userId),
      ]);
      const { weekStart, weekEnd, content } = computeWeeklyReportContent(roleRows, goalRows, now);
      const { inserted, row } = await upsertWeeklyReport(supabaseAdmin, {
        userId,
        weekStart,
        weekEnd,
        content,
      });

      if (!inserted) {
        summary.skipped += 1;
        return;
      }
      summary.created += 1;

      if (row && !row.email_sent_at) {
        // Emailing needs the user's actual address, which lives on
        // auth.users, not `profiles` — same N+1-per-enabled-user tradeoff
        // server/index.js's GET /api/admin/ai-usage already accepts at
        // current scale, here bounded by mapWithConcurrency rather than
        // fired unbounded.
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authError || !authUser?.user?.email) {
          console.warn(`[weeklyReport] Could not resolve email for user ${userId}, skipping send.`);
          return;
        }
        const { subject, html, text } = buildWeeklyReportEmail(content, frontendUrl);
        const result = await sendEmail({ to: authUser.user.email, subject, html, text });
        if (result.sent) {
          summary.emailed += 1;
          const { error: updateError } = await supabaseAdmin
            .from("weekly_reports")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", row.id);
          if (updateError) {
            console.error(`[weeklyReport] Failed to record email_sent_at for row ${row.id}:`, updateError.message);
          }
        }
      }
    } catch (err) {
      console.error(`[weeklyReport] Failed for user ${userId}:`, err.message);
      summary.errors.push({ userId, error: err.message });
    }
  });

  return summary;
}

module.exports = {
  MIN_SAMPLE_SIZE,
  APPLIED_PLUS_STATUSES,
  INTERVIEW_PLUS_STATUSES,
  OFFER_PLUS_STATUSES,
  getWeekRangeUtc,
  getWeekStats,
  getTopMissingSkill,
  getOverdueCount,
  getReportRecommendations,
  computeWeeklyReportContent,
  upsertWeeklyReport,
  fetchUserRoles,
  fetchUserGoals,
  mapWithConcurrency,
  buildWeeklyReportEmail,
  runWeeklyReportJob,
};
