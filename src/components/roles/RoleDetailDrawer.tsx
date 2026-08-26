import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Copy, FileText, Sparkles, MessageSquare } from "lucide-react";
import { alignmentToPreparedness } from "../../lib/preparedness";
import { Panel } from "../ui/Panel";
import type { TrackerItem, TrackerStatus } from "../../types/tracker";
import { TRACKER_STATUS_ORDER } from "../../types/tracker";
import { MissingSignals } from "../../features/analyzer/components/MissingSignals";
import { ActionsList } from "../../features/analyzer/components/ActionsList";
import { extractTextFromPdf } from "../../lib/pdf";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { ApplicationDetailsPanel } from "./ApplicationDetailsPanel";
import { getApiErrorMessage } from "../../lib/apiError";
import { logEvent } from "../../lib/analytics";

const STATUS_OPTIONS: TrackerStatus[] = TRACKER_STATUS_ORDER;

type CoverLetterResult = { coverLetter: string; keyPoints: string[] };

type RoleDetailDrawerProps = {
  item: TrackerItem;
  onClose: () => void;
  updateStatus: (id: string, status: TrackerStatus) => void;
  updateNextStep: (id: string, next: string) => void;
  updateNotes: (id: string, notes: string) => void;
  updateDeadline: (id: string, deadline: string) => void;
  updateCoverLetter: (id: string, coverLetter: string) => void;
  updateRoleFields: (id: string, fields: Partial<TrackerItem>) => void;
  removeItem: (id: string) => void;
};

export function RoleDetailDrawer({
  item,
  onClose,
  updateStatus,
  updateNextStep,
  updateNotes,
  updateDeadline,
  updateCoverLetter,
  updateRoleFields,
  removeItem,
}: RoleDetailDrawerProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const snap = item.reportSnapshot;
  const alignment = snap?.alignment ?? item.alignment;
  const missingSignals = snap?.missingSignals ?? [];
  const actions = snap?.actions ?? [];

  // Cover letter generation state (kept here rather than in useTracker since
  // it's transient UI/request state, not persisted tracker data).
  const [clFile, setClFile] = useState<File | null>(null);
  const [clShowForm, setClShowForm] = useState(false);
  const [clLoading, setClLoading] = useState(false);
  const [clSlow, setClSlow] = useState(false);
  const [clError, setClError] = useState<string | null>(null);
  const [clResult, setClResult] = useState<CoverLetterResult | null>(null);
  const [clCopyLabel, setClCopyLabel] = useState<"Copy" | "Copied!">("Copy");

  const clFormVisible = clShowForm || !item.coverLetter;
  const clDisplayText = clResult?.coverLetter ?? item.coverLetter ?? "";

  async function runGenerateCoverLetter() {
    if (!clFile) return;
    setClError(null);
    setClLoading(true);
    setClSlow(false);
    const slowTimer = setTimeout(() => setClSlow(true), 6000);
    try {
      const text = await extractTextFromPdf(clFile);
      if (text.trim().length < 30) {
        throw new Error(
          "Could not extract enough text from this PDF. Try a text-based (not scanned) PDF.",
        );
      }
      const res = await fetch(`${API_BASE}/api/generate-cover-letter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          resumeText: text,
          jobDescription: item.jobDescription || "",
          companyName: item.company,
          roleTitle: item.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));
      setClResult(data);
      setClShowForm(false);
      updateCoverLetter(item.id, data.coverLetter);
      logEvent("cover_letter_generated");
    } catch (e) {
      setClError(
        e instanceof Error ? e.message : "Failed to generate cover letter",
      );
    } finally {
      clearTimeout(slowTimer);
      setClLoading(false);
      setClSlow(false);
    }
  }

  function handleCopyCoverLetter() {
    if (!clDisplayText) return;
    navigator.clipboard.writeText(clDisplayText).then(() => {
      setClCopyLabel("Copied!");
      setTimeout(() => setClCopyLabel("Copy"), 2000);
    });
  }

  function startRegenerate() {
    setClResult(null);
    setClError(null);
    setClShowForm(true);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleRemove = () => {
    if (window.confirm("Remove this role from your list?")) {
      removeItem(item.id);
      onClose();
    }
  };

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-full w-[400px] shrink-0 flex-col border-l border-slate-200 bg-[#FFFFFF] shadow-xl animate-drawer-slide-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-[#FFFFFF] px-4 py-3 pt-16">
        <h2 id="drawer-title" className="truncate text-base font-semibold text-slate-900">
          {item.role} at {item.company}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-900/[0.06] hover:text-slate-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <Panel>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{item.role}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.company}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-slate-900">
                  {alignmentToPreparedness(alignment)}
                </div>
                <div className="text-xs text-slate-500">Preparedness</div>
              </div>
            </div>
          </Panel>

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
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
            />
          </Panel>

          <ApplicationDetailsPanel item={item} updateRoleFields={updateRoleFields} />

          {missingSignals.length > 0 && (
            <Panel title="Skill gaps" subtitle="Focus on these to improve fit.">
              <MissingSignals signals={missingSignals} resumeStrength={null} />
            </Panel>
          )}

          {actions.length > 0 && (
            <Panel
              title="Suggested improvements"
              subtitle="From your last analysis."
            >
              <ActionsList actions={actions} />
            </Panel>
          )}

          {!snap && (
            <Panel>
              <p className="text-sm text-slate-500">
                No analysis yet. Run the Analyzer for this role to see skill gaps
                and improvements.
              </p>
            </Panel>
          )}

          <Panel
            title="Cover letter"
            subtitle="AI-drafted from this role's job description and your resume."
          >
            {clError && (
              <p className="mb-3 text-sm text-red-600">{clError}</p>
            )}

            {!clFormVisible ? (
              <div key="result" className="animate-fade-in space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {clDisplayText}
                </p>
                {clResult?.keyPoints && clResult.keyPoints.length > 0 && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      What this emphasizes
                    </div>
                    <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
                      {clResult.keyPoints.map((k, i) => (
                        <li key={i}>• {k}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCoverLetter}
                    className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                  >
                    <Copy size={14} />
                    {clCopyLabel}
                  </button>
                  <button
                    type="button"
                    onClick={startRegenerate}
                    className="btn-press rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ) : !item.jobDescription ? (
              <p key="no-jd" className="animate-fade-in text-sm text-slate-500">
                This role needs a job description before a cover letter can
                be generated. Add one via Analyze or Re-analyze this role.
              </p>
            ) : (
              <div key="form" className="animate-fade-in space-y-3">
                <p className="text-sm text-slate-500">
                  Upload your resume PDF and we&apos;ll draft a cover letter
                  tailored to this role.
                </p>
                <label className="block cursor-pointer">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm hover:bg-slate-900/[0.06] transition">
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileText size={16} />
                      <span>{clFile ? clFile.name : "Choose resume PDF"}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      Max 5MB
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        setClFile(e.target.files?.[0] || null);
                        setClError(null);
                      }}
                    />
                  </div>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runGenerateCoverLetter}
                    disabled={clLoading || !clFile}
                    className="btn-press flex-1 rounded-xl bg-cyan-500 py-2.5 px-4 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {clLoading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-700 border-t-transparent" />
                        Generating…
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Sparkles size={16} />
                        Generate cover letter
                      </span>
                    )}
                  </button>
                  {item.coverLetter && (
                    <button
                      type="button"
                      onClick={() => {
                        setClShowForm(false);
                        setClError(null);
                      }}
                      className="btn-press rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {clLoading && clSlow && (
                  <p className="text-xs text-slate-500">
                    Still working — the server may be waking up from idle,
                    this can take up to a minute.
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="Interview prep"
            subtitle="AI mock interview questions tailored to this role."
          >
            {!item.jobDescription ? (
              <p className="text-sm text-slate-500">
                This role needs a job description before interview questions
                can be generated. Add one via Analyze or Re-analyze this role.
              </p>
            ) : item.interviewPrep ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  {item.interviewPrep.questions.length} questions generated
                  {item.interviewPrep.generatedAt
                    ? ` · ${new Date(item.interviewPrep.generatedAt).toLocaleDateString()}`
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/roles/${item.id}/interview-prep`);
                  }}
                  className="btn-press w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] py-2.5 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                >
                  Continue practicing
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  Generate a mix of behavioral and technical questions
                  grounded in this role&apos;s job description, then practice
                  answers and get feedback.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/roles/${item.id}/interview-prep`);
                  }}
                  className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 px-4 text-sm font-semibold text-black transition hover:bg-cyan-400"
                >
                  <MessageSquare size={16} />
                  Start interview prep
                </button>
              </div>
            )}
          </Panel>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                navigate("/analyzer", {
                  state: {
                    roleId: item.id,
                    jobDescription: item.jobDescription,
                    previousReport: snap ? { alignment: snap.alignment, coverage: snap.coverage } : undefined,
                  },
                });
                }}
                className="btn-press flex-1 rounded-xl bg-cyan-500 py-2.5 px-4 text-sm font-semibold text-black transition hover:bg-cyan-400"
              >
                Re-analyze
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/resume-lab", { state: item.jobDescription ? { jobDescription: item.jobDescription } : undefined });
                }}
                className="btn-press rounded-xl border border-slate-300 bg-slate-900/[0.04] py-2.5 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
              >
                Improve bullets
              </button>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="btn-press rounded-xl py-2.5 px-4 text-sm font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600"
            >
              Remove role
            </button>
          </div>
        </div>
      </aside>
  );
}
