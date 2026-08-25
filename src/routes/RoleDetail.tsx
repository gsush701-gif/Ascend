import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, FileText, Sparkles } from "lucide-react";
import { alignmentToPreparedness } from "../lib/preparedness";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { useTracker } from "../features/tracker/hooks/useTracker";
import type { TrackerStatus } from "../types/tracker";
import { MissingSignals } from "../features/analyzer/components/MissingSignals";
import { ActionsList } from "../features/analyzer/components/ActionsList";
import { extractTextFromPdf } from "../lib/pdf";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";

type CoverLetterResult = { coverLetter: string; keyPoints: string[] };

const STATUS_OPTIONS: TrackerStatus[] = [
  "Wishlist",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

export function RoleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    tracker,
    updateStatus,
    updateNextStep,
    updateNotes,
    updateDeadline,
    updateCoverLetter,
    removeItem,
  } = useTracker(undefined);

  const item = id ? tracker.find((x) => x.id === id) : null;

  // Cover letter generation state (kept here rather than in useTracker since
  // it's transient UI/request state, not persisted tracker data).
  const [clFile, setClFile] = useState<File | null>(null);
  const [clShowForm, setClShowForm] = useState(false);
  const [clLoading, setClLoading] = useState(false);
  const [clSlow, setClSlow] = useState(false);
  const [clError, setClError] = useState<string | null>(null);
  const [clResult, setClResult] = useState<CoverLetterResult | null>(null);
  const [clCopyLabel, setClCopyLabel] = useState<"Copy" | "Copied!">("Copy");

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

  // Show the upload/generate form whenever there's no saved letter yet, or
  // the user explicitly asked to regenerate.
  const clFormVisible = clShowForm || !item.coverLetter;
  const clDisplayText = clResult?.coverLetter ?? item.coverLetter ?? "";

  async function runGenerateCoverLetter() {
    if (!item || !clFile) return;
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
      if (!res.ok) throw new Error(data?.error || "AI request failed");
      setClResult(data);
      setClShowForm(false);
      updateCoverLetter(item.id, data.coverLetter);
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

  return (
    <AppShell>
      <div className="space-y-8">
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
