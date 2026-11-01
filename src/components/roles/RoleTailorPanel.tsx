import { useState } from "react";
import { ClipboardCopy, Sparkles } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { toast } from "../ui/toast";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../config/api";
import { getApiErrorMessage } from "../../lib/apiError";
import { extractResumeText } from "../../lib/docx";
import { groupSkills } from "../../features/analyzer/skillGroups";
import type { TrackerItem } from "../../types/tracker";

type TailoredBullet = { original: string; rewritten: string; why: string; needs: string[] };

type Props = {
  item: TrackerItem;
  /** Loads the resume to work from (the role's own, else the default saved one). */
  getResumeFile: () => Promise<File | null>;
};

/** Renders a rewrite with its [blanks] picked out so they can't be missed. */
function WithBlanks({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <span key={i} className="rounded bg-amber-100 px-1 text-amber-900">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * Rewrites a few of the student's OWN resume bullets so they speak to this
 * job. It never invents achievements: where a bullet is missing something the
 * posting cares about (a tool, a number, a result) it leaves a highlighted blank
 * for the student to fill in truthfully. The server checks every suggestion
 * against the resume before it gets here.
 */
export function RoleTailorPanel({ item, getResumeFile }: Props) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [bullets, setBullets] = useState<TailoredBullet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jd = item.jobDescription?.trim() ?? "";
  const hasJd = jd.length >= 20;

  async function run() {
    if (!hasJd || busy) return;
    setBusy(true);
    setError(null);
    try {
      const file = await getResumeFile();
      if (!file) return; // the loader already told the user why
      const resumeText = await extractResumeText(file);
      if (resumeText.trim().length < 30) {
        setError("We couldn't read any text in that resume. Try a text-based PDF or a Word file.");
        return;
      }
      const groups = groupSkills(item.reportSnapshot?.skills);
      const res = await fetch(`${API_BASE}/api/tailor-bullets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          resumeText,
          jobDescription: jd,
          missingSkills: [...groups.missingRequired, ...groups.missingPreferred],
          matchedSkills: groups.matched,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 429
            ? "You've used this month's job-tailored rewrites. They reset at the start of next month."
            : getApiErrorMessage(data, "Couldn't rewrite your bullets right now. Please try again."),
        );
        return;
      }
      setBullets(Array.isArray(data.bullets) ? (data.bullets as TailoredBullet[]) : []);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success({ title: "Copied", description: "Fill in the highlighted blanks before you use it." });
    } catch {
      toast.error({ title: "Couldn't copy", description: "Select the text and copy it manually." });
    }
  }

  return (
    <Panel
      title="Tailor your resume for this job"
      subtitle="Rewrites a few of your own bullets so they speak to this posting. Nothing is invented."
    >
      {!hasJd ? (
        <p className="text-sm text-slate-500">Add this role&apos;s job description first, then come back here.</p>
      ) : (
        <div className="space-y-4">
          <Button type="button" size="sm" onClick={run} disabled={busy}>
            <span className="inline-flex items-center gap-2">
              <Sparkles size={14} />
              {busy ? "Reading your resume…" : bullets ? "Rewrite again" : "Rewrite my weakest bullets"}
            </span>
          </Button>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {bullets && bullets.length === 0 && !error && (
            <p className="text-sm text-slate-600">
              Nothing worth rewording here: your bullets already read clearly for this posting, or the resume has no
              bullet points to work from.
            </p>
          )}

          {bullets && bullets.length > 0 && (
            <>
              <ul className="space-y-4">
                {bullets.map((b) => (
                  <li key={b.original} className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Your bullet</div>
                    <p className="text-sm text-slate-500">{b.original}</p>
                    <div className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-cyan-700">
                      Tailored for this job
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-slate-900">
                      <WithBlanks text={b.rewritten} />
                    </p>
                    {b.why && <p className="mt-1.5 text-xs text-slate-500">{b.why}</p>}
                    <button
                      type="button"
                      onClick={() => void copy(b.rewritten)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs leading-relaxed text-slate-500">
                Replace each highlighted blank with something true, or delete the blank if you have nothing to add.
                Only keep what you can back up in an interview.
              </p>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
