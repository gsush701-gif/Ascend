import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Star, Pencil, SquarePen, Trash2, Check, X } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { pageHeader, pageTitle, pageSubtitle, card, cardAlt, sectionTitle } from "../lib/ui";
import { cn } from "../lib/cn";
import { useResumes } from "../features/resumes/hooks/useResumes";
import { useJobAnalyses } from "../features/resumes/hooks/useJobAnalyses";
import type { SavedResume, JobAnalysisRecord } from "../types/resume";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ResumeRow({
  resume,
  onSetDefault,
  onRename,
  onDelete,
}: {
  resume: SavedResume;
  onSetDefault: (id: string) => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(resume.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || name.trim() === resume.name) {
      setEditing(false);
      setName(resume.name);
      return;
    }
    setSaving(true);
    await onRename(resume.id, name.trim());
    setSaving(false);
    setEditing(false);
  };

  return (
    <li className={cn(cardAlt, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900/[0.06] text-slate-500">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setName(resume.name);
                  }
                }}
                autoFocus
                className="h-8 text-sm"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md p-1.5 text-cyan-700 hover:bg-cyan-500/10"
                aria-label="Save name"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(resume.name);
                }}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-900/[0.06]"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-slate-900">{resume.name}</p>
              {resume.isDefault && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-700">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Default
                </span>
              )}
            </div>
          )}
          <p className="mt-0.5 text-xs text-slate-500">
            v{resume.version} · saved {formatDate(resume.createdAt)}
          </p>
        </div>
      </div>

      {!editing && (
        <div className="flex shrink-0 items-center gap-1.5">
          {!resume.isDefault && (
            <button
              type="button"
              onClick={() => onSetDefault(resume.id)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-900/[0.04]"
            >
              Set default
            </button>
          )}
          <Link
            to={`/resumes/${resume.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-900/[0.04]"
          >
            <SquarePen className="h-3.5 w-3.5" />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-900/[0.04]"
            aria-label="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(resume.id)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-rose-300 hover:bg-rose-500/10 hover:text-rose-600"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

function AnalysisRow({ analysis, onOpen }: { analysis: JobAnalysisRecord; onOpen: () => void }) {
  const snippet = (analysis.jobDescription || "").trim().slice(0, 120);
  const score = analysis.result?.alignment;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(cardAlt, "flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-900/[0.06]")}
      >
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{formatDate(analysis.createdAt)}</p>
          <p className="mt-0.5 truncate text-sm text-slate-700">
            {snippet || "No job description text saved"}
            {(analysis.jobDescription || "").length > 120 ? "…" : ""}
          </p>
        </div>
        {typeof score === "number" && (
          <div className="shrink-0 text-right">
            <div className="text-lg font-semibold text-slate-900">{score}%</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Fit score</div>
          </div>
        )}
      </button>
    </li>
  );
}

export function ResumesBody({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { resumes, loading: resumesLoading, setDefaultResume, renameResume, deleteResume } = useResumes();
  const { analyses, loading: analysesLoading } = useJobAnalyses();
  const [openAnalysis, setOpenAnalysis] = useState<JobAnalysisRecord | null>(null);

  const handleDelete = (id: string) => {
    if (!window.confirm("Remove this resume from your list? You can always upload it again.")) return;
    deleteResume(id).then(({ error }) => {
      if (error) console.error("[Resumes] delete failed:", error);
    });
  };

  return (
    <>
      <div className="space-y-8">
        {!embedded && (
          <div className={pageHeader}>
            <div>
              <h1 className={pageTitle}>My Resumes</h1>
              <p className={pageSubtitle}>
                Resumes you&apos;ve saved from the Analyzer, and your past job-fit analyses.
              </p>
            </div>
            <Link to="/analyzer" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors shrink-0">
              Go to Analyzer →
            </Link>
          </div>
        )}

        <section>
          <h2 className={cn(sectionTitle, "mb-3")}>Saved resumes</h2>
          {resumesLoading && resumes.length === 0 ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : resumes.length === 0 ? (
            <EmptyState
              title="No saved resumes yet"
              subtitle="Upload a resume in the Analyzer and click “Save this resume” to keep it here for next time."
              primaryAction={{ label: "Go to Analyzer", onClick: () => navigate("/analyzer") }}
              compact
            />
          ) : (
            <ul className="space-y-2">
              {resumes.map((r) => (
                <ResumeRow
                  key={r.id}
                  resume={r}
                  onSetDefault={(id) => setDefaultResume(id)}
                  onRename={async (id, name) => {
                    await renameResume(id, name);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className={cn(sectionTitle, "mb-3")}>Analysis history</h2>
          {analysesLoading && analyses.length === 0 ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : analyses.length === 0 ? (
            <div className={cn(card, "text-center")}>
              <p className="text-sm text-slate-500">
                No analyses yet. Run one from the{" "}
                <Link to="/analyzer" className="text-cyan-700 hover:underline">
                  Analyzer
                </Link>
                {" "}while logged in and it&apos;ll show up here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {analyses.map((a) => (
                <AnalysisRow key={a.id} analysis={a} onOpen={() => setOpenAnalysis(a)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal isOpen={!!openAnalysis} onClose={() => setOpenAnalysis(null)} title="Past analysis">
        {openAnalysis && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">{formatDate(openAnalysis.createdAt)}</p>

            {typeof openAnalysis.result?.alignment === "number" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-900/[0.04] p-3 text-center">
                  <div className="text-lg font-semibold text-slate-900">{openAnalysis.result.alignment}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Fit score</div>
                </div>
                {typeof openAnalysis.result?.coverage === "number" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-900/[0.04] p-3 text-center">
                    <div className="text-lg font-semibold text-slate-900">{openAnalysis.result.coverage}%</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Coverage</div>
                  </div>
                )}
              </div>
            )}

            {openAnalysis.result?.breakdown && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Required", value: openAnalysis.result.breakdown.requiredSkills },
                  { label: "Stack", value: openAnalysis.result.breakdown.technicalStack },
                  { label: "Evidence", value: openAnalysis.result.breakdown.resumeEvidence },
                  { label: "ATS", value: openAnalysis.result.breakdown.ats },
                ].map((c) => (
                  <div key={c.label} className="text-center">
                    <div className="text-sm font-semibold text-slate-900">{c.value}%</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            {openAnalysis.result?.aiSummary && (
              <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-slate-700">
                {openAnalysis.result.aiSummary}
              </p>
            )}

            {(openAnalysis.result?.skills?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {openAnalysis.result.skills!.map((s) => (
                    <span
                      key={s.name}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        s.status === "hit"
                          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-700"
                          : "border-slate-200 bg-slate-900/[0.04] text-slate-500"
                      )}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {openAnalysis.jobDescription && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Job description</p>
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600">
                  {openAnalysis.jobDescription}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export function Resumes() {
  return (
    <AppShell>
      <ResumesBody />
    </AppShell>
  );
}
