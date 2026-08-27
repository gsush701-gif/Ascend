import { Bookmark, BookmarkCheck, Building2, ExternalLink, MapPin, Undo2, X } from "lucide-react";
import { card, badge, badgePrimary } from "../../lib/ui";
import { Button } from "../ui/Button";
import type { Job, JobMatch } from "../../types/jobs";

function formatSalary(job: Job): string | null {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const currency = job.salaryCurrency || "USD";
  const fmt = (n: number) => `${currency === "USD" ? "$" : currency + " "}${n.toLocaleString()}`;
  if (job.salaryMin != null && job.salaryMax != null) return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`;
  return fmt((job.salaryMin ?? job.salaryMax) as number);
}

function matchScoreTone(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-slate-500";
}

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
      <div className={`${card} flex items-center justify-between gap-3 py-3`}>
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

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{job.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {job.company}
            </span>
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </span>
            )}
            {salary && <span>{salary}</span>}
          </div>
        </div>
        {match && (
          <div className="shrink-0 text-right">
            <div className={`text-2xl font-semibold tabular-nums ${matchScoreTone(match.overallMatchScore)}`}>
              {match.overallMatchScore ?? "—"}
              {match.overallMatchScore !== null && <span className="text-sm font-normal">%</span>}
            </div>
            <div className="text-[11px] text-slate-400">match</div>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {job.remoteType && <span className={badge}>{job.remoteType}</span>}
        {job.employmentType && <span className={badge}>{job.employmentType}</span>}
        {job.experienceLevel && <span className={badge}>{job.experienceLevel}</span>}
        {job.sponsorship && <span className={badge}>Sponsorship: {job.sponsorship}</span>}
        {job.source && <span className={badgePrimary}>{job.source}</span>}
      </div>

      {job.description && <p className="mt-3 line-clamp-3 text-sm text-slate-600">{job.description}</p>}

      {match && match.whyThisMatches.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm text-slate-600">
          {match.whyThisMatches.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-cyan-600">•</span>
              {line}
            </li>
          ))}
        </ul>
      )}

      {savedAt && (
        <div className="mt-2 text-xs text-slate-400">Saved {new Date(savedAt).toLocaleDateString()}</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline"
          >
            View posting
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <div className="ml-auto flex items-center gap-2">
          {saved ? (
            onUnsave && (
              <Button variant="secondary" size="sm" onClick={onUnsave}>
                <BookmarkCheck className="h-3.5 w-3.5" />
                Saved
              </Button>
            )
          ) : (
            onSave && (
              <Button variant="secondary" size="sm" onClick={onSave}>
                <Bookmark className="h-3.5 w-3.5" />
                Save
              </Button>
            )
          )}
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
