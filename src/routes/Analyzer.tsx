import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileEdit,
  ListChecks,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "../components/ui/toast";
import { AppShell } from "../components/layout/AppShell";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { pageHeader, pageTitle, pageSubtitle, card, cardAlt } from "../lib/ui";
import { useAnalyzer } from "../features/analyzer/hooks/useAnalyzer";
import { SkillGapHelper } from "../features/analyzer/components/SkillGapHelper";
import { AtsChecker } from "../features/analyzer/components/AtsChecker";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useResumes } from "../features/resumes/hooks/useResumes";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { getRecentCompanies, getRecentRoles } from "../lib/dashboardStats";
import { findDuplicateRole, formatDuplicateWarning } from "../features/tracker/duplicateDetection";
import { cn } from "../lib/cn";
import { alignmentToPreparedness, type Preparedness } from "../lib/preparedness";
import { ResumeAdditionsPanel } from "../features/analyzer/components/ResumeAdditionsPanel";
import type { ResumeAddition } from "../features/analyzer/additions";
import { ResumeDropzone } from "../features/analyzer/components/ResumeDropzone";
import { isDocxFile } from "../lib/docx";
import { kindOfFile, mimeFor } from "../lib/resumeFile";
import type { TrackerStatus } from "../types/tracker";
import { buildNextSteps, guessRoleAndCompany, jdHint } from "../features/analyzer/inputChecks";
import {
  EXAMPLE_JOB_DESCRIPTION,
  EXAMPLE_RESUME_NAME,
  EXAMPLE_RESUME_URL,
} from "../features/analyzer/exampleData";

const QUICK_NEXT_STEPS = ["Tailor resume", "Apply", "Follow up", "Prepare for interview"];

export function Analyzer() {
  const navigate = useNavigate();
  const location = useLocation();
  const analyzer = useAnalyzer();
  const tracker = useTracker(analyzer.report?.alignment);
  const { updateReportSnapshot } = tracker;
  const { user } = useAuth();
  const { resumes: savedResumes, saveResume, downloadResumeFile } = useResumes();
  const [savingResume, setSavingResume] = useState(false);

  const {
    resume,
    setResume,
    setResumeFromSaved,
    selectedResumeId,
    resumeText,
    lastResumeFilename,
    jd,
    setJd,
    loading,
    slowRequest,
    report,
    parsedJdData,
    analyzeError,
    canAnalyze,
    canAnalyzeJdOnly,
    hasValidJd,
    onAnalyze,
    onAnalyzeJdOnly,
    alignmentHistory,
    resumeStrength,
  } = analyzer;

  const recentCompanies = getRecentCompanies(tracker.tracker);
  const recentRoles = getRecentRoles(tracker.tracker);

  const [previousReport, setPreviousReport] = useState<{
    alignment: number;
    coverage: number;
  } | null>(null);
  const [reanalyzeRoleId, setReanalyzeRoleId] = useState<string | null>(null);
  // Status the role is saved with. "Analyzed" is the honest default: the student
  // has just checked their fit, not necessarily applied, and "Applied" would
  // inflate their application stats from the first role.
  const [addStatus, setAddStatus] = useState<TrackerStatus>("Analyzed");
  // "Add to my resume" drafts: bullets the user wrote for missing skills, and
  // the real score they started from, to show how much they moved it. Kept
  // together with the resume file they belong to, so picking a different file
  // starts clean without an effect to reset them.
  const [draft, setDraft] = useState<{
    forResume: File | null;
    items: ResumeAddition[];
    baseline: { alignment: number; coverage: number } | null;
  }>({ forResume: null, items: [], baseline: null });
  const draftIsCurrent = draft.forResume === resume;
  const additions = draftIsCurrent ? draft.items : [];
  const baseline = draftIsCurrent ? draft.baseline : null;
  const setAdditions = (items: ResumeAddition[]) =>
    setDraft({ forResume: resume, items, baseline });
  const setBaseline = (next: { alignment: number; coverage: number } | null) =>
    setDraft({ forResume: resume, items: additions, baseline: next });
  const [skillsToAddToNotes, setSkillsToAddToNotes] = useState<string[]>([]);
  const [showMarkNextStep, setShowMarkNextStep] = useState(false);
  const markNextStepRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (markNextStepRef.current && !markNextStepRef.current.contains(e.target as Node)) {
        setShowMarkNextStep(false);
      }
    };
    if (showMarkNextStep) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [showMarkNextStep]);

  // Pre-fill job description + previous report + roleId when coming from Re-analyze
  useEffect(() => {
    const state = location.state as {
      jobDescription?: string;
      previousReport?: { alignment: number; coverage: number };
      roleId?: string;
    } | null;
    if (state) {
      if (typeof state.jobDescription === "string" && state.jobDescription.trim()) {
        setJd(state.jobDescription.trim());
      }
      if (state.previousReport && typeof state.previousReport.alignment === "number") {
        setPreviousReport(state.previousReport);
      }
      if (typeof state.roleId === "string" && state.roleId) {
        setReanalyzeRoleId(state.roleId);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  // Don't auto-fill role when backend returns metric labels
  const BAD_ROLE_TITLES = /^(job\s+)?(alignment|fit\s+score|coverage)$/i;
  useEffect(() => {
    const title = report?.roleTitle?.trim();
    if (title && !tracker.role.trim() && !BAD_ROLE_TITLES.test(title)) {
      tracker.setRole(title);
    }
  }, [report?.roleTitle]);

  const PROJECTED_SAVE_MESSAGE =
    "This score includes bullets that aren't in your resume file yet. Update your resume, upload it, and analyze again before saving.";

  const handleRecheckWithAdditions = () => {
    if (!resume || !hasValidJd || additions.length === 0) return;
    if (report && !report.meta?.projected) {
      setBaseline({ alignment: report.alignment, coverage: report.coverage });
    }
    void onAnalyze({ additions: additions.map((a) => a.text) });
  };

  // When an analysis arrives, prefill the empty Company/Role fields from the top
  // of the pasted posting so the role isn't saved as "Unknown company". Only
  // fills blanks, never overwrites what the user typed.
  useEffect(() => {
    if (!report || report.meta?.projected) return;
    const guess = guessRoleAndCompany(jd);
    if (guess.company && !tracker.company.trim()) tracker.setCompany(guess.company);
    if (guess.role && !tracker.role.trim()) tracker.setRole(guess.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  // On a phone the results render far below the form, so after pressing Analyze
  // it looks like nothing happened. Bring the results into view on small screens
  // (the side-by-side layout on desktop already shows them).
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!report || report.meta?.projected) return;
    if (typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [report]);

  const jdState = jdHint(jd);
  const [loadingExample, setLoadingExample] = useState(false);

  // "Try an example": a made-up resume plus a sample posting, so a first-time
  // visitor sees the product work without handing over anything of their own.
  const handleTryExample = async () => {
    setLoadingExample(true);
    try {
      const res = await fetch(EXAMPLE_RESUME_URL);
      if (!res.ok) throw new Error("example resume not found");
      const blob = await res.blob();
      setResume(new File([blob], EXAMPLE_RESUME_NAME, { type: "application/pdf" }), "example");
      setJd(EXAMPLE_JOB_DESCRIPTION);
      return true;
    } catch {
      toast.error({ title: "Couldn't load the example", description: "Check your connection and try again." });
      return false;
    } finally {
      setLoadingExample(false);
    }
  };

  // Arriving from the landing page's "See an example" button (?example=1): load
  // the example straight away so a first-time visitor only has to press Analyze.
  const [searchParams, setSearchParams] = useSearchParams();
  const exampleRequested = useRef(false);
  useEffect(() => {
    if (searchParams.get("example") !== "1" || exampleRequested.current) return;
    exampleRequested.current = true;
    const params = new URLSearchParams(searchParams);
    params.delete("example");
    setSearchParams(params, { replace: true });
    if (resume || jd.trim()) return;
    void handleTryExample().then((loaded) => {
      if (loaded) toast.success({ title: "Example loaded", description: "Press Analyze to see the fit score." });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const nextSteps = report ? buildNextSteps(report) : [];

  const handleAnalyze = () => {
    setBaseline(null);
    if (!hasValidJd) {
      toast.error({ title: "Add job description", description: "Add job description to analyze this role." });
      return;
    }
    if (resume) {
      onAnalyze(reanalyzeRoleId ? { roleId: reanalyzeRoleId } : undefined);
    } else {
      onAnalyzeJdOnly();
    }
  };

  const handleSelectSavedResume = async (resumeId: string) => {
    const saved = savedResumes.find((r) => r.id === resumeId);
    if (!saved) return;
    const file = await downloadResumeFile(saved);
    if (!file) {
      toast.error({ title: "Couldn't load resume", description: "Failed to download that resume. Try again." });
      return;
    }
    setResumeFromSaved(file, saved.id);
  };

  const handleSaveResume = async () => {
    if (!resume || !resumeText) return;
    setSavingResume(true);
    const { error } = await saveResume(resume, resumeText, resume.name);
    setSavingResume(false);
    if (error) {
      toast.error({ title: "Couldn't save resume", description: error });
    } else {
      toast.success({ title: "Resume saved", description: "View it anytime under My Resumes." });
    }
  };

  // Whatever resume was actually used for this analysis (freshly uploaded
  // or picked from saved resumes) also becomes the resume attached to the
  // role's report page — otherwise a role created/updated from here shows
  // up with an empty resume viewer, forcing a redundant re-upload for a
  // file already sitting right here. Best-effort: the role/analysis itself
  // has already succeeded either way, so a sync failure here just leaves
  // the viewer empty rather than failing the whole action.
  const syncResumeToRole = async (roleId: string) => {
    if (!resume || !user) return;
    try {
      const kind = kindOfFile(resume);
      const path = `${user.id}/${roleId}-${crypto.randomUUID()}.${kind}`;
      const { error: uploadError } = await supabase.storage
        .from("role-resumes")
        .upload(path, resume, { contentType: mimeFor(kind), cacheControl: "0" });
      if (!uploadError) {
        tracker.updateRoleFields(roleId, { resumeStoragePath: path });
      }
    } catch {
      // Non-fatal — see comment above.
    }
  };

  const handleAddToRoles = async () => {
    if (report?.meta?.projected) {
      toast.error({ title: "Not saved yet", description: PROJECTED_SAVE_MESSAGE });
      return;
    }
    const snapshot =
      report && alignmentHistory
        ? {
            alignment: report.alignment,
            coverage: report.coverage,
            skills: report.skills,
            missingSignals: report.missingSignals,
            actions: report.actions,
            meta: report.meta,
            salary: report.salary ?? undefined,
            alignmentHistory: alignmentHistory.map((h) => ({
              alignment: h.alignment,
              createdAt: h.createdAt,
            })),
            breakdown: report.breakdown,
            resumeStrengthAtSave: resumeStrength?.score,
          }
        : undefined;
    const company = tracker.company.trim() || "Unknown company";
    const role = tracker.role.trim() || report?.roleTitle || "Unknown role";

    const duplicate = findDuplicateRole(tracker.tracker, { company, role });
    if (duplicate) {
      const proceed = window.confirm(
        `${formatDuplicateWarning(duplicate)}\n\nAdd it anyway?`
      );
      if (!proceed) return;
    }

    const notesFromSkills =
      skillsToAddToNotes.length > 0 ? `Skills to highlight:\n• ${skillsToAddToNotes.join("\n• ")}` : undefined;
    const { id: insertedId, error: insertError } = await tracker.addManualTrackerItem(
      () => {
        setSkillsToAddToNotes([]);
      },
      snapshot,
      {
        company,
        role,
        status: addStatus,
        nextStep: tracker.nextStep || "Follow up",
        jobDescription: jd.trim() || undefined,
        notes: notesFromSkills,
      }
    );
    // Wait for the row to actually exist before attaching a resume to it —
    // attaching immediately (in the onAdded callback above, which fires
    // before this insert lands) used to silently no-op, since an UPDATE
    // against a not-yet-existing row matches zero rows. This is also why
    // navigation now happens after the insert confirms, not before it.
    if (insertedId && !insertError) {
      await syncResumeToRole(insertedId);
      navigate(`/roles/${insertedId}`);
    } else if (insertedId) {
      navigate(`/roles/${insertedId}`);
    }
  };

  const handleAddMissingSkillNote = (skill: string) => {
    if (reanalyzeRoleId) {
      const item = tracker.tracker.find((t) => t.id === reanalyzeRoleId);
      const currentNotes = item?.notes ?? "";
      const newNote = currentNotes ? `${currentNotes}\n• ${skill}` : `• ${skill}`;
      tracker.updateNotes(reanalyzeRoleId, newNote);
      toast.success({ title: "Note added", description: `Added ${skill} to notes.` });
    } else {
      setSkillsToAddToNotes((prev) => (prev.includes(skill) ? prev : [...prev, skill]));
      toast.success({ title: "Queued for notes", description: `${skill} will be added when you save to Roles.` });
    }
  };

  const handleMarkNextStep = (step: string) => {
    if (reanalyzeRoleId) {
      tracker.updateNextStep(reanalyzeRoleId, step);
      toast.success({ title: "Next step set", description: step });
      setShowMarkNextStep(false);
    } else {
      tracker.setNextStep(step);
      setShowMarkNextStep(false);
    }
  };

  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const showComparison = report && previousReport;
  const alignmentDiff = showComparison ? report.alignment - previousReport.alignment : 0;
  const coverageDiff = showComparison ? report.coverage - previousReport.coverage : 0;
  const getComparisonVerdict = () => {
    if (!showComparison) return null;
    if (Math.abs(alignmentDiff) <= 5 && Math.abs(coverageDiff) <= 5) return { text: "About the same", better: null };
    if (alignmentDiff > 5 && coverageDiff >= 0) return { text: "New version is stronger", better: "B" };
    if (alignmentDiff < -5 && coverageDiff <= 0) return { text: "Previous version was stronger", better: "A" };
    if (alignmentDiff > 0 && coverageDiff < 0) return { text: "Better fit score, lower coverage", better: "B" };
    if (alignmentDiff < 0 && coverageDiff > 0) return { text: "Lower fit score, better coverage", better: null };
    return { text: "Mixed results — each has strengths", better: null };
  };
  const verdict = getComparisonVerdict();

  // Unified display data from either parsed JD or backend report
  const hasResults = !!report || !!parsedJdData;
  const coreSkills = report
    ? report.skills.filter((s) => s.status === "hit").map((s) => s.name)
    : parsedJdData?.coreSkills ?? [];
  const preferredSkills = report
    ? report.skills.filter((s) => s.status === "miss").map((s) => s.name)
    : parsedJdData?.preferredSkills ?? [];
  // Real required-vs-preferred classification (from JD language, not hit/miss
  // status above) — used only to badge each skill, since the hit/miss split
  // already drives which of the two lists a skill appears in.
  const skillImportanceByName = new Map(
    (report?.skills ?? []).map((s) => [s.name, s.importance])
  );
  // Missing skills the JD language marks as required (not just "preferred"
  // bucket membership above, which is really "missing" regardless of
  // importance) — drives the "Close your skill gaps" roadmap/project panel.
  // Only meaningful with a real backend report; the JD-only mode's
  // core/preferred split is a cosmetic array-position bucket, not a real
  // required/preferred classification (see parseJd.ts), so it's excluded.
  const missingRequiredSkills = report
    ? preferredSkills.filter((s) => (skillImportanceByName.get(s) ?? "required") === "required")
    : [];
  const experienceLevel = parsedJdData?.experienceLevel ?? (report ? "See job description" : "");
  const derivedSignals = report
    ? [
        ...(report.missingSignals?.slice(0, 3).map((s) => `Focus on: ${s}`) ?? []),
        ...(report.actions?.slice(0, 2) ?? []),
      ]
    : [];
  const preparationSignals = parsedJdData?.preparationSignals ?? (derivedSignals.length > 0 ? derivedSignals : ["Review role requirements above"]);
  const preparedness: Preparedness | null = report ? alignmentToPreparedness(report.alignment) : null;
  const lastAnalyzedAt = parsedJdData?.lastAnalyzedAt ?? (report ? new Date().toISOString() : null);

  const MAX_VISIBLE = 6;
  const coreVisible = collapsedSections.core ? coreSkills.length : Math.min(MAX_VISIBLE, coreSkills.length);
  const preferredVisible = collapsedSections.preferred ? preferredSkills.length : Math.min(MAX_VISIBLE, preferredSkills.length);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero */}
        <div className={pageHeader}>
          <div>
            <h1 className={pageTitle}>
              Analyze a Role
            </h1>
            <p className={pageSubtitle}>
              Paste a job description to parse requirements. Add your resume for alignment.
            </p>
          </div>
          <Link
            to="/roles"
            className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors shrink-0"
          >
            View roles →
          </Link>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Left: Input panel */}
          <section
            className={cn(
              card,
              "focus-within:border-slate-300 transition-colors"
            )}
          >
            <div className="space-y-5">
              {!resume && !jd.trim() && (
                <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/[0.05] px-4 py-3 text-sm">
                  <div className="font-medium text-slate-800">New here? See how it works in 10 seconds.</div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Loads a made-up resume and a sample internship posting. Nothing of yours is uploaded.
                  </p>
                  <button
                    type="button"
                    onClick={handleTryExample}
                    disabled={loadingExample}
                    className="mt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800 disabled:opacity-50"
                  >
                    {loadingExample ? "Loading the example…" : "Try an example →"}
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  Your resume (PDF or Word) <span className="text-slate-400">add it to get your fit score</span>
                </label>
                <ResumeDropzone fileName={resume ? resume.name : null} onFile={(file) => setResume(file)} />
                {lastResumeFilename && !resume && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Last used: {lastResumeFilename}
                  </p>
                )}
                {user && savedResumes.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 shrink-0">or choose from saved:</span>
                    <select
                      value={selectedResumeId ?? ""}
                      onChange={(e) => {
                        if (e.target.value) handleSelectSavedResume(e.target.value);
                      }}
                      className="h-8 w-full rounded-md border border-slate-200 bg-slate-900/[0.04] px-2 text-xs text-slate-700 focus:border-slate-300 focus:outline-none"
                    >
                      <option value="">Select a saved resume…</option>
                      {savedResumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.isDefault ? " (default)" : ""} · v{r.version}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {resume && isDocxFile(resume) && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Word files are fine for analysis. Saving to My Resumes needs a PDF, and a role&apos;s page can&apos;t preview Word files.
                  </p>
                )}
                {user && resume && resumeText && !selectedResumeId && !isDocxFile(resume) && (
                  <button
                    type="button"
                    onClick={handleSaveResume}
                    disabled={savingResume}
                    className="mt-2 text-xs font-medium text-cyan-700 hover:text-cyan-800 disabled:opacity-50"
                  >
                    {savingResume ? "Saving…" : "Save this resume to My Resumes"}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  Job description
                </label>
                <Textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job posting here: the responsibilities and the requirements."
                  className="min-h-[250px]"
                />
                {jdState.message && (
                  <p className={cn("mt-1.5 text-xs", jdState.ready ? "text-slate-500" : "text-amber-700")}>
                    {jdState.message}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyzeJdOnly || loading}
                className="w-full"
                variant="primary"
              >
                {loading && (
                  <span
                    className="inline-block h-4 w-4 rounded-full border-2 border-black/20 border-t-black animate-spin"
                    aria-hidden
                  />
                )}
                {loading ? "Analyzing…" : resume ? "Analyze my fit" : "Analyze"}
              </Button>

              {!loading && jdState.ready && !resume && (
                <p className="text-xs text-slate-500">
                  No resume added, so you&apos;ll see what the job asks for but not your fit score. Add your resume
                  above to get your score.
                </p>
              )}

              {loading && slowRequest && (
                <p className="text-xs text-slate-500">
                  Still working — the server may be waking up from idle, this can take up to a minute.
                </p>
              )}

              {analyzeError && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-700">
                  {analyzeError}
                  <button
                    type="button"
                    onClick={() => onAnalyze(reanalyzeRoleId ? { roleId: reanalyzeRoleId } : undefined)}
                    disabled={!canAnalyze || loading}
                    className="mt-2 block text-red-700 hover:text-red-100 underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right: Results panel */}
          <section ref={resultsRef} className={cn(card, "flex min-h-[280px] flex-col justify-center scroll-mt-20")}>
            {!hasResults ? (
              <p className="text-sm text-slate-500 text-center">
                Paste a job description above and click Analyze to see role requirements.
              </p>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {report?.meta?.projected && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <strong>Projected score.</strong>{" "}
                    {report.meta.additionsCount === 1
                      ? "This counts 1 bullet you wrote here that isn't in your resume file yet, so it isn't saved. Add it to your resume, upload it, and analyze again to make it official."
                      : `This counts ${report.meta.additionsCount ?? "the"} bullets you wrote here that aren't in your resume file yet, so it isn't saved. Add them to your resume, upload it, and analyze again to make it official.`}
                  </div>
                )}

                {nextSteps.length > 0 && (
                  <div className={cn(cardAlt, "p-4")}>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Your next steps</div>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-800">
                      {nextSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* A vs B comparison (Re-analyze flow) */}
                {showComparison && (
                  <div className={cn(cardAlt, "p-4")}>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
                      A vs B comparison
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-900/[0.04] p-3">
                        <div className="text-[10px] uppercase text-slate-500">A — Previous</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {alignmentToPreparedness(previousReport.alignment)}
                        </div>
                        <div className="text-xs text-slate-500">Preparedness</div>
                      </div>
                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                        <div className="text-[10px] uppercase text-cyan-600/80">B — New</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {alignmentToPreparedness(report!.alignment)}
                        </div>
                        <div className="text-xs text-slate-500">Preparedness</div>
                      </div>
                    </div>
                    {verdict && (
                      <p className={cn(
                        "mt-3 text-sm font-medium",
                        verdict.better === "B" && "text-cyan-600",
                        verdict.better === "A" && "text-amber-600",
                        !verdict.better && "text-slate-600"
                      )}>
                        {verdict.text}
                      </p>
                    )}
                  </div>
                )}

                {/* Last analyzed */}
                {lastAnalyzedAt && (
                  <p className="text-[11px] text-slate-400">
                    Last analyzed {new Date(lastAnalyzedAt).toLocaleString()}
                  </p>
                )}

                {/* Score breakdown */}
                {report?.breakdown && (
                  <div className={cn(cardAlt, "p-4")}>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
                      Score breakdown
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Required skills", value: report.breakdown.requiredSkills },
                        { label: "Technical stack", value: report.breakdown.technicalStack },
                        { label: "Resume evidence", value: report.breakdown.resumeEvidence },
                        { label: "ATS friendliness", value: report.breakdown.ats },
                      ].map((c) => (
                        <div key={c.label} className="text-center">
                          <div className="text-lg font-semibold text-slate-900">{c.value}%</div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dedicated, deeper ATS compatibility check — user-triggered,
                    separate metered feature from /analyze itself. Needs real
                    extracted resume text, so it's hidden in JD-only mode. */}
                {report && resumeText && (
                  <AtsChecker resumeText={resumeText} jobDescriptionText={jd} />
                )}

                {/* Salary (regex-extracted from the JD text; never fabricated) */}
                {report?.salary && (
                  <div className={cn(cardAlt, "p-4")}>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                      Salary mentioned in this posting
                    </h3>
                    <p className="text-lg font-semibold text-slate-900">
                      {report.salary.currency} {report.salary.min.toLocaleString()}–{report.salary.max.toLocaleString()}
                      <span className="ml-1 text-sm font-normal text-slate-500">
                        {report.salary.period === "hourly" ? "/hour" : "/year"}
                      </span>
                    </p>
                    {report.salary.estimatedAnnual && (
                      <p className="mt-1 text-xs text-slate-500">
                        Estimated annual: {report.salary.currency}{" "}
                        {report.salary.estimatedAnnual.min.toLocaleString()}–
                        {report.salary.estimatedAnnual.max.toLocaleString()}.{" "}
                        {report.salary.estimatedAnnual.note}
                      </p>
                    )}
                  </div>
                )}

                {/* AI take */}
                {report?.aiSummary && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI take
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {report.aiSummary}
                    </p>
                  </div>
                )}

                {/* A) Role Requirements Overview */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">
                    Role Requirements Overview
                  </h3>

                  {coreSkills.length > 0 && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => toggleSection("core")}
                        className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2 w-full text-left"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Core Skills (must-have)
                        {coreSkills.length > MAX_VISIBLE && (
                          collapsedSections.core ? (
                            <ChevronUp className="h-3 w-3 ml-auto" />
                          ) : (
                            <ChevronDown className="h-3 w-3 ml-auto" />
                          )
                        )}
                      </button>
                      <ul className="space-y-1.5">
                        {coreSkills.slice(0, coreVisible).map((s) => (
                          <li key={s} className="flex items-center gap-2 text-sm text-slate-800">
                            <CheckCircle2 className="h-4 w-4 text-cyan-500/80 shrink-0" />
                            {s}
                            {skillImportanceByName.get(s) === "preferred" && (
                              <span className="rounded-full border border-slate-200 bg-slate-900/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                Nice-to-have
                              </span>
                            )}
                          </li>
                        ))}
                        {coreSkills.length > MAX_VISIBLE && !collapsedSections.core && (
                          <li>
                            <button
                              type="button"
                              onClick={() => setCollapsedSections((p) => ({ ...p, core: true }))}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              +{coreSkills.length - MAX_VISIBLE} more
                            </button>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {preferredSkills.length > 0 && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => toggleSection("preferred")}
                        className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2 w-full text-left"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Preferred Skills
                        {preferredSkills.length > MAX_VISIBLE && (
                          collapsedSections.preferred ? (
                            <ChevronUp className="h-3 w-3 ml-auto" />
                          ) : (
                            <ChevronDown className="h-3 w-3 ml-auto" />
                          )
                        )}
                      </button>
                      <ul className="space-y-1.5">
                        {preferredSkills.slice(0, preferredVisible).map((s) => (
                          <li key={s} className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                            {s}
                            {skillImportanceByName.get(s) === "required" && (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                                Required
                              </span>
                            )}
                          </li>
                        ))}
                        {preferredSkills.length > MAX_VISIBLE && !collapsedSections.preferred && (
                          <li>
                            <button
                              type="button"
                              onClick={() => setCollapsedSections((p) => ({ ...p, preferred: true }))}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              +{preferredSkills.length - MAX_VISIBLE} more
                            </button>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {experienceLevel && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        Experience Level
                      </div>
                      <p className="text-sm text-slate-700">{experienceLevel}</p>
                    </div>
                  )}
                </div>

                {report && resume && (
                  <ResumeAdditionsPanel
                    missingSkills={report.skills
                      .filter((x) => x.status === "miss")
                      .map((x) => ({ name: x.name, importance: x.importance ?? "required" }))}
                    additions={additions}
                    onChange={setAdditions}
                    onRecheck={handleRecheckWithAdditions}
                    rechecking={loading}
                    baseline={baseline}
                    current={{ alignment: report.alignment, coverage: report.coverage }}
                    projected={Boolean(report.meta?.projected)}
                  />
                )}

                {report && (
                  <SkillGapHelper
                    missingRequiredSkills={missingRequiredSkills}
                    resumeText={resumeText || undefined}
                    context={parsedJdData?.experienceLevel || undefined}
                  />
                )}

                {/* B) Preparation Signals */}
                {(preparedness || preparationSignals.length > 0) && (
                  <div className={cn(cardAlt, "p-4")}>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
                      Preparation signals
                    </h3>
                    <div className="space-y-2">
                      {preparedness && (
                        <p className={cn(
                          "text-sm font-medium",
                          preparedness === "High" && "text-cyan-600",
                          preparedness === "Medium" && "text-amber-600/90",
                          preparedness === "Low" && "text-slate-600"
                        )}>
                          {preparedness} preparedness
                        </p>
                      )}
                      {preparationSignals.slice(0, 6).map((s) => (
                        <p key={s} className="text-sm text-slate-600">
                          • {s}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* C) Action Panel */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h3 className="text-xs font-medium text-slate-500 mb-2">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/resume-lab", { state: { jobDescription: jd.trim() } })}
                      className="btn-press inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400"
                    >
                      <FileEdit className="h-4 w-4" />
                      Tailor resume bullets
                    </button>
                    {preferredSkills.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAddMissingSkillNote(preferredSkills[0])}
                        className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900/[0.04] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                      >
                        <Sparkles className="h-4 w-4" />
                        Add missing skill note
                      </button>
                    )}
                    <div className="relative" ref={markNextStepRef}>
                      <button
                        type="button"
                        onClick={() => setShowMarkNextStep((p) => !p)}
                        className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900/[0.04] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                      >
                        <ListChecks className="h-4 w-4" />
                        Mark next step
                        <ChevronDown className={cn("h-4 w-4 transition", showMarkNextStep && "rotate-180")} />
                      </button>
                      {showMarkNextStep && (
                        <div className="absolute left-0 top-full mt-1 z-10 rounded-xl border border-slate-200 bg-[#FFFFFF] py-2 shadow-xl min-w-[180px] animate-fade-in">
                          {QUICK_NEXT_STEPS.map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => handleMarkNextStep(step)}
                              className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-900/[0.06]"
                            >
                              {step}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Add to Roles (or Re-analyze choices) */}
                <div className="pt-2 border-t border-slate-200">
                  {showComparison ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500">
                        Choose which version to save as the role&apos;s fit score.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (reanalyzeRoleId) {
                              navigate(`/roles`, { state: { openRoleId: reanalyzeRoleId } });
                            } else {
                              navigate("/roles");
                            }
                          }}
                          className="btn-press flex-1 rounded-xl border border-slate-300 bg-slate-900/[0.04] px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                        >
                          Keep A (Previous)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (report?.meta?.projected) {
                              toast.error({ title: "Not saved yet", description: PROJECTED_SAVE_MESSAGE });
                              return;
                            }
                            if (reanalyzeRoleId && report && alignmentHistory) {
                              const snapshot = {
                                alignment: report.alignment,
                                coverage: report.coverage,
                                skills: report.skills,
                                missingSignals: report.missingSignals,
                                actions: report.actions,
                                meta: report.meta,
                                salary: report.salary ?? undefined,
                                alignmentHistory: alignmentHistory.map((h) => ({
                                  alignment: h.alignment,
                                  createdAt: h.createdAt,
                                })),
                                breakdown: report.breakdown,
                                resumeStrengthAtSave: resumeStrength?.score,
                              };
                              updateReportSnapshot(reanalyzeRoleId, snapshot);
                              void syncResumeToRole(reanalyzeRoleId);
                              toast.success({
                                title: "Preparedness updated",
                                description: `Now showing ${alignmentToPreparedness(report.alignment)} preparedness.`,
                              });
                              navigate(`/roles`, { state: { openRoleId: reanalyzeRoleId } });
                            } else {
                              navigate("/roles");
                            }
                          }}
                          className="btn-press flex-1 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400"
                        >
                          Use B (New)
                        </button>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => navigate("/roles")}
                          className="btn-press flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500 transition hover:bg-slate-900/[0.04]"
                        >
                          Back to Roles
                        </button>
                        <Link
                          to="/dashboard"
                          className="btn-press flex-1 rounded-xl border border-slate-200 px-4 py-2 text-center text-sm text-slate-500 transition hover:bg-slate-900/[0.04]"
                        >
                          Dashboard
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-medium text-slate-500">Add to Roles</span>
                        {hasResults && (
                          <button
                            type="button"
                            onClick={() => {
                              if (resume && hasValidJd) onAnalyze(reanalyzeRoleId ? { roleId: reanalyzeRoleId } : undefined);
                              else onAnalyzeJdOnly();
                            }}
                            className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Re-analyze
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {recentCompanies.length > 0 && (
                          <datalist id="analyzer-companies">
                            {recentCompanies.map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                        )}
                        {recentRoles.length > 0 && (
                          <datalist id="analyzer-roles">
                            {recentRoles.map((r) => (
                              <option key={r} value={r} />
                            ))}
                          </datalist>
                        )}
                        <Input
                          value={tracker.company}
                          onChange={(e) => tracker.setCompany(e.target.value)}
                          placeholder="Company (e.g. Microsoft)"
                          list={recentCompanies.length > 0 ? "analyzer-companies" : undefined}
                        />
                        <Input
                          value={tracker.role}
                          onChange={(e) => tracker.setRole(e.target.value)}
                          placeholder="Role (e.g. SWE Intern)"
                          list={recentRoles.length > 0 ? "analyzer-roles" : undefined}
                        />
                        <div>
                          <label htmlFor="analyzer-add-status" className="mb-1 block text-xs text-slate-500">
                            Status
                          </label>
                          <select
                            id="analyzer-add-status"
                            value={addStatus}
                            onChange={(e) => setAddStatus(e.target.value as TrackerStatus)}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-900/[0.04] px-3 text-sm text-slate-800 focus:border-slate-300 focus:outline-none"
                          >
                            <option value="Wishlist">Wishlist (just interested)</option>
                            <option value="Analyzed">Analyzed (checked my fit)</option>
                            <option value="Ready to Apply">Ready to apply</option>
                            <option value="Applied">Applied</option>
                          </select>
                        </div>
                        <Input
                          value={tracker.nextStep}
                          onChange={(e) => tracker.setNextStep(e.target.value)}
                          placeholder="Next step (e.g. Follow up)"
                        />
                        {tracker.trackerError && (
                          <p className="text-xs text-red-600">
                            {tracker.trackerError}
                          </p>
                        )}
                        <Button
                          type="button"
                          onClick={handleAddToRoles}
                          className="w-full"
                          variant="primary"
                        >
                          Add to Roles
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
