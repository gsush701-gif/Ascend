import { useMemo } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { AnimatedBar } from "../components/ui/AnimatedBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useResumes } from "../features/resumes/hooks/useResumes";
import {
  getApplicationsByCompany,
  getApplicationsBySource,
  getApplicationsByAlignmentBucket,
  getApplicationsByResumeVersion,
  MIN_SAMPLE_SIZE,
} from "../features/analytics/stats";
import { getApplicationsSentCount } from "../lib/dashboardStats";
import { pageHeader, pageTitle, pageSubtitle, card } from "../lib/ui";

function NotEnoughData({ what }: { what: string }) {
  return (
    <p className="text-sm text-slate-500">
      Not enough data yet — {what} once you have at least {MIN_SAMPLE_SIZE} applications in this
      group. This avoids showing a misleading rate from a tiny sample.
    </p>
  );
}

function BarRow({
  label,
  count,
  maxCount,
  rateLabel,
}: {
  label: string;
  count: number;
  maxCount: number;
  rateLabel?: string;
}) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-slate-700" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-slate-500">
          {count} application{count !== 1 ? "s" : ""}
          {rateLabel ? ` · ${rateLabel}` : ""}
        </span>
      </div>
      <div className="mt-1">
        <AnimatedBar pct={pct} colorClassName="bg-cyan-500" trackClassName="bg-slate-900/[0.06]" height="h-1.5" />
      </div>
    </div>
  );
}

export function Analytics() {
  const { tracker } = useTracker(undefined);
  const { resumes } = useResumes();

  const resumeNameById = useMemo(() => {
    const m = new Map<string, string>();
    resumes.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [resumes]);

  const byCompany = useMemo(() => getApplicationsByCompany(tracker), [tracker]);
  const bySource = useMemo(() => getApplicationsBySource(tracker), [tracker]);
  const byAlignment = useMemo(() => getApplicationsByAlignmentBucket(tracker), [tracker]);
  const byResume = useMemo(
    () => getApplicationsByResumeVersion(tracker, resumeNameById),
    [tracker, resumeNameById]
  );

  const applied = getApplicationsSentCount(tracker);
  const maxCompanyCount = Math.max(1, ...byCompany.map((c) => c.count));
  const maxSourceCount = Math.max(1, ...bySource.map((s) => s.count));
  const maxAlignmentCount = Math.max(1, ...byAlignment.map((b) => b.count));
  const maxResumeCount = Math.max(1, ...byResume.map((r) => r.count));

  const totalAnalyzedApplied = byAlignment.reduce((sum, b) => sum + b.count, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Application analytics</h1>
            <p className={pageSubtitle}>
              Deeper breakdowns beyond the Dashboard — by company, source, fit score, and resume
              version. Every number here comes from your own tracked roles.
            </p>
          </div>
        </header>

        {applied === 0 ? (
          <EmptyState
            title="No applications tracked yet"
            subtitle="Once you start applying and tracking roles, this page breaks down where your applications are going and what's working."
            primaryAction={{ label: "Go to Roles", onClick: () => (window.location.href = "/roles") }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel
              title="Applications by company"
              subtitle="Which companies you apply to most, and their interview rate (once you have enough data)."
            >
              {byCompany.length === 0 ? (
                <NotEnoughData what="track a role at the same company more than once" />
              ) : (
                <div className="space-y-3">
                  {byCompany.slice(0, 10).map((c) => (
                    <BarRow
                      key={c.company}
                      label={c.company}
                      count={c.count}
                      maxCount={maxCompanyCount}
                      rateLabel={
                        c.interviewRate != null
                          ? `${c.interviewRate}% interview rate`
                          : `interview rate: not enough data yet`
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Applications by source"
              subtitle="Where you're finding roles (LinkedIn, referral, etc) — from the optional 'Source' field on each role."
            >
              {bySource.length === 0 ? (
                <NotEnoughData what="this fills in as you set the 'Source' field on tracked roles" />
              ) : (
                <div className="space-y-3">
                  {bySource.map((s) => (
                    <BarRow key={s.source} label={s.source} count={s.count} maxCount={maxSourceCount} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Applications by fit score"
              subtitle="Do you get more traction on high-fit applications? Only includes roles you've actually analyzed."
            >
              {totalAnalyzedApplied === 0 ? (
                <NotEnoughData what="this fills in once you analyze applications with the Analyzer before/after tracking them" />
              ) : (
                <div className="space-y-3">
                  {byAlignment.map((b) => (
                    <BarRow
                      key={b.bucket}
                      label={b.bucket}
                      count={b.count}
                      maxCount={maxAlignmentCount}
                      rateLabel={
                        b.count === 0
                          ? undefined
                          : b.interviewRate != null
                          ? `${b.interviewRate}% interview rate`
                          : `interview rate: not enough data yet`
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Applications by resume version"
              subtitle="Which saved resume you used per application, and its interview rate — from the optional resume link on each role."
            >
              {byResume.length === 0 ? (
                <NotEnoughData what="this fills in as you link a saved resume to tracked roles (via Analyzer -> Save resume)" />
              ) : (
                <div className="space-y-3">
                  {byResume.map((r) => (
                    <BarRow
                      key={r.resumeId}
                      label={r.resumeName}
                      count={r.count}
                      maxCount={maxResumeCount}
                      rateLabel={
                        r.interviewRate != null
                          ? `${r.interviewRate}% interview rate`
                          : `interview rate: not enough data yet`
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}

        <div className={`${card} text-xs text-slate-400`}>
          All figures on this page are computed live from your own tracked roles — nothing here is
          estimated or industry-benchmarked. Breakdowns with fewer than {MIN_SAMPLE_SIZE} data
          points show as "not enough data yet" instead of a misleading small-sample rate.
        </div>
      </div>
    </AppShell>
  );
}
