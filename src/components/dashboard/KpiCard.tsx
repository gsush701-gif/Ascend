type KpiCardProps = {
  label: string;
  value: string | number;
  badge?: string;
  hint?: string;
  className?: string;
};

export function KpiCard({ label, value, badge, hint, className = "" }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-dash-surface p-4 shadow-sm ${className}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-white/50">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold text-white">{value}</span>
        {badge != null && badge !== "" && (
          <span className="rounded-md border border-white/10 bg-dash-card/60 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
            {badge}
          </span>
        )}
      </div>
      {hint != null && hint !== "" && (
        <p className="mt-2 text-xs text-white/50">{hint}</p>
      )}
    </div>
  );
}
