import type { LucideIcon } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string | number;
  badge?: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: "cyan" | "violet" | "emerald";
  className?: string;
};

const ACCENT_STYLES: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  cyan: "bg-cyan-500/15 text-cyan-600",
  violet: "bg-violet-500/15 text-violet-600",
  emerald: "bg-emerald-500/15 text-emerald-600",
};

export function KpiCard({
  label,
  value,
  badge,
  hint,
  icon: Icon,
  accent = "cyan",
  className = "",
}: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-dash-surface p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </div>
        {Icon && (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ACCENT_STYLES[accent]}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-xl font-semibold tracking-tight text-slate-900">{value}</span>
        {badge != null && badge !== "" && (
          <span className="rounded-md border border-slate-200 bg-dash-card/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {badge}
          </span>
        )}
      </div>
      {hint != null && hint !== "" && (
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
