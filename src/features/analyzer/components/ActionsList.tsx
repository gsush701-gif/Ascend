import { getTangibleResumeExample } from "../utils";

type ActionsListProps = { actions: string[] };

export function ActionsList({ actions }: ActionsListProps) {
  return (
    <div className="space-y-3">
      {actions.map((a, i) => {
        const example = getTangibleResumeExample(a);
        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 pl-3 pr-3 py-2.5 text-sm"
          >
            <span className="text-emerald-600 shrink-0 mt-0.5">✅</span>
            <div className="min-w-0">
              <span className="text-slate-500">Example phrasing: </span>
              <span className="text-slate-900 font-medium italic">
                &ldquo;{example}&rdquo;
              </span>
              <p className="mt-1 text-xs text-slate-400">
                A template, not your data — swap in your real project, tools, and numbers.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
