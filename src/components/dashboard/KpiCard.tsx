type KpiCardProps = {
  label: string;
  value: string | number;
  /** A short note beside the number, such as "+2 this week". */
  badge?: string;
  /** One line of explanation under the number. */
  hint?: string;
  className?: string;
};

/**
 * One number in the dashboard's stat strip: a quiet label, a large figure and an
 * optional note. It has no box or icon of its own; the strip around it supplies
 * the card and the dividers, so the numbers read as a single row.
 */
export function KpiCard({ label, value, badge, hint, className = "" }: KpiCardProps) {
  return (
    <div className={`px-5 py-4 sm:px-6 sm:py-5 ${className}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
        {badge != null && badge !== "" && <span className="text-xs font-medium text-slate-500">{badge}</span>}
      </div>
      {hint != null && hint !== "" && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}
