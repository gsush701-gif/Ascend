import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Wand2,
  ClipboardList,
  StickyNote,
  Target,
  Users,
  FileEdit,
} from "lucide-react";
import { alignmentToPreparedness } from "../lib/preparedness";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { DarkSelect } from "../components/ui/DarkSelect";
import { fileNameFor, kindOfPath, mimeFor } from "../lib/resumeFile";
import { RoleGapsPanel } from "../components/roles/RoleGapsPanel";
import { AnimatedBar } from "../components/ui/AnimatedBar";
import { Modal } from "../components/ui/Modal";
import { useTracker } from "../features/tracker/hooks/useTracker";
import type { TrackerStatus } from "../types/tracker";
import { TRACKER_STATUS_ORDER } from "../types/tracker";
import { SkillGapHelper } from "../features/analyzer/components/SkillGapHelper";
import { RoleResumePdfPanel } from "../components/roles/RoleResumePdfPanel";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/apiError";
import { useProfile } from "../lib/profile";
import { getCompatibilityNotes } from "../features/preferences/compatibility";
import { STATUS_SELECT_STYLES, buttonPrimary, buttonSecondary } from "../lib/ui";
import { useAnalyzer } from "../features/analyzer/hooks/useAnalyzer";
import { useResumes } from "../features/resumes/hooks/useResumes";
import { toast } from "../components/ui/toast";
import { supabase } from "../lib/supabaseClient";

const JD_MIN_LENGTH = 20;

/** Icon-in-circle section label, matching AskAboutRolePanel's existing
 * Sparkles-in-circle title treatment — used across this page's panels for a
 * consistent, scannable visual rhythm. */
function SectionIcon({
  icon: Icon,
  accent,
}: {
  icon: React.ComponentType<{ size?: number }>;
  accent: "cyan" | "amber" | "violet" | "emerald";
}) {
  const accentClass = {
    cyan: "bg-cyan-500/15 text-cyan-700",
    amber: "bg-amber-500/15 text-amber-700",
    violet: "bg-violet-500/15 text-violet-700",
    emerald: "bg-emerald-500/15 text-emerald-700",
  }[accent];
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-md ${accentClass}`}>
      <Icon size={14} />
    </span>
  );
}

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
    updateReportSnapshot,
  } = useTracker(undefined);
  const { profile } = useProfile();
  const item = id ? tracker.find((x) => x.id === id) : null;

  // Inline "analyze this role" flow — reuses the same headless useAnalyzer
  // hook the standalone /analyzer page uses, so this page never navigates
  // away to run an analysis. Auto-picks the user's default saved resume
  // (features/resumes) rather than showing a picker, to keep this a single
  // click; a resume picker can be added later if that's ever not enough.
  const analyzer = useAnalyzer();
  const { resumes: savedResumes, downloadResumeFile } = useResumes();
  const [resumeBusy, setResumeBusy] = useState(false);
  const [autoAnalyzing, setAutoAnalyzing] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [jdModalOpen, setJdModalOpen] = useState(false);
  const [jdDraft, setJdDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  useEffect(() => {
    if (item) setNotesDraft(item.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const runAnalyze = useCallback(async () => {
    if (!item) return;
    if (!item.jobDescription || item.jobDescription.trim().length < 20) {
      toast.error({
        title: "Add a job description first",
        description: "Use the Job description button above to paste one in.",
      });
      return;
    }
    analyzer.setJd(item.jobDescription);

    // Always re-resolve the resume from its current source of truth on
    // every analyze/re-analyze click — never reuse a File already sitting
    // in analyzer.resume from an earlier click. That hook instance stays
    // alive for the whole page visit, so "only fetch if not already set"
    // silently kept re-analyzing against the *first* resume ever loaded,
    // even after you replaced the attached resume or updated your default
    // saved one. Re-analyze must reflect what's true right now.
    {
      setResumeBusy(true);
      // Prefer a resume attached specifically to this role (the PDF viewer
      // panel) over the account's default saved resume, if one exists.
      if (item.resumeStoragePath) {
        const { data, error: downloadError } = await supabase.storage
          .from("role-resumes")
          .download(item.resumeStoragePath);
        setResumeBusy(false);
        if (downloadError || !data) {
          toast.error({
            title: "Couldn't load this role's resume",
            description: "Failed to download the attached resume. Try again.",
          });
          return;
        }
        const kind = kindOfPath(item.resumeStoragePath);
        analyzer.setResume(new File([data], fileNameFor(kind), { type: mimeFor(kind) }), "system");
      } else {
        if (savedResumes.length === 0) {
          setResumeBusy(false);
          toast.error({
            title: "No resume to analyze with",
            description: "Attach a resume above, or upload one on the Resumes page.",
          });
          return;
        }
        const saved = savedResumes.find((r) => r.isDefault) ?? savedResumes[0];
        const file = await downloadResumeFile(saved);
        setResumeBusy(false);
        if (!file) {
          toast.error({
            title: "Couldn't load resume",
            description: "Failed to download your resume. Try again.",
          });
          return;
        }
        analyzer.setResumeFromSaved(file, saved.id);
      }
    }
    setAutoAnalyzing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, savedResumes, downloadResumeFile]);

  // Once the resume + job description are both in place, actually run the
  // analysis (separated from runAnalyze so a freshly-downloaded resume File
  // — a state update — is guaranteed to have committed first).
  useEffect(() => {
    if (!item || !autoAnalyzing) return;
    if (!analyzer.resume) return;
    if (analyzer.jd.trim().length < 20) return;
    setAutoAnalyzing(false);
    setPendingSave(true);
    void analyzer.onAnalyze({ roleId: item.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, autoAnalyzing, analyzer.resume, analyzer.jd]);

  // Once a result comes back, save it straight onto this role — no
  // navigation, no separate "save" step; the panels below already render
  // from item.reportSnapshot, so they pick this up automatically.
  useEffect(() => {
    if (!item || !pendingSave || !analyzer.report) return;
    setPendingSave(false);
    const report = analyzer.report;
    updateReportSnapshot(item.id, {
      alignment: report.alignment,
      coverage: report.coverage,
      skills: report.skills,
      missingSignals: report.missingSignals,
      actions: report.actions,
      meta: report.meta,
      salary: report.salary ?? undefined,
      alignmentHistory: analyzer.alignmentHistory.map((h) => ({
        alignment: h.alignment,
        createdAt: h.createdAt,
      })),
      resumeStrengthAtSave: analyzer.resumeStrength?.score,
    });
    toast.success({
      title: "Fit score updated",
      description: `Now showing ${alignmentToPreparedness(report.alignment)} preparedness.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, pendingSave, analyzer.report, analyzer.alignmentHistory, analyzer.resumeStrength]);

  useEffect(() => {
    if (analyzer.analyzeError) {
      // A failed run must also release the "waiting to save" state, or the
      // Re-analyze button stays stuck on "Analyzing…" until the page is reloaded.
      setPendingSave(false);
      toast.error({ title: "Analysis failed", description: analyzer.analyzeError });
    }
  }, [analyzer.analyzeError]);

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
  const missingRequiredSkills = (snap?.skills ?? [])
    .filter((s) => s.status === "miss" && (s.importance ?? "required") === "required")
    .map((s) => s.name);
  const compatibilityNotes = profile ? getCompatibilityNotes(item, profile) : [];
  const hasAnalysis = Boolean(snap);
  const preparednessLevel = hasAnalysis ? alignmentToPreparedness(alignment) : null;
  const preparednessQualifier =
    preparednessLevel === "High"
      ? "Strong"
      : preparednessLevel === "Medium"
        ? "On track"
        : preparednessLevel === "Low"
          ? "Needs improvement"
          : null;
  const isAnalyzing = resumeBusy || autoAnalyzing || analyzer.loading || pendingSave;

  return (
    <AppShell>
      <div className="animate-fade-in space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate("/roles", { state: { openRoleId: item.id } })}
              className="btn-press mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-900/[0.04] text-slate-600 transition hover:bg-slate-900/[0.06] hover:text-slate-900"
              aria-label="Back to role"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{item.role}</h1>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_SELECT_STYLES[item.status]}`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{item.company}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setJdDraft(item.jobDescription ?? "");
                setJdModalOpen(true);
              }}
              className={buttonSecondary}
            >
              <FileEdit size={15} />
              Job description
            </button>
            <button
              type="button"
              onClick={() => navigate("/resume-lab", { state: item.jobDescription ? { jobDescription: item.jobDescription } : undefined })}
              className={buttonSecondary}
            >
              <Wand2 size={15} />
              Improve bullets
            </button>
            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={isAnalyzing}
              className={buttonPrimary}
            >
              {isAnalyzing ? (
                <>
                  <span className="spinner inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-700 border-t-transparent" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  {hasAnalysis ? "Re-analyze" : "Analyze this role"}
                </>
              )}
            </button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <RoleResumePdfPanel item={item} updateRoleFields={updateRoleFields} />
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Panel>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Fit score
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <span className="font-display gradient-text text-5xl font-semibold tracking-tight">
                  {hasAnalysis ? `${alignment}%` : "—"}
                </span>
                {preparednessQualifier && (
                  <span className="pb-2 text-sm text-slate-500">{preparednessQualifier}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {hasAnalysis
                  ? `Preparedness: ${preparednessLevel}`
                  : "Analyze this role to see your fit score"}
              </p>
              <div className="mt-4">
                <AnimatedBar
                  pct={hasAnalysis ? alignment : 0}
                  gradient="linear-gradient(90deg, #22d3ee, #a78bfa)"
                />
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

            {snap && (
              <Panel
                title={
                  <span className="flex items-center gap-2">
                    <SectionIcon icon={Target} accent="amber" />
                    Skill gaps
                  </span>
                }
                subtitle="What this job asks for that your resume doesn't show yet."
              >
                <RoleGapsPanel item={item} />
              </Panel>
            )}

            <SkillGapHelper missingRequiredSkills={missingRequiredSkills} />

            {!snap && (
              <Panel>
                <p className="text-sm text-slate-500">
                  No analysis yet. Use <strong>Analyze this role</strong> above to see skill
                  gaps and improvements.
                </p>
              </Panel>
            )}

            <Panel
              title={
                <span className="flex items-center gap-2">
                  <SectionIcon icon={ClipboardList} accent="cyan" />
                  Application status
                </span>
              }
              subtitle="Track your progress."
            >
              <DarkSelect
                value={item.status}
                onChange={(v) => updateStatus(item.id, v as TrackerStatus)}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                buttonClassName={`h-10 w-full rounded-xl border px-4 text-sm font-medium ${STATUS_SELECT_STYLES[item.status]}`}
              />
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
                  type="date"
                  value={(() => {
                    const raw = item.deadline?.trim();
                    if (!raw) return "";
                    const d = new Date(raw);
                    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
                  })()}
                  onChange={(e) => updateDeadline(item.id, e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                />
              </div>
            </Panel>

            <Panel
              title={
                <span className="flex items-center gap-2">
                  <SectionIcon icon={StickyNote} accent="violet" />
                  Notes
                </span>
              }
              subtitle="Free-form notes for this role."
            >
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Deadlines, contact, follow-ups..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none resize-none"
              />
              <button
                type="button"
                onClick={() => {
                  updateNotes(item.id, notesDraft);
                  toast.success({ title: "Notes saved" });
                }}
                disabled={notesDraft === (item.notes ?? "")}
                className="btn-press mt-3 rounded-xl border border-cyan-300 bg-white px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-cyan-300 disabled:hover:bg-white disabled:hover:text-cyan-700"
              >
                Save
              </button>
            </Panel>

            {compatibilityNotes.length > 0 && (
              <Panel
                title={
                  <span className="flex items-center gap-2">
                    <SectionIcon icon={Users} accent="emerald" />
                    Compatibility with your preferences
                  </span>
                }
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
          </div>
        </div>
      </div>

      <Modal
        isOpen={jdModalOpen}
        onClose={() => setJdModalOpen(false)}
        title="Job description"
      >
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-500">
            This is the text Analyze, Ask AI, cover letters, and interview prep all use for this
            role.
          </p>
          <textarea
            autoFocus
            value={jdDraft}
            onChange={(e) => setJdDraft(e.target.value)}
            placeholder="Paste the job description here…"
            rows={12}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-900/[0.04] p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setJdModalOpen(false)}
              className="btn-press rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900/[0.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmed = jdDraft.trim();
                if (trimmed.length < JD_MIN_LENGTH) {
                  toast.error({
                    title: "Add a bit more text",
                    description: `Needs at least ${JD_MIN_LENGTH} characters to be a real job description.`,
                  });
                  return;
                }
                updateRoleFields(item.id, { jobDescription: trimmed });
                setJdModalOpen(false);
                toast.success({ title: "Job description saved" });
              }}
              className="btn-press rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
