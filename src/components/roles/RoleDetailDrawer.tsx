import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Copy, FileText, Sparkles, MessageSquare, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { alignmentToPreparedness } from "../../lib/preparedness";
import { Panel } from "../ui/Panel";
import type { TrackerItem, TrackerStatus } from "../../types/tracker";
import { TRACKER_STATUS_ORDER } from "../../types/tracker";
import { MissingSignals } from "../../features/analyzer/components/MissingSignals";
import { ActionsList } from "../../features/analyzer/components/ActionsList";
import { SkillGapHelper } from "../../features/analyzer/components/SkillGapHelper";
import { extractTextFromPdf } from "../../lib/pdf";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { ApplicationDetailsPanel } from "./ApplicationDetailsPanel";
import { getApiErrorMessage } from "../../lib/apiError";
import { logEvent } from "../../lib/analytics";
import { useProfile } from "../../lib/profile";
import { getCompatibilityNotes } from "../../features/preferences/compatibility";
import { useCoverLetterVersions } from "../../features/coverLetters/hooks/useCoverLetterVersions";
import { resolveDisplayName } from "../../features/coverLetters/versionLogic";
import type { CoverLetterVersion } from "../../types/coverLetter";

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
  const { profile } = useProfile();
  const compatibilityNotes = profile ? getCompatibilityNotes(item, profile) : [];
  const snap = item.reportSnapshot;
  const alignment = snap?.alignment ?? item.alignment;
  const missingSignals = snap?.missingSignals ?? [];
  const actions = snap?.actions ?? [];
  const missingRequiredSkills = (snap?.skills ?? [])
    .filter((s) => s.status === "miss" && (s.importance ?? "required") === "required")
    .map((s) => s.name);

  // "Ask about this role" (career advice, Phase 6a Task 4) state — transient
  // UI/request state, not persisted.
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
        body: JSON.stringify({ question, roleId: item.id }),
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

  // Cover letter generation/UI state (kept here rather than in useTracker
  // since it's transient UI/request state, not persisted tracker data).
  // Actual version data + persistence lives in useCoverLetterVersions, which
  // keeps the legacy `roles.cover_letter` mirror column in sync via the
  // `updateCoverLetter` prop (same single write path useTracker already
  // exposes for it) whenever the active version changes.
  const clVersions = useCoverLetterVersions(item.id, updateCoverLetter);
  const [clFile, setClFile] = useState<File | null>(null);
  const [clName, setClName] = useState("");
  const [clShowForm, setClShowForm] = useState(false);
  const [clLoading, setClLoading] = useState(false);
  const [clSlow, setClSlow] = useState(false);
  const [clError, setClError] = useState<string | null>(null);
  const [clKeyPoints, setClKeyPoints] = useState<string[] | null>(null);
  const [clCopyLabel, setClCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const [clHistoryOpen, setClHistoryOpen] = useState(false);
  const [clEditing, setClEditing] = useState(false);
  const [clEditText, setClEditText] = useState("");
  const [clActionError, setClActionError] = useState<string | null>(null);
  const [clActionBusy, setClActionBusy] = useState(false);

  const clActiveVersion = clVersions.activeVersion;
  // Backward compatibility: a role created before this feature exists has a
  // legacy `roles.cover_letter` value and zero rows in `cover_letter_versions`
  // — it must still display, unchanged, exactly as it did before.
  const clDisplayText = clActiveVersion?.content ?? item.coverLetter ?? "";
  const clFormVisible = clShowForm || (!clActiveVersion && !item.coverLetter);
  const clHasRealVersion = !!clActiveVersion;

  async function runGenerateCoverLetter() {
    if (!clFile) return;
    setClError(null);
    setClActionError(null);
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
      const data: CoverLetterResult = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));

      const { error } = await clVersions.createVersion(data.coverLetter, {
        name: clName.trim() || undefined,
        source: "generated",
        activate: true,
      });
      if (error) throw new Error(error);

      setClKeyPoints(data.keyPoints);
      setClShowForm(false);
      setClName("");
      setClEditing(false);
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
    setClKeyPoints(null);
    setClError(null);
    setClActionError(null);
    setClEditing(false);
    setClShowForm(true);
  }

  function startEditCoverLetter() {
    setClEditText(clDisplayText);
    setClActionError(null);
    setClEditing(true);
  }

  function cancelEditCoverLetter() {
    setClEditing(false);
    setClActionError(null);
  }

  /** A legacy-only role (real `roles.cover_letter` text, zero version rows)
   * has nothing in `cover_letter_versions` to edit/duplicate yet — this
   * materializes its current text as a real (generated-source) version on
   * first write, transparently, so Edit/Duplicate/history work from then on. */
  async function ensureActiveVersion(): Promise<{ id: string; content: string } | null> {
    if (clActiveVersion) return { id: clActiveVersion.id, content: clActiveVersion.content };
    if (!item.coverLetter) return null;
    const { error, version } = await clVersions.createVersion(item.coverLetter, {
      source: "generated",
      activate: true,
    });
    if (error || !version) {
      setClActionError(error ?? "Failed to save cover letter version");
      return null;
    }
    return { id: version.id, content: version.content };
  }

  async function saveEditCoverLetter() {
    setClActionBusy(true);
    setClActionError(null);
    try {
      const target = await ensureActiveVersion();
      if (!target) return;
      const { error } = await clVersions.updateVersion(target.id, { content: clEditText });
      if (error) {
        setClActionError(error);
        return;
      }
      setClEditing(false);
    } finally {
      setClActionBusy(false);
    }
  }

  async function handleDuplicateCoverLetter() {
    setClActionBusy(true);
    setClActionError(null);
    try {
      const target = await ensureActiveVersion();
      if (!target) return;
      const { error } = await clVersions.duplicateVersion(target.id);
      if (error) setClActionError(error);
      else setClHistoryOpen(true);
    } finally {
      setClActionBusy(false);
    }
  }

  async function handleDeleteVersion(version: CoverLetterVersion) {
    const label = resolveDisplayName(version.name, version.versionNumber);
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setClActionError(null);
    const { error } = await clVersions.deleteVersion(version.id);
    if (error) setClActionError(error);
  }

  async function handleUseVersion(versionId: string) {
    setClActionError(null);
    setClEditing(false);
    const { error } = await clVersions.setActiveVersion(versionId);
    if (error) setClActionError(error);
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
              <MissingSignals signals={missingSignals} resumeStrength={null} />
            </Panel>
          )}

          <SkillGapHelper missingRequiredSkills={missingRequiredSkills} />

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
            title="Ask about this role"
            subtitle="Grounded in your real fit score and skills for this specific role."
          >
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
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={runAskAboutRole}
                disabled={askLoading || !askQuestion.trim()}
                className="btn-press shrink-0 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {askLoading ? "Asking…" : "Ask"}
              </button>
            </div>
            {askError && <p className="mt-3 text-sm text-red-600">{askError}</p>}
            {askAnswer && !askError && (
              <p className="mt-3 animate-fade-in rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm leading-relaxed text-slate-800">
                {askAnswer}
              </p>
            )}
          </Panel>

          <Panel
            title="Cover letter"
            subtitle="AI-drafted from this role's job description and your resume."
          >
            {clError && (
              <p className="mb-3 text-sm text-red-600">{clError}</p>
            )}
            {clActionError && (
              <p className="mb-3 text-sm text-red-600">{clActionError}</p>
            )}

            {!clFormVisible ? (
              <div key="result" className="animate-fade-in space-y-4">
                {clHasRealVersion && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide " +
                          (clActiveVersion!.source === "manual"
                            ? "bg-amber-500/10 text-amber-700"
                            : "bg-cyan-500/10 text-cyan-700")
                        }
                      >
                        {clActiveVersion!.source === "manual" ? "Manually edited" : "AI generated"}
                      </span>
                      <span>
                        {resolveDisplayName(clActiveVersion!.name, clActiveVersion!.versionNumber)}
                      </span>
                    </div>
                    {clVersions.versions.length > 1 && (
                      <select
                        value={clActiveVersion!.id}
                        onChange={(e) => handleUseVersion(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-900/[0.04] px-2 py-1 text-xs text-slate-700 focus:border-slate-300 focus:outline-none"
                        aria-label="Switch cover letter version"
                      >
                        {clVersions.versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {resolveDisplayName(v.name, v.versionNumber)}
                            {v.isActive ? " (active)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {clEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={clEditText}
                      onChange={(e) => setClEditText(e.target.value)}
                      rows={10}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-800 focus:border-slate-300 focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveEditCoverLetter}
                        disabled={clActionBusy || !clEditText.trim()}
                        className="btn-press rounded-xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {clActionBusy ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditCoverLetter}
                        disabled={clActionBusy}
                        className="btn-press rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {clDisplayText}
                  </p>
                )}

                {!clEditing && clKeyPoints && clKeyPoints.length > 0 && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      What this emphasizes
                    </div>
                    <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
                      {clKeyPoints.map((k, i) => (
                        <li key={i}>• {k}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!clEditing && (
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
                      onClick={startEditCoverLetter}
                      disabled={clActionBusy}
                      className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplicateCoverLetter}
                      disabled={clActionBusy}
                      className="btn-press rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={startRegenerate}
                      className="btn-press rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                    >
                      Regenerate
                    </button>
                    {clHasRealVersion && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVersion(clActiveVersion!)}
                        disabled={clActionBusy}
                        className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                )}

                {clVersions.versions.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setClHistoryOpen((o) => !o)}
                      className="btn-press flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      <span>Version history ({clVersions.versions.length})</span>
                      {clHistoryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {clHistoryOpen && (
                      <ul className="mt-3 animate-fade-in space-y-2">
                        {clVersions.versions.map((v) => (
                          <li
                            key={v.id}
                            className={
                              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs " +
                              (v.isActive
                                ? "border-cyan-500/30 bg-cyan-500/5"
                                : "border-slate-200 bg-slate-900/[0.02]")
                            }
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                <span className="truncate">{resolveDisplayName(v.name, v.versionNumber)}</span>
                                {v.isActive && (
                                  <span className="shrink-0 rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-cyan-700">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {v.source === "manual" ? "Manually edited" : "AI generated"} ·{" "}
                                {new Date(v.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {!v.isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleUseVersion(v.id)}
                                  className="btn-press rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                                >
                                  Use
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteVersion(v)}
                                aria-label={`Delete ${resolveDisplayName(v.name, v.versionNumber)}`}
                                className="btn-press rounded-lg p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-600"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
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
                <input
                  type="text"
                  value={clName}
                  onChange={(e) => setClName(e.target.value)}
                  placeholder={`Name this version (optional, e.g. "Version ${clVersions.versions.length + 1}")`}
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                />
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
                  {clDisplayText && (
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
