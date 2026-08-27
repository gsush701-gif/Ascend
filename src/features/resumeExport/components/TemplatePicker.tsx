import { Check } from "lucide-react";
import { cn } from "../../../lib/cn";
import { RESUME_TEMPLATES } from "../templateRegistry";
import type { ResumeTemplateId } from "../templateRegistry";

type TemplatePickerProps = {
  value: ResumeTemplateId;
  onChange: (id: ResumeTemplateId) => void;
};

/**
 * Labeled-card template picker — no dedicated "choice card" primitive
 * exists yet in src/components/ui/ (checked before building this), so this
 * is a small local component styled to match the app's existing `card`
 * token (src/lib/ui.ts) and cyan selection accent rather than a generic
 * radio/select control.
 */
export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div role="radiogroup" aria-label="Resume PDF template" className="grid gap-2 sm:grid-cols-3">
      {RESUME_TEMPLATES.map((template) => {
        const selected = template.id === value;
        return (
          <button
            key={template.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(template.id)}
            className={cn(
              "btn-press flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
              selected
                ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.4)]"
                : "border-slate-200 bg-slate-900/[0.04] hover:bg-slate-900/[0.06]",
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{template.label}</span>
              {selected && <Check className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />}
            </div>
            <span className="text-xs leading-snug text-slate-500">{template.description}</span>
          </button>
        );
      })}
    </div>
  );
}
