type KpiCardProps = {
  label: string;
  value: string | number;
  /** A short note beside the number, such as "+2 this week". */
  badge?: string;
  /** One line of explanation under the number. */
  hint?: string;
  /** A small chart or bar shown under the number. Keeps a fixed height so cells line up. */
  visual?: React.ReactNode;
  className?: string;
};

/**
 * One number in the dashboard's stat strip: a quiet label, a large figure, an
 * optional note and a small visual. It has no box or icon of its own; the strip
 * around it supplies the card and the dividers, so the numbers read as one row.
 */
export function KpiCard({ label, value, badge, hint, visual, className = "" }: KpiCardProps) {
  return (
    <div className={`flex flex-col bg-white px-5 py-4 ${className}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
        {badge != null && badge !== "" && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{badge}</span>
        )}
      </div>
      {visual != null && <div className="mt-3 flex h-7 items-end">{visual}</div>}
      {hint != null && hint !== "" && <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}
