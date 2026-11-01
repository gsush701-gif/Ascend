import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { pageHeader, pageTitle, pageSubtitle } from "../lib/ui";
import { useAuth } from "../context/AuthContext";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { API_BASE } from "../config/api";
import { getApiErrorMessage } from "../lib/apiError";

/**
 * Standalone home for the AI career advisor (Grok AI). This is a new,
 * discoverable ENTRY POINT for the exact same feature already available
 * inside RoleDetailDrawer's "Ask AI about this role" panel — it calls the
 * same POST /api/career-advice endpoint with the same { question, roleId? }
 * shape and the same auth. Nothing about the feature, prompts, or data flow
 * changes here; only where users can reach it.
 *
 * The optional role selector lets an answer stay grounded in a specific
 * tracked role's fit score / skill gaps (roleId is looked up + ownership-
 * checked server-side, exactly as the drawer already does); leaving it on
 * "General question" simply omits roleId, which the endpoint already
 * supports (it falls back to the user's profile target-role context).
 */

const SUGGESTED_QUESTIONS = [
  "Am I a strong fit for my target role?",
  "What should I improve first on my resume?",
  "How many roles should I apply to each week?",
  "What's the highest-leverage thing I can do this week?",
];

export function Grok() {
  const { session } = useAuth();
  const { tracker } = useTracker(undefined);

  const [roleId, setRoleId] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);

  const roleOptions = useMemo(
    () => [
      { value: "", label: "General question (no specific role)" },
      ...tracker.map((t) => ({ value: t.id, label: `${t.role} — ${t.company}` })),
    ],
    [tracker],
  );

  async function runAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/career-advice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(roleId ? { question: q, roleId } : { question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to get an answer"));
      setAnswer(data.answer);
      setAskedQuestion(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get an answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 pb-12">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                Grok AI
              </span>
            </h1>
            <p className={pageSubtitle}>
              Your AI career advisor — direct, honest answers grounded in your real data.
            </p>
          </div>
        </header>

        <Panel>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Context (optional)
              </label>
              <Select
                value={roleId}
                onChange={setRoleId}
                options={roleOptions}
                placeholder="General question (no specific role)"
                buttonClassName="w-full"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Pick a tracked role to ground the answer in that role&apos;s fit score and skill gaps.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Your question
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) runAsk();
                  }}
                  placeholder="e.g. Should I apply to this job?"
                  maxLength={500}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
                />
                <Button
                  type="button"
                  onClick={runAsk}
                  disabled={loading || !question.trim()}
                  variant="primary"
                >
                  {loading ? (
                    <>
                      <span className="spinner inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-700 border-t-transparent" />
                      Asking…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Ask
                    </>
                  )}
                </Button>
              </div>
            </div>

            {!answer && !loading && !error && (
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuestion(q)}
                    className="btn-press rounded-full border border-slate-200 bg-slate-900/[0.03] px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-900/[0.06] hover:text-slate-900"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {answer && !error && (
              <div className="animate-fade-in space-y-2">
                {askedQuestion && (
                  <p className="text-sm font-medium text-slate-900">{askedQuestion}</p>
                )}
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                    <Sparkles size={12} />
                    Grok AI
                  </div>
                  <p className="text-sm leading-relaxed text-slate-800">{answer}</p>
                </div>
              </div>
            )}
          </div>
        </Panel>

        <p className="text-center text-xs text-slate-400">
          Also available on any tracked role — open a role from{" "}
          <span className="font-medium text-slate-500">Roles</span> and use
          &ldquo;Ask AI about this role&rdquo;.
        </p>
      </div>
    </AppShell>
  );
}
