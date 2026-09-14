import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { alignmentToPreparedness } from "../lib/preparedness";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { useTracker } from "../features/tracker/hooks/useTracker";
import type { TrackerStatus } from "../types/tracker";
import { TRACKER_STATUS_ORDER } from "../types/tracker";
import { MissingSignals } from "../features/analyzer/components/MissingSignals";
import { ActionsList } from "../features/analyzer/components/ActionsList";
import { SkillGapHelper } from "../features/analyzer/components/SkillGapHelper";
import { ApplicationDetailsPanel } from "../components/roles/ApplicationDetailsPanel";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/apiError";
import { useProfile } from "../lib/profile";
import { getCompatibilityNotes } from "../features/preferences/compatibility";

const STATUS_OPTIONS: TrackerStatus[] = TRACKER_STATUS_ORDER;

/**
 * "Ask AI about this role" — same /api/career-advice request as before,
 * moved here unchanged from the role detail drawer
 * (src/components/roles/RoleDetailDrawer.tsx).
 */
function AskAboutRolePanel({ roleId }: { roleId: string }) {
  const { session } = useAuth();
  const [askQuestion, setAskQuestion] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);

  async function runAskAboutRole() {
    const question = askQuestion.trim();
    if (!question) return;
    setAskLoading(true);
    setAskError(null);
    try {
      const res = await fetch(`${API_BASE}/api/career-advice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ question, roleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to get an answer"));
      setAskAnswer(data.answer);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Failed to get an answer");
    } finally {
      setAskLoading(false);
    }
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-700">
            <Sparkles size={14} />
          </span>
          Ask AI about this role
        </span>
      }
      subtitle="Answers are grounded in your real fit score and matched/missing skills for this role."
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !askLoading) runAskAboutRole();
            }}
            placeholder="e.g. Should I apply to this job?"
            maxLength={500}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
          />
          <button
            type="button"
            onClick={runAskAboutRole}
            disabled={askLoading || !askQuestion.trim()}
            className="btn-press inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {askLoading ? (
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
          </button>
        </div>

        {!askAnswer && !askLoading && !askError && (
          <div className="flex flex-wrap gap-1.5">
            {[
              "Should I apply to this role?",
              "How strong a fit am I?",
              "What should I improve first?",
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAskQuestion(q)}
                className="btn-press rounded-full border border-slate-200 bg-slate-900/[0.03] px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-900/[0.06] hover:text-slate-900"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {askError && (
          <p className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {askError}
          </p>
        )}

        {askAnswer && !askError && (
          <div className="animate-fade-in rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
              <Sparkles size={12} />
              AI answer
            </div>
            <p className="text-sm leading-relaxed text-slate-800">{askAnswer}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function RoleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    tracker,
    updateStatus,
    updateNextStep,
    updateNotes,
    updateDeadline,
    updateRoleFields,
    removeItem,
  } = useTracker(undefined);
  const { profile } = useProfile();

  const item = id ? tracker.find((x) => x.id === id) : null;

  if (!item) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-slate-500">Role not found.</p>
          <button
            type="button"
            onClick={() => navigate("/roles")}
            className="mt-4 text-sm text-slate-700 underline hover:text-slate-900"
          >
            Back to Roles
          </button>
        </div>
      </AppShell>
    );
  }

  const snap = item.reportSnapshot;
  const alignment = snap?.alignment ?? item.alignment;
  const missingSignals = snap?.missingSignals ?? [];
  const actions = snap?.actions ?? [];
  const missingRequiredSkills = (snap?.skills ?? [])
    .filter((s) => s.status === "miss" && (s.importance ?? "required") === "required")
    .map((s) => s.name);
  const compatibilityNotes = profile ? getCompatibilityNotes(item, profile) : [];

  return (
    <AppShell>
      <div className="animate-fade-in space-y-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/roles", { state: { openRoleId: item.id } })}
            className="btn-press flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-900/[0.06]"
          >
            <ArrowLeft size={18} />
            Back to role
          </button>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Role report
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-6">
            <Panel>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    {item.role}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">{item.company}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold tracking-tight text-slate-900">
                    {alignmentToPreparedness(alignment)}
                  </div>
                  <div className="text-xs text-slate-500">Preparedness</div>
                </div>
              </div>
            </Panel>

            <AskAboutRolePanel roleId={item.id} />

            {snap?.salary && (
              <Panel title="Salary" subtitle="Extracted from this role's job description text.">
                <p className="text-lg font-semibold text-slate-900">
                  {snap.salary.currency} {snap.salary.min.toLocaleString()}–{snap.salary.max.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-slate-500">
                    {snap.salary.period === "hourly" ? "/hour" : "/year"}
                  </span>
                </p>
                {snap.salary.estimatedAnnual && (
                  <p className="mt-1 text-xs text-slate-500">
                    Estimated annual: {snap.salary.currency}{" "}
                    {snap.salary.estimatedAnnual.min.toLocaleString()}–
                    {snap.salary.estimatedAnnual.max.toLocaleString()}. {snap.salary.estimatedAnnual.note}
                  </p>
                )}
              </Panel>
            )}

            {missingSignals.length > 0 && (
              <Panel title="Skill gaps" subtitle="Focus on these to improve fit.">
                <MissingSignals
                  signals={missingSignals}
                  resumeStrength={null}
                />
              </Panel>
            )}

            <SkillGapHelper missingRequiredSkills={missingRequiredSkills} />

            {actions.length > 0 && (
              <Panel title="Suggested improvements" subtitle="From your last analysis.">
                <ActionsList actions={actions} />
              </Panel>
            )}

            {!snap && (
              <Panel>
                <p className="text-sm text-slate-500">
                  No analysis yet. Run the Analyzer for this role to see skill
                  gaps and improvements.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/analyzer", {
                      state: {
                        roleId: item.id,
                        jobDescription: item.jobDescription,
                        previousReport: undefined,
                      },
                    })
                  }
                  className="btn-press mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
                >
                  Analyze this role
                </button>
              </Panel>
            )}

          </div>

          <div className="lg:col-span-5 space-y-6">
            <Panel title="Application status" subtitle="Track your progress.">
              <select
                value={item.status}
                onChange={(e) =>
                  updateStatus(item.id, e.target.value as TrackerStatus)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="mt-4">
                <label className="block text-xs text-slate-500">Next step</label>
                <input
                  type="text"
                  value={item.nextStep}
                  onChange={(e) => updateNextStep(item.id, e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                  placeholder="e.g. Apply by Friday"
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs text-slate-500">Deadline</label>
                <input
                  type="text"
                  value={item.deadline ?? ""}
                  onChange={(e) => updateDeadline(item.id, e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                  placeholder="e.g. Feb 15"
                />
              </div>
            </Panel>

            <Panel title="Notes" subtitle="Free-form notes for this role.">
              <textarea
                value={item.notes ?? ""}
                onChange={(e) => updateNotes(item.id, e.target.value)}
                placeholder="Deadlines, contact, follow-ups..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none resize-none"
              />
            </Panel>

            {compatibilityNotes.length > 0 && (
              <Panel
                title="Compatibility with your preferences"
                subtitle="A plain comparison of this role's stated info against your profile — not a score, and not legal advice."
              >
                <ul className="space-y-2">
                  {compatibilityNotes.map((note, i) => (
                    <li
                      key={i}
                      className={
                        "rounded-lg px-3 py-2 text-sm " +
                        (note.tone === "match"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : note.tone === "mismatch"
                          ? "bg-amber-500/10 text-amber-800"
                          : "bg-slate-900/[0.04] text-slate-600")
                      }
                    >
                      {note.text}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <ApplicationDetailsPanel item={item} updateRoleFields={updateRoleFields} />

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/analyzer", {
                      state: {
                        roleId: item.id,
                        jobDescription: item.jobDescription,
                        previousReport: snap ? { alignment: snap.alignment, coverage: snap.coverage } : undefined,
                      },
                    })
                  }
                  className="btn-press flex-1 rounded-xl bg-cyan-500 py-2.5 px-4 text-sm font-semibold text-black transition hover:bg-cyan-400"
                >
                  Re-analyze
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/resume-lab", { state: item.jobDescription ? { jobDescription: item.jobDescription } : undefined })}
                  className="btn-press rounded-xl border border-slate-200 bg-slate-900/[0.04] py-2.5 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                >
                  Improve bullets for this role
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Remove this role from your list?")) {
                    removeItem(item.id);
                    navigate("/roles");
                  }
                }}
                className="btn-press rounded-xl py-2.5 px-4 text-sm font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600"
              >
                Remove role
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
