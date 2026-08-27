import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Textarea } from "../../../components/ui/Textarea";
import { moveArrayItem, removeArrayItem, updateArrayItem } from "../arrayHelpers";

type BulletListEditorProps = {
  bullets: string[];
  onChange: (next: string[]) => void;
  label?: string;
};

/** Add/edit/remove/reorder editor for a `string[]` of resume bullets, shared
 * by ExperienceSection and ProjectsSection. */
export function BulletListEditor({ bullets, onChange, label = "Bullets" }: BulletListEditorProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...bullets, ""])}
          className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-800"
        >
          <Plus className="h-3 w-3" /> Add bullet
        </button>
      </div>
      <div className="space-y-2">
        {bullets.length === 0 && <p className="text-xs text-slate-400">No bullets yet.</p>}
        {bullets.map((bullet, index) => (
          <div key={index} className="flex items-start gap-1.5">
            <Textarea
              value={bullet}
              onChange={(e) => onChange(updateArrayItem(bullets, index, e.target.value))}
              rows={2}
              className="min-h-0 flex-1"
            />
            <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
              <button
                type="button"
                onClick={() => onChange(moveArrayItem(bullets, index, -1))}
                disabled={index === 0}
                aria-label="Move bullet up"
                className="rounded p-1 text-slate-400 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onChange(moveArrayItem(bullets, index, 1))}
                disabled={index === bullets.length - 1}
                aria-label="Move bullet down"
                className="rounded p-1 text-slate-400 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onChange(removeArrayItem(bullets, index))}
                aria-label="Remove bullet"
                className="rounded p-1 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
