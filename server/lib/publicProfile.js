// --- Public shareable profile: live-stats computation + field filtering ---
// Side-effect-free module (mirrors the scoring.js pattern) so it can be unit
// tested directly without spinning up the server. Used by GET
// /api/public-profile/:slug in server/index.js.
//
// Deliberately does not read from a stored snapshot: callers pass in the
// requesting user's current `roles` rows (already fetched from Postgres via
// the service-role client, server-side only) and everything here is a pure
// function over that data, so the numbers a visitor sees always reflect
// current reality, not whatever was true when a "generate link" button was
// last clicked (the old shareProfile.ts behavior this replaces).

const MAX_SKILLS = 12;
const MAX_ALIGNMENT_POINTS = 10;

/**
 * @typedef {{
 *   alignment: number,
 *   created_at: string,
 *   updated_at: string,
 *   report_snapshot: {
 *     skills?: { name: string, status: "hit" | "miss" }[],
 *     alignmentHistory?: { alignment: number, createdAt: string }[],
 *     resumeStrengthAtSave?: number,
 *   } | null,
 * }} RoleRow
 */

/**
 * Aggregates distinct "hit" skill names across every role's report snapshot,
 * most-recently-updated role first, capped at MAX_SKILLS. Mirrors the intent
 * of the old client-side SharedProfileData.skills (top skills from the most
 * recent analysis) but sourced from every tracked role instead of only
 * whichever analysis happened to be in memory when "generate" was clicked.
 * @param {RoleRow[]} roleRows
 * @returns {string[]}
 */
function computePublicSkills(roleRows) {
  const byRecency = [...roleRows].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  const seen = new Set();
  const skills = [];
  for (const row of byRecency) {
    const rowSkills = row.report_snapshot && Array.isArray(row.report_snapshot.skills)
      ? row.report_snapshot.skills
      : [];
    for (const s of rowSkills) {
      if (s && s.status === "hit" && typeof s.name === "string" && !seen.has(s.name)) {
        seen.add(s.name);
        skills.push(s.name);
        if (skills.length >= MAX_SKILLS) return skills;
      }
    }
  }
  return skills;
}

/**
 * Most recent cached resume-strength score across the user's roles (the
 * score computed client-side at the time each role was analyzed/saved —
 * see src/features/analyzer/utils.ts's computeResumeStrength and
 * SavedReportSnapshot.resumeStrengthAtSave). Returns null when no role has
 * one yet.
 * @param {RoleRow[]} roleRows
 * @returns {number | null}
 */
function computeLatestResumeStrength(roleRows) {
  const withStrength = roleRows
    .filter(
      (r) =>
        r.report_snapshot &&
        typeof r.report_snapshot.resumeStrengthAtSave === "number",
    )
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return withStrength.length > 0 ? withStrength[0].report_snapshot.resumeStrengthAtSave : null;
}

/**
 * Alignment history across all tracked roles, oldest first, capped to the
 * most recent MAX_ALIGNMENT_POINTS. Ported from (not imported from, since
 * this server runs under CommonJS/Node while dashboardStats.ts is a
 * browser-side ES module) src/lib/dashboardStats.ts's
 * getAlignmentHistoryFromTracker — same shape and same fallback behavior:
 * prefer each role's own saved alignmentHistory array; if a role has a
 * snapshot but no history array, fall back to a single point from that
 * role's own alignment + timestamp.
 * @param {RoleRow[]} roleRows
 * @returns {{ alignment: number, createdAt: string }[]}
 */
function computePublicAlignmentHistory(roleRows) {
  const points = [];
  for (const row of roleRows) {
    const snapshot = row.report_snapshot;
    const history = snapshot && Array.isArray(snapshot.alignmentHistory) ? snapshot.alignmentHistory : [];
    if (history.length > 0) {
      for (const h of history) {
        if (h && typeof h.alignment === "number" && typeof h.createdAt === "string") {
          points.push({ alignment: h.alignment, createdAt: h.createdAt });
        }
      }
    } else if (snapshot) {
      points.push({ alignment: row.alignment, createdAt: row.created_at });
    }
  }
  points.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return points.slice(-MAX_ALIGNMENT_POINTS);
}

/**
 * Computes the full set of potentially-shareable live stats for a user.
 * Pure function — filtering by the owner's show_* preferences happens
 * separately in filterPublicProfileFields, so this can be tested and
 * reasoned about independently of visibility rules.
 * @param {RoleRow[]} roleRows
 */
function computePublicProfileStats(roleRows) {
  return {
    skills: computePublicSkills(roleRows),
    resumeStrength: computeLatestResumeStrength(roleRows),
    alignmentHistory: computePublicAlignmentHistory(roleRows),
  };
}

/**
 * Applies the owner's show_* preferences to computed stats, returning only
 * the fields they've opted into. `resumeStrength` has no dedicated toggle in
 * the public_profiles schema (only show_skills / show_alignment_history /
 * show_target_role exist) — it's treated as always-visible on a public
 * profile, the same way it was always part of the old SharedProfileData
 * payload with no opt-out. Never include anything not explicitly computed
 * here (no user id, email, or raw role data).
 *
 * @param {{ skills: string[], resumeStrength: number | null, alignmentHistory: { alignment: number, createdAt: string }[] }} stats
 * @param {{ showSkills: boolean, showAlignmentHistory: boolean, showTargetRole: boolean }} flags
 * @param {string | null} [targetRole] only read/included when flags.showTargetRole is true
 */
function filterPublicProfileFields(stats, flags, targetRole) {
  const out = { resumeStrength: stats.resumeStrength };
  if (flags.showSkills) out.skills = stats.skills;
  if (flags.showAlignmentHistory) out.alignmentHistory = stats.alignmentHistory;
  if (flags.showTargetRole && typeof targetRole === "string" && targetRole.trim()) {
    out.targetRole = targetRole.trim();
  }
  return out;
}

module.exports = {
  MAX_SKILLS,
  MAX_ALIGNMENT_POINTS,
  computePublicSkills,
  computeLatestResumeStrength,
  computePublicAlignmentHistory,
  computePublicProfileStats,
  filterPublicProfileFields,
};
