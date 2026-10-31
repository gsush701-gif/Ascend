import { useState } from "react";
import { Check, ClipboardCopy, Download, PenLine, Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/toast";
import {
  additionsToText,
  starterFor,
  upsertAddition,
  validateAddition,
  type ResumeAddition,
} from "../additions";

type MissingSkill = { name: string; importance: string };

type Props = {
  missingSkills: MissingSkill[];
  additions: ResumeAddition[];
  onChange: (next: ResumeAddition[]) => void;
  /** Re-runs the analysis with the additions counted. */
  onRecheck: () => void;
  rechecking: boolean;
  /** Scores before any additions were counted, to show the change. */
  baseline: { alignment: number; coverage: number } | null;
  /** Current result, already including the additions when `projected`. */
  current: { alignment: number; coverage: number } | null;
  projected: boolean;
};

/**
 * "Fix gaps as you go": pick a missing skill, write a real bullet for it, and
 * re-check the score with those lines counted — without exporting a PDF first.
 * Deliberately doesn't prefill invented numbers; the user states what they
 * actually did. The re-checked score is a projection (the PDF is unchanged), so
 * the panel says so and offers the bullets to copy into the real resume.
 */
export function ResumeAdditionsPanel({
  missingSkills,
  additions,
  onChange,
  onRecheck,
  rechecking,
  baseline,
  current,
  projected,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const addedSkills = new Set(additions.map((a) => a.skill.trim().toLowerCase()));
  const error = editing ? validateAddition(editing, draft) : null;

  function startEditing(skill: string) {
    const existing = additions.find((a) => a.skill.trim().toLowerCase() === skill.trim().toLowerCase());
    setEditing(skill);
    setDraft(existing ? existing.text : starterFor(skill));
  }

  function commit() {
    if (!editing || error) return;
    onChange(upsertAddition(additions, { skill: editing, text: draft }));
    setEditing(null);
    setDraft("");
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(additionsToText(additions));
      toast.success({ title: "Copied", description: "Paste these bullets into your resume." });
    } catch {
      toast.error({ title: "Couldn't copy", description: "Select the text and copy it manually." });
    }
  }

  function download() {
    const blob = new Blob([additionsToText(additions)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-additions.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (missingSkills.length === 0 && additions.length === 0) return null;

  const delta = baseline && current ? current.alignment - baseline.alignment : null;

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.04] p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-700">
        <PenLine className="h-3.5 w-3.5" />
        Fix gaps as you go
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Write a real bullet for a missing skill and re-check your score. Only add things that are true.
      </p>

      {missingSkills.length > 0 && (
        <ul className="mt-3 space-y-2">
          {missingSkills.slice(0, 8).map((s) => {
            const added = addedSkills.has(s.name.trim().toLowerCase());
            const isEditing = editing === s.name;
            return (
              <li key={s.name} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{s.name}</span>
                  {s.importance === "required" && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                      Required
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => (isEditing ? setEditing(null) : startEditing(s.name))}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:border-cyan-400/60 hover:text-slate-900"
                  >
                    {added ? <Check className="h-3 w-3 text-emerald-600" /> : <Plus className="h-3 w-3" />}
                    {added ? "Edit bullet" : "Add to my resume"}
                  </button>
                </div>
                {isEditing && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      maxLength={300}
                      autoFocus
                      // Start typing after the "Used X to " stem, not before it.
                      onFocus={(e) => {
                        const end = e.currentTarget.value.length;
                        e.currentTarget.setSelectionRange(end, end);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      aria-label={`Resume bullet that shows ${s.name}`}
                    />
                    <p className="text-[11px] text-slate-400">
                      Say what you actually did, with the tool and a result if you have one.
                    </p>
                    {draft.trim().length > 0 && error && <p className="text-xs text-amber-700">{error}</p>}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={commit} disabled={Boolean(error)}>
                        Add bullet
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {additions.length > 0 && (
        <div className="mt-4 border-t border-cyan-500/20 pt-3">
          <div className="text-xs font-medium text-slate-600">Your additions ({additions.length})</div>
          <ul className="mt-2 space-y-1.5">
            {additions.map((a) => (
              <li
                key={a.skill}
                className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
              >
                <span className="min-w-0 flex-1">{a.text}</span>
                <button
                  type="button"
                  onClick={() => onChange(additions.filter((x) => x.skill !== a.skill))}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600"
                  aria-label={`Remove the ${a.skill} bullet`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={onRecheck} disabled={rechecking}>
              {rechecking ? "Re-checking…" : "Re-check my score with these"}
            </Button>
            <button
              type="button"
              onClick={copyAll}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy
            </button>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              Download .txt
            </button>
          </div>

          {projected && delta !== null && baseline && current && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Projected fit score: {baseline.alignment} → {current.alignment} ({delta >= 0 ? "+" : ""}
              {delta}).
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            This is a projection: these lines aren&apos;t in your resume file yet. Add them to your resume, upload the
            new PDF, and analyze again to make it official.
          </p>
        </div>
      )}
    </div>
  );
}
