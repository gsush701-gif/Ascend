// "This week": the career advisor's plan for one student.
//
// Plain code decides what matters, from the student's own stored rows. Nothing
// here calls an AI model and nothing is invented: every title and "why" is built
// from a real field (a deadline, a fit score, a count). A later step may let a
// model rephrase these items in a warmer voice, but it will only ever be handed
// what this module already computed.
//
// Pure functions over plain arrays (snake_case rows as stored), so every signal
// is unit-tested without a database. See docs/CAREER_MUSE_DESIGN.md.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 3;

const PRE_APPLY = ["Wishlist", "Analyzed", "Ready to Apply"];
const APPLIED_ACTIVE = ["Applied", "Recruiter Contact", "Interview", "Technical Interview", "Final Interview"];
const TERMINAL = ["Offer", "Accepted", "Rejected", "Withdrawn"];
const APPLIED_PLUS = [...APPLIED_ACTIVE, ...TERMINAL];

const STALE_APPLIED_DAYS = 10;
const QUIET_DAYS = 7;
const WEAK_FIT = 60;
const SOON_DAYS = 7;
const THIN_PIPELINE_WINDOW_DAYS = 14;
const THIN_PIPELINE_MIN = 3;

function startOfUtcDay(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseDate(value) {
  if (!value || typeof value !== "string") return null;
  const t = new Date(value.trim());
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Whole days from `now` to `date` (negative once it has passed), by UTC calendar day. */
function daysFromNow(date, now) {
  return Math.round((startOfUtcDay(date) - startOfUtcDay(now)) / DAY_MS);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function dayLabel(days) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${plural(days, "day")}`;
}

function shortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The deadline the UI shows is the free-text `deadline`; fall back to the typed one. */
function deadlineOf(row) {
  return parseDate(row.deadline) || parseDate(row.deadline_at);
}

/** The saved fit score, or null when the role was never analyzed (not 0). */
function fitOf(row) {
  const snap = row.report_snapshot;
  if (!snap) return null;
  for (const v of [snap.alignment, row.alignment]) {
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  }
  return null;
}

function label(row) {
  return `${row.role || "Role"} at ${row.company || "a company"}`;
}

function item(signal, priority, roleId, title, why, actionLabel, path) {
  return {
    id: `${signal}:${roleId || "-"}`,
    signal,
    priority,
    roleId: roleId || null,
    title,
    why,
    action: { label: actionLabel, path },
  };
}

/** The skill missing (as a required one) across the most roles, if it recurs in 2+. */
function topRecurringGap(rows) {
  const counts = new Map();
  for (const r of rows) {
    const skills = (r.report_snapshot && r.report_snapshot.skills) || [];
    for (const s of skills) {
      if (s.status === "miss" && (s.importance || "required") === "required") {
        counts.set(s.name, (counts.get(s.name) || 0) + 1);
      }
    }
  }
  let best = null;
  for (const [skill, count] of counts) {
    if (!best || count > best.count) best = { skill, count };
  }
  return best && best.count >= 2 ? best : null;
}

function roleSignals(row, now) {
  const out = [];
  const id = row.id;
  const status = row.status;
  const deadline = deadlineOf(row);
  const dDays = deadline ? daysFromNow(deadline, now) : null;
  const fit = fitOf(row);
  const hasCover = typeof row.cover_letter === "string" && row.cover_letter.trim() !== "";
  const roleName = label(row);

  // Overdue: still not applied, and the deadline has gone.
  if (PRE_APPLY.includes(status) && dDays !== null && dDays < 0) {
    out.push(
      item(
        "overdue",
        100,
        id,
        `${roleName} closed ${plural(-dDays, "day")} ago`,
        `Its deadline (${shortDate(deadline)}) has passed and it is still marked ${status}.`,
        "Update it",
        `/roles/${id}`,
      ),
    );
  }

  // Interview coming up.
  const interviewAt = parseDate(row.interview_at);
  if (interviewAt && !TERMINAL.includes(status)) {
    const iDays = daysFromNow(interviewAt, now);
    if (iDays >= 0 && iDays <= SOON_DAYS) {
      out.push(
        item(
          "interview-soon",
          95,
          id,
          `Interview for ${roleName} ${dayLabel(iDays)}`,
          `It is on ${shortDate(interviewAt)}. Practicing now is the best use of the time.`,
          "Practice now",
          `/roles/${id}/interview-prep`,
        ),
      );
    }
  }

  // Deadline within a week and not applied: name the first missing step.
  if (PRE_APPLY.includes(status) && dDays !== null && dDays >= 0 && dDays <= SOON_DAYS) {
    const due = `Due ${shortDate(deadline)} (${dayLabel(dDays)}).`;
    let why;
    let actionLabel;
    let path = `/roles/${id}`;
    if (fit === null) {
      why = `${due} It has no fit score yet.`;
      actionLabel = "Analyze it";
    } else if (fit < WEAK_FIT) {
      why = `${due} Your fit is ${fit}%, so tailoring your resume comes first.`;
      actionLabel = "Tailor your resume";
      path = "/resume-lab";
    } else if (!hasCover) {
      why = `${due} Your fit is ${fit}% and there is no cover letter yet.`;
      actionLabel = "Write the cover letter";
      path = `/roles/${id}/cover-letter`;
    } else {
      why = `${due} Your fit is ${fit}% and the cover letter is done.`;
      actionLabel = "Apply now";
    }
    out.push(item("closing-soon", 90 - dDays, id, `Get ${roleName} ready to apply`, why, actionLabel, path));
  }

  // Applied a while ago with nothing since, or a follow-up date that has arrived.
  if (APPLIED_ACTIVE.includes(status)) {
    const followUp = parseDate(row.follow_up_at);
    const updated = parseDate(row.updated_at) || parseDate(row.created_at);
    const quietDays = updated ? -daysFromNow(updated, now) : 0;
    const followUpDue = followUp && daysFromNow(followUp, now) <= 0;
    if (followUpDue) {
      out.push(
        item(
          "follow-up",
          80,
          id,
          `Follow up on ${roleName}`,
          `Your follow-up date (${shortDate(followUp)}) has arrived.`,
          "Follow up",
          `/roles/${id}`,
        ),
      );
    } else if (status === "Applied" && quietDays >= STALE_APPLIED_DAYS) {
      out.push(
        item(
          "follow-up",
          78,
          id,
          `Follow up on ${roleName}`,
          `No update in ${plural(quietDays, "day")} since you applied.`,
          "Follow up",
          `/roles/${id}`,
        ),
      );
    }
  }

  // A role with no analysis yet (and not already covered by a closing-soon item).
  if (!row.report_snapshot && !TERMINAL.includes(status) && !out.some((o) => o.signal === "closing-soon")) {
    out.push(
      item(
        "needs-analysis",
        60,
        id,
        `See how you fit ${roleName}`,
        "It has no fit score yet. Add the posting to see your score and the skills to fix.",
        "Analyze it",
        `/roles/${id}`,
      ),
    );
  }

  // Weak fit on a role the student cares about (high priority or due within two weeks).
  if (
    PRE_APPLY.includes(status) &&
    fit !== null &&
    fit < WEAK_FIT &&
    (row.priority === "high" || (dDays !== null && dDays >= 0 && dDays <= 14)) &&
    !out.some((o) => o.signal === "closing-soon")
  ) {
    out.push(
      item(
        "weak-fit",
        50,
        id,
        `Raise your fit for ${roleName}`,
        `Your fit is ${fit}%. Tailoring your bullets to this posting is the quickest way up.`,
        "Tailor your resume",
        "/resume-lab",
      ),
    );
  }

  return out;
}

function goalSignals(goal, rows, now) {
  const out = [];
  if (!goal) {
    out.push(
      item(
        "set-goal",
        45,
        null,
        "Set a goal for your search",
        "A target for applications and a date makes it easier to tell if you are on track.",
        "Set a goal",
        "/goals",
      ),
    );
    return out;
  }
  const target = Number(goal.applications_target);
  const end = parseDate(goal.target_date);
  const start = parseDate(goal.created_at);
  if (Number.isFinite(target) && target > 0 && end && start) {
    const done = rows.filter((r) => APPLIED_PLUS.includes(r.status) && parseDate(r.created_at) >= start).length;
    const total = Math.max(1, end.getTime() - start.getTime());
    const elapsed = Math.min(total, Math.max(0, now.getTime() - start.getTime()));
    const expected = (target * elapsed) / total;
    const daysLeft = daysFromNow(end, now);
    if (daysLeft >= 0 && done < target && done < expected * 0.7) {
      out.push(
        item(
          "goal-behind",
          65,
          null,
          `You are behind on "${goal.title}"`,
          `${done} of ${target} applications with ${plural(daysLeft, "day")} left.`,
          "See your roles",
          "/roles",
        ),
      );
    }
  }
  return out;
}

/**
 * Builds the plan.
 *
 * @param {object} input
 * @param {Array<object>} input.roles raw `roles` rows
 * @param {object|null} [input.goal] the student's current (most recent) career goal row
 * @param {number} [input.resumeCount] how many saved resumes they have
 * @param {Date} [input.now]
 * @returns {{ items: object[], thin: boolean, roleCount: number }}
 */
function computePlan({ roles = [], goal = null, resumeCount = 0, now = new Date() } = {}) {
  const rows = Array.isArray(roles) ? roles : [];
  const all = [];

  for (const row of rows) all.push(...roleSignals(row, now));

  const active = rows.filter((r) => !TERMINAL.includes(r.status));
  const gap = topRecurringGap(active);
  if (gap) {
    all.push(
      item(
        "recurring-gap",
        55,
        null,
        `Close the "${gap.skill}" gap`,
        `It is missing from ${gap.count} of your saved roles. One small project can fix it for all of them.`,
        "Get a project idea",
        "/analyzer",
      ),
    );
  }

  all.push(...goalSignals(goal, rows, now));

  if (resumeCount === 0) {
    all.push(
      item(
        "add-resume",
        78,
        null,
        "Add your resume",
        "Every fit score and rewrite starts from it.",
        "Add resume",
        "/resumes",
      ),
    );
  }

  if (rows.length === 0) {
    all.push(
      item(
        "first-role",
        75,
        null,
        "Start with one posting",
        "Paste an internship you are thinking about to see your fit score and the skills to fix.",
        "Analyze a posting",
        "/analyzer",
      ),
    );
  } else {
    // Applications in the last two weeks: too few, and there are saved roles waiting.
    const since = now.getTime() - THIN_PIPELINE_WINDOW_DAYS * DAY_MS;
    const recentApplied = rows.filter((r) => {
      const a = parseDate(r.applied_at) || (APPLIED_PLUS.includes(r.status) ? parseDate(r.created_at) : null);
      return a && a.getTime() >= since;
    }).length;
    const waiting = rows
      .filter((r) => PRE_APPLY.includes(r.status))
      .sort((a, b) => (fitOf(b) ?? -1) - (fitOf(a) ?? -1))[0];
    if (recentApplied < THIN_PIPELINE_MIN && waiting) {
      all.push(
        item(
          "thin-pipeline",
          40,
          waiting.id,
          `Apply to ${label(waiting)}`,
          `You have applied to ${recentApplied} in the last two weeks.${
            fitOf(waiting) !== null ? ` This is your strongest saved fit, at ${fitOf(waiting)}%.` : ""
          }`,
          "Get it ready",
          `/roles/${waiting.id}`,
        ),
      );
    }

    // Nothing touched for a week.
    const stamps = rows
      .map((r) => parseDate(r.updated_at) || parseDate(r.created_at))
      .filter(Boolean)
      .map((d) => d.getTime());
    const latest = stamps.length ? Math.max(...stamps) : 0;
    const quietFor = latest ? -daysFromNow(new Date(latest), now) : 0;
    if (quietFor >= QUIET_DAYS) {
      all.push(
        item(
          "gone-quiet",
          30,
          null,
          "Do one small thing today",
          `Nothing has changed in ${plural(quietFor, "day")}. One analysis or one application keeps the momentum.`,
          "Analyze a posting",
          "/analyzer",
        ),
      );
    }
  }

  // Highest priority first; at most one item per role; top few only.
  all.sort((a, b) => b.priority - a.priority);
  const seenRoles = new Set();
  const items = [];
  for (const it of all) {
    if (it.roleId) {
      if (seenRoles.has(it.roleId)) continue;
      seenRoles.add(it.roleId);
    }
    items.push(it);
    if (items.length === MAX_ITEMS) break;
  }

  return { items, thin: rows.length === 0, roleCount: rows.length };
}

module.exports = { computePlan, topRecurringGap, MAX_ITEMS };
