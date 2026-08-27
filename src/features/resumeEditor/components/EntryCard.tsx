import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cardAlt } from "../../../lib/ui";
import { cn } from "../../../lib/cn";

type EntryCardProps = {
  index: number;
  count: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  children: React.ReactNode;
};

/**
 * Shared chrome (up/down reorder + remove) for one repeatable entry inside a
 * list-based resume section (education, experience, projects,
 * certifications, awards) — factored out since every one of those sections
 * needs identical add/remove/reorder controls around otherwise different
 * field layouts.
 */
export function EntryCard({ index, count, onMoveUp, onMoveDown, onRemove, children }: EntryCardProps) {
  return (
    <div className={cn(cardAlt, "space-y-3")}>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move up"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === count - 1}
          aria-label="Move down"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}
