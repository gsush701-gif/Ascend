import { Bookmark, BookmarkCheck, Check, Clock, ExternalLink, MapPin, Plus, Undo2, X } from "lucide-react";
import { buttonPrimary, buttonGhost } from "../../lib/ui";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { postedAgo } from "../../features/jobs/format";
import type { Job, JobMatch } from "../../types/jobs";

function formatSalary(job: Job): string | null {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const currency = job.salaryCurrency || "USD";
  const fmt = (n: number) => `${currency === "USD" ? "$" : currency + " "}${n.toLocaleString()}`;
  if (job.salaryMin != null && job.salaryMax != null) return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`;
  return fmt((job.salaryMin ?? job.salaryMax) as number);
}

const AVATAR_TONES = [
  "bg-cyan-500/15 text-cyan-700",
  "bg-violet-500/15 text-violet-700",
  "bg-emerald-500/15 text-emerald-700",
  "bg-amber-500/15 text-amber-700",
  "bg-rose-500/15 text-rose-700",
  "bg-sky-500/15 text-sky-700",
];

function avatarTone(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function matchTone(score: number): string {
  if (score >= 75) return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20";
  if (score >= 50) return "bg-amber-500/10 text-amber-700 ring-amber-500/20";
  return "bg-slate-900/[0.05] text-slate-600 ring-slate-300";
}

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

type JobCardProps = {
  job: Job;
  match?: JobMatch;
  saved?: boolean;
  dismissed?: boolean;
  savedAt?: string;
  onSave?: () => void;
  onUnsave?: () => void;
  onDismiss?: () => void;
  onUndoDismiss?: () => void;
};

export function JobCard({ job, match, saved, dismissed, savedAt, onSave, onUnsave, onDismiss, onUndoDismiss }: JobCardProps) {
  const salary = formatSalary(job);

  if (dismissed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-dash-card px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-500 line-through">{job.title}</div>
          <div className="truncate text-xs text-slate-400">{job.company}</div>
        </div>
        {onUndoDismiss && (
          <Button variant="ghost" size="sm" onClick={onUndoDismiss}>
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </Button>
        )}
      </div>
    );
  }

  const posted = postedAgo(job.postedAt);
  const score = match?.overallMatchScore ?? null;
  const have = match?.skillMatch.matchedSkills ?? [];
  const gap = match?.skillMatch.missingSkills ?? [];
  const why = match?.whyThisMatches ?? [];
  const level = job.experienceLevel === "Entry" ? "New grad" : job.experienceLevel;

  return (
    <article className="rounded-xl border border-slate-200 bg-dash-card p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold sm:h-11 sm:w-11",
            avatarTone(job.company),
          )}
          aria-hidden
        >
          {job.company.trim().charAt(0).toUpperCase() || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">{job.title}</h3>
              <p className="mt-0.5 text-sm text-slate-600">{job.company}</p>
            </div>
            {score !== null && (
              <div
                className={cn("shrink-0 rounded-lg px-2.5 py-1.5 text-center ring-1 ring-inset", matchTone(score))}
                title="How well your resume and preferences fit this posting"
              >
                <div className="text-lg font-semibold leading-none tabular-nums">{score}%</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">match</div>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </span>
            )}
            {posted && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Posted {posted}
              </span>
            )}
            {salary && <span>{salary}</span>}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {level && <span className={cn(pill, "bg-cyan-500/10 text-cyan-700")}>{level}</span>}
            {job.remoteType && <span className={cn(pill, "bg-slate-900/[0.05] text-slate-600")}>{job.remoteType}</span>}
            {job.sponsorship && (
              <span className={cn(pill, "bg-slate-900/[0.05] text-slate-600")}>Sponsorship: {job.sponsorship}</span>
            )}
            {job.source && <span className={cn(pill, "text-slate-400")}>via {job.source}</span>}
          </div>

          {(have.length > 0 || gap.length > 0) && (
            <div className="mt-3 space-y-1.5">
              {have.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-xs text-slate-500">You have</span>
                  {have.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {gap.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-xs text-slate-500">Also asks for</span>
                  {gap.slice(0, 5).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600"
                    >
                      <Plus className="h-3 w-3" strokeWidth={3} />
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {job.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{job.description}</p>}

          {why.length > 0 && (
            <details className="mt-2 text-sm text-slate-600">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                Why this match
              </summary>
              <ul className="mt-1.5 space-y-1">
                {why.map((line, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="text-cyan-600">•</span>
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {savedAt && <div className="mt-2 text-xs text-slate-400">Saved {new Date(savedAt).toLocaleDateString()}</div>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonPrimary, "h-8 px-3 text-xs")}
          >
            View posting and apply
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {saved
            ? onUnsave && (
                <button type="button" onClick={onUnsave} className={cn(buttonGhost, "h-8 px-2.5 text-xs text-cyan-700")}>
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Saved</span>
                </button>
              )
            : onSave && (
                <button type="button" onClick={onSave} className={cn(buttonGhost, "h-8 px-2.5 text-xs")}>
                  <Bookmark className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Save</span>
                </button>
              )}
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={cn(buttonGhost, "h-8 border-transparent px-2.5 text-xs")}>
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Not interested</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** A card-shaped placeholder shown while the list loads, so the page does not jump when it arrives. */
export function JobCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-dash-card p-4 shadow-sm sm:p-5"
      role="status"
      aria-label="Loading"
    >
      <div className="flex animate-pulse items-start gap-3 sm:gap-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-900/[0.06] sm:h-11 sm:w-11" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/5 rounded bg-slate-900/[0.08]" />
              <div className="h-3 w-1/4 rounded bg-slate-900/[0.05]" />
            </div>
            <div className="h-11 w-14 rounded-lg bg-slate-900/[0.06]" />
          </div>
          <div className="h-3 w-2/5 rounded bg-slate-900/[0.05]" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-slate-900/[0.05]" />
            <div className="h-5 w-14 rounded-full bg-slate-900/[0.05]" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded bg-slate-900/[0.04]" />
            <div className="h-3 w-4/5 rounded bg-slate-900/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  );
}
