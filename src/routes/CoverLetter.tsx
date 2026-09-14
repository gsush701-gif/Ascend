import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, FileText, Sparkles, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { extractTextFromPdf } from "../lib/pdf";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/apiError";
import { logEvent } from "../lib/analytics";
import { useCoverLetterVersions } from "../features/coverLetters/hooks/useCoverLetterVersions";
import { resolveDisplayName } from "../features/coverLetters/versionLogic";
import type { CoverLetterVersion } from "../types/coverLetter";

type CoverLetterResult = { coverLetter: string; keyPoints: string[] };

export function CoverLetter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { tracker, updateCoverLetter } = useTracker(undefined);

  const item = id ? tracker.find((x) => x.id === id) : null;

  // Cover letter generation/UI state + version persistence — moved here
  // unchanged from the role detail drawer (src/components/roles/RoleDetailDrawer.tsx).
  const clVersions = useCoverLetterVersions(item?.id, updateCoverLetter);
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
  const clDisplayText = clActiveVersion?.content ?? item?.coverLetter ?? "";
  const clFormVisible = clShowForm || (!clActiveVersion && !item?.coverLetter);
  const clHasRealVersion = !!clActiveVersion;

  async function runGenerateCoverLetter() {
    if (!clFile || !item) return;
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
    if (!item?.coverLetter) return null;
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

  return (
    <AppShell>
      <div className="animate-fade-in mx-auto max-w-2xl space-y-6 pb-12">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/roles", { state: { openRoleId: item.id } })}
            className="btn-press flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-900/[0.06]"
          >
            <ArrowLeft size={18} />
            Back to role
          </button>
        </div>

        <section className="text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            Cover letter
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {item.role} at {item.company}
          </p>
        </section>

        <Panel
          title="AI-drafted cover letter"
          subtitle="Generated from this role's job description and your resume."
        >
          {clError && <p className="mb-3 text-sm text-red-600">{clError}</p>}
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
      </div>
    </AppShell>
  );
}
