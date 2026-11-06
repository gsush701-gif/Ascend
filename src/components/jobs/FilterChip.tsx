import { cn } from "../../lib/cn";

const fmt = (n: number) => n.toLocaleString();

/** A pill-shaped filter button with an optional count, for the Jobs page. */
export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-900/[0.03]",
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("text-xs tabular-nums", active ? "text-white/70" : "text-slate-400")}>{fmt(count)}</span>
      )}
    </button>
  );
}
