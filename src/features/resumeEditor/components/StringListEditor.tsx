import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { badge } from "../../../lib/ui";
import { cn } from "../../../lib/cn";

type StringListEditorProps = {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

/** Chip-style add/remove editor for a flat `string[]` — shared by
 * SkillsSection (skills) and ProjectsSection (each project's technologies). */
export function StringListEditor({ items, onChange, placeholder = "Add and press Enter" }: StringListEditorProps) {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft("");
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.length === 0 && <p className="text-xs text-slate-400">None yet.</p>}
        {items.map((item, index) => (
          <span key={`${item}-${index}`} className={cn(badge, "gap-1.5 pr-1")}>
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Remove ${item}`}
              className="rounded p-0.5 hover:bg-slate-900/[0.08]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={placeholder}
          className="h-9"
        />
        <button
          type="button"
          onClick={addDraft}
          className="btn-press rounded-lg border border-slate-200 bg-slate-900/[0.04] px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
        >
          Add
        </button>
      </div>
    </div>
  );
}
