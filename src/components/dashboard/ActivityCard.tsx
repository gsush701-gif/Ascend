import { useState } from "react";
import { AlignmentChart } from "../ui/AlignmentChart";
import { card } from "../../lib/ui";
import { cn } from "../../lib/cn";
import {
  getAlignmentHistoryFromTracker,
  getApplicationsByWeek,
  getFitScoreInsight,
} from "../../lib/dashboardStats";
import type { TrackerItem } from "../../types/tracker";

type Tab = "applications" | "fit";

const TABS: { key: Tab; label: string }[] = [
  { key: "applications", label: "Applications" },
  { key: "fit", label: "Fit score" },
];

const BAR_AREA = 112;

/**
 * The dashboard's main chart. It opens on applications per week, which means
 * something from the first role onward, and can switch to the fit score trend,
 * which only draws once the scores come from at least two different days (one
 * day of data is a dot, not a trend).
 */
export function ActivityCard({ items, className }: { items: TrackerItem[]; className?: string }) {
  const [tab, setTab] = useState<Tab>("applications");

  const weeks = getApplicationsByWeek(items, 8);
  const total = weeks.reduce((sum, w) => sum + w.applications, 0);
  const max = Math.max(...weeks.map((w) => w.applications), 1);

  const points = getAlignmentHistoryFromTracker(items);
  const distinctDays = new Set(points.map((p) => new Date(p.createdAt).toDateString())).size;
  const canDrawTrend = points.length >= 2 && distinctDays >= 2;

  return (
    <section className={cn(card, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {tab === "applications"
              ? total === 0
                ? "No applications in the last 8 weeks yet."
                : `${total} application${total === 1 ? "" : "s"} added in the last 8 weeks.`
              : (getFitScoreInsight(items) ?? "Your average fit score by day, from the roles you analyze.")}
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Chart">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition",
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "applications" ? (
        <div className="mt-5 grid grid-cols-8 gap-2 sm:gap-3">
          {weeks.map((w, i) => {
            const isNow = i === weeks.length - 1;
            const height = w.applications === 0 ? 3 : Math.max(8, Math.round((w.applications / max) * BAR_AREA));
            return (
              <div key={w.weekLabel} className="flex flex-col items-center" title={`${w.weekLabel}: ${w.applications}`}>
                <div className="flex w-full flex-col items-center justify-end gap-1" style={{ height: BAR_AREA + 22 }}>
                  {w.applications > 0 && (
                    <span className="text-xs font-medium tabular-nums text-slate-700">{w.applications}</span>
                  )}
                  <div
                    className={cn(
                      "w-full max-w-[44px] rounded-t-md",
                      w.applications === 0 ? "bg-slate-100" : isNow ? "bg-cyan-500" : "bg-cyan-300/70",
                    )}
                    style={{ height }}
                  />
                </div>
                <span className="mt-2 text-[11px] text-slate-400">{isNow ? "Now" : `${weeks.length - 1 - i}w`}</span>
              </div>
            );
          })}
        </div>
      ) : canDrawTrend ? (
        <AlignmentChart points={points} className="mt-4" />
      ) : (
        <div className="mt-4 flex h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 text-center text-sm text-slate-500">
          Analyze roles on a few different days and your fit score trend will show up here.
        </div>
      )}
    </section>
  );
}
