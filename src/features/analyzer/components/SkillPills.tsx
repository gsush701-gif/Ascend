import { cn } from "../../../lib/cn";
import type { SkillRow } from "../../../types/analyzer";

type SkillPillsProps = {
  skills: SkillRow[];
  max?: number;
};

export function SkillPills({ skills, max = 12 }: SkillPillsProps) {
  const slice = skills.slice(0, max);
  return (
    <div className="flex flex-wrap gap-2">
      {slice.map((s, idx) => (
        <span
          key={idx}
          className={cn(
            "rounded-2xl border px-3 py-1 text-xs",
            s.status === "hit"
              ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200"
              : "border-rose-900/60 bg-rose-950/40 text-rose-200"
          )}
        >
          {s.name}
        </span>
      ))}
    </div>
  );
}
