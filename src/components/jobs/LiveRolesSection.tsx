import { Link } from "react-router-dom";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { Skeleton } from "../ui/Skeleton";
import { useFeedPreview } from "../../features/jobs/hooks/useFeedPreview";
import { avatarTone, postedAgo } from "../../features/jobs/format";
import { cn } from "../../lib/cn";
import type { Job } from "../../types/jobs";

function Row({ job }: { job: Job }) {
  const posted = postedAgo(job.postedAt);
  const level = job.experienceLevel === "Entry" ? "New grad" : job.experienceLevel;
  return (
    <li>
      {/* The whole row goes to the public list, so a visitor stays on Ascend. */}
      <Link
        to="/internships"
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-900/[0.03] sm:px-5"
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold",
            avatarTone(job.company),
          )}
          aria-hidden
        >
          {job.company.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{job.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span>{job.company}</span>
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location.split(" • ")[0]}
              </span>
            )}
            {posted && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {posted}
              </span>
            )}
          </span>
        </span>
        {level && (
          <span className="hidden shrink-0 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-700 sm:inline">
            {level}
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * "Open right now" strip for the landing page: the live size of the job feed and
 * its three newest roles, as proof that the product is real. It shows nothing at
 * all if the feed cannot be reached, rather than a made-up number.
 */
export function LiveRolesSection() {
  const { preview, loading, failed } = useFeedPreview();
  if (failed || (!loading && (!preview || preview.jobs.length === 0))) return null;

  return (
    <section className="mx-auto max-w-3xl" aria-label="Open roles right now">
      <Reveal amount={0.05}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-dash-card text-left shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">Open right now</h2>
            </div>
            {preview && (
              <span className="text-xs text-slate-500">
                {preview.count.toLocaleString()} internships and new-grad roles, updated daily
              </span>
            )}
          </div>

          <ul className="divide-y divide-slate-100">
            {loading || !preview
              ? [0, 1, 2].map((i) => (
                  <li key={i} className="px-4 py-3 sm:px-5">
                    <Skeleton className="h-10" />
                  </li>
                ))
              : preview.jobs.map((job) => <Row key={job.id} job={job} />)}
          </ul>

          <Link
            to="/internships"
            className="flex items-center justify-center gap-1.5 border-t border-slate-200 px-4 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-500/[0.05]"
          >
            Browse all open roles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
