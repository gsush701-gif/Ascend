import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { KairosAvatar } from "../../components/ui/KairosAvatar";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/toast";
import { card } from "../../lib/ui";
import { cn } from "../../lib/cn";
import { logEvent } from "../../lib/analytics";
import { AI_NAME } from "../../config/brand";
import { useAdvisorPlan, type AdvisorItem, type AdvisorJob } from "./useAdvisorPlan";

/**
 * "This week": up to three things worth doing, each with a button that goes
 * straight to the tool for it. The items come from the server's plain-code
 * signals (deadlines, interviews, follow-ups, recurring skill gaps, goals, and a
 * fresh matching posting), so every line is built from the student's own data.
 * If the plan can't be loaded the card renders nothing rather than an error.
 *
 * `onTrackJob` adds a matching posting to the student's roles; the page passes
 * it in so its own list of roles updates too.
 */
export function ThisWeekCard({
  className,
  onTrackJob,
}: {
  className?: string;
  onTrackJob?: (job: AdvisorJob) => Promise<{ ok: boolean; error?: string }>;
}) {
  const navigate = useNavigate();
  const { plan, items, loading, error, dismiss } = useAdvisorPlan();
  const viewedLogged = useRef(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  useEffect(() => {
    if (!plan || viewedLogged.current) return;
    viewedLogged.current = true;
    logEvent("advisor_plan_viewed", { items: plan.items.length, signals: plan.items.map((i) => i.signal) });
  }, [plan]);

  if (error) return null;
  if (!loading && !plan) return null;

  async function track(item: AdvisorItem) {
    if (!item.trackJob || !onTrackJob || trackingId) return;
    setTrackingId(item.id);
    const result = await onTrackJob(item.trackJob);
    setTrackingId(null);
    if (result.ok) {
      logEvent("advisor_job_tracked", { signal: item.signal });
      toast.success({ title: "Added to your roles", description: `${item.trackJob.title} at ${item.trackJob.company}` });
      dismiss(item.id);
    } else {
      toast.error({ title: "Couldn't add it", description: result.error ?? "Please try again." });
    }
  }

  return (
    <ThisWeekView
      className={className}
      loading={loading}
      items={items}
      planWasEmpty={plan ? plan.items.length === 0 : false}
      trackingId={trackingId}
      canTrack={Boolean(onTrackJob)}
      onAct={(item) => {
        logEvent("advisor_item_clicked", { signal: item.signal });
        if (item.trackJob && onTrackJob) void track(item);
        else navigate(item.action.path);
      }}
      onDismiss={(item) => {
        logEvent("advisor_item_dismissed", { signal: item.signal });
        dismiss(item.id);
      }}
    />
  );
}

type ViewProps = {
  items: AdvisorItem[];
  loading?: boolean;
  /** True when the server had nothing to suggest (as opposed to the student setting everything aside). */
  planWasEmpty?: boolean;
  /** The item currently being added to the student's roles, if any. */
  trackingId?: string | null;
  /** Whether this page can add a posting to roles; without it the button opens the Jobs page instead. */
  canTrack?: boolean;
  onAct: (item: AdvisorItem) => void;
  onDismiss: (item: AdvisorItem) => void;
  className?: string;
};

/** The card itself, with no data fetching, so it can be shown with sample data. */
export function ThisWeekView({
  items,
  loading = false,
  planWasEmpty = false,
  trackingId = null,
  canTrack = true,
  onAct,
  onDismiss,
  className,
}: ViewProps) {
  if (loading) {
    return (
      <section className={cn(card, className)} aria-busy="true" aria-label="This week">
        <Skeleton className="h-24" />
      </section>
    );
  }

  return (
    <section className={cn(card, "space-y-4", className)} aria-label="This week">
      <header className="flex items-center gap-3">
        <KairosAvatar size={30} />
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">This week</h2>
          <p className="text-xs text-slate-500">{AI_NAME} picked these from your own roles, goal and resume.</p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl bg-emerald-500/5 px-4 py-3 text-sm text-slate-700">
          {planWasEmpty
            ? "You are on top of things. Nothing needs you right now, so keep applying to build your pipeline."
            : "You have set everything aside for this week. It comes back on Monday."}
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const isMatch = Boolean(item.trackJob);
            const busy = trackingId === item.id;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-semibold text-cyan-700">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                      {isMatch && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                          New match
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.why}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 pl-9 sm:pl-0">
                  <Button size="sm" variant="primary" onClick={() => onAct(item)} disabled={busy}>
                    {busy ? "Adding…" : isMatch && !canTrack ? "See it in Jobs" : item.action.label}
                  </Button>
                  {item.trackJob?.url && (
                    <a
                      href={item.trackJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline"
                    >
                      View posting
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDismiss(item)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Not now
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
