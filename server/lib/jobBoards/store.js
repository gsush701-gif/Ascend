// The database side of the job feed: reads and writes the shared `jobs` table
// (supabase/migrations/009_jobs.sql and 028_job_boards.sql) through the
// service-role client. `jobs` has no per-user rows and no RLS policies, so
// only the server ever touches it.

const KNOWN_LIMIT = 5000;

function validIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** One normalised posting as a `jobs` row. */
function toRow(job, nowIso) {
  return {
    company: job.company,
    title: job.title,
    description: job.description || null,
    url: job.url,
    source: job.source,
    location: job.location || null,
    remote_type: job.remoteType || null,
    employment_type: job.employmentType || null,
    experience_level: job.experienceLevel || null,
    posted_at: validIso(job.postedAt),
    deadline: validIso(job.deadline),
    external_id: job.externalId,
    board_token: job.boardToken,
    source_updated_at: job.sourceUpdatedAt || null,
    active: true,
    last_seen_at: nowIso,
    updated_at: nowIso,
  };
}

function check(error, what) {
  if (error) throw new Error(`${what}: ${error.message || error}`);
}

/** @param {import("@supabase/supabase-js").SupabaseClient} db service-role client */
function createJobsStore(db) {
  return {
    /** external id -> the source's last-seen "updated" marker, for one board. */
    async loadKnown(source, boardToken) {
      const { data, error } = await db
        .from("jobs")
        .select("external_id, source_updated_at")
        .eq("source", source)
        .eq("board_token", boardToken)
        .limit(KNOWN_LIMIT);
      check(error, "load known jobs");
      return new Map((data || []).map((r) => [r.external_id, r.source_updated_at]));
    },

    async upsertJobs(jobs, nowIso) {
      const { error } = await db
        .from("jobs")
        .upsert(
          jobs.map((j) => toRow(j, nowIso)),
          { onConflict: "source,external_id" },
        );
      check(error, "save jobs");
    },

    /** Marks already-saved postings as still on the board (and open). */
    async touchSeen(source, boardToken, externalIds, nowIso) {
      const { error } = await db
        .from("jobs")
        .update({ last_seen_at: nowIso, active: true })
        .eq("source", source)
        .eq("board_token", boardToken)
        .in("external_id", externalIds);
      check(error, "mark jobs seen");
    },

    /** Closes this board's postings that were not seen in the run that started at `startedIso`. */
    async deactivateMissing(source, boardToken, startedIso) {
      const { data, error } = await db
        .from("jobs")
        .update({ active: false, updated_at: startedIso })
        .eq("source", source)
        .eq("board_token", boardToken)
        .eq("active", true)
        .lt("last_seen_at", startedIso)
        .select("id");
      check(error, "close missing jobs");
      return (data || []).length;
    },
  };
}

module.exports = { createJobsStore, toRow };
