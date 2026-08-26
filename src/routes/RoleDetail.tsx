import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { alignmentToPreparedness } from "../lib/preparedness";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { useTracker } from "../features/tracker/hooks/useTracker";
import type { TrackerStatus } from "../types/tracker";
import { TRACKER_STATUS_ORDER } from "../types/tracker";
import { MissingSignals } from "../features/analyzer/components/MissingSignals";
import { ActionsList } from "../features/analyzer/components/ActionsList";
import { ApplicationDetailsPanel } from "../components/roles/ApplicationDetailsPanel";

const STATUS_OPTIONS: TrackerStatus[] = TRACKER_STATUS_ORDER;

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

  return (
    <AppShell>
      <div className="animate-fade-in space-y-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/roles")}
            className="btn-press flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-900/[0.06]"
          >
            <ArrowLeft size={18} />
            Roles
          </button>
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

            {missingSignals.length > 0 && (
              <Panel title="Skill gaps" subtitle="Focus on these to improve fit.">
                <MissingSignals
                  signals={missingSignals}
                  resumeStrength={null}
                />
              </Panel>
            )}

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
