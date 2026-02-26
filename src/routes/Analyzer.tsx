import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
import { useTracker } from "../features/tracker/hooks/useTracker";
import { getRecentCompanies, getRecentRoles } from "../lib/dashboardStats";
import { cn } from "../lib/cn";
import { alignmentToPreparedness, type Preparedness } from "../lib/preparedness";

const QUICK_NEXT_STEPS = ["Tailor resume", "Apply", "Follow up", "Prepare for interview"];

export function Analyzer() {
  const navigate = useNavigate();
  const location = useLocation();
  const analyzer = useAnalyzer();
  const tracker = useTracker(analyzer.report?.alignment);
  const { updateReportSnapshot } = tracker;

  const {
    resume,
    setResume,
    lastResumeFilename,
    jd,
    setJd,
    loading,
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

  const handleAnalyze = () => {
    if (!hasValidJd) {
      toast.error({ title: "Add job description", description: "Add job description to analyze this role." });
      return;
    }
    if (resume) {
      onAnalyze();
    } else {
      onAnalyzeJdOnly();
    }
  };

  const handleAddToRoles = () => {
    const snapshot =
      report && alignmentHistory
        ? {
            alignment: report.alignment,
            coverage: report.coverage,
            skills: report.skills,
            missingSignals: report.missingSignals,
            actions: report.actions,
            meta: report.meta,
            alignmentHistory: alignmentHistory.map((h) => ({
              alignment: h.alignment,
              createdAt: h.createdAt,
            })),
            resumeStrengthAtSave: resumeStrength?.score,
          }
        : undefined;
    const company = tracker.company.trim() || "Unknown company";
    const role = tracker.role.trim() || report?.roleTitle || "Unknown role";
    const notesFromSkills =
      skillsToAddToNotes.length > 0 ? `Skills to highlight:\n• ${skillsToAddToNotes.join("\n• ")}` : undefined;
    tracker.addManualTrackerItem(
      (newItemId) => {
        setSkillsToAddToNotes([]);
        navigate(`/roles/${newItemId}`);
      },
      snapshot,
      {
        company,
        role,
        status: "Applied",
        nextStep: tracker.nextStep || "Follow up",
        jobDescription: jd.trim() || undefined,
        notes: notesFromSkills,
      }
    );
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
            className="text-sm font-medium text-white/80 hover:text-white transition-colors shrink-0"
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
              "focus-within:border-white/20 transition-colors"
            )}
          >
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">
                  Upload resume <span className="text-white/40">(optional for parse-only)</span>
                </label>
                <label className="flex h-10 cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm transition-colors hover:bg-white/10">
                  <span className="text-white/80">
                    {resume ? resume.name : "Choose PDF"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-white/40">
                    Max 5MB
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) =>
                      setResume(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {lastResumeFilename && !resume && (
                  <p className="mt-1.5 text-[11px] text-white/45">
                    Last used: {lastResumeFilename}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">
                  Job description
                </label>
                <Textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="min-h-[250px]"
                />
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
                {loading ? "Analyzing…" : "Analyze"}
              </Button>

              {analyzeError && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                  {analyzeError}
                  <button
                    type="button"
                    onClick={onAnalyze}
                    disabled={!canAnalyze || loading}
                    className="mt-2 block text-red-300 hover:text-red-100 underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right: Results panel */}
          <section className={cn(card, "flex min-h-[280px] flex-col justify-center")}>
            {!hasResults ? (
              <p className="text-sm text-white/50 text-center">
                Paste a job description above and click Analyze to see role requirements.
              </p>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* A vs B comparison (Re-analyze flow) */}
                {showComparison && (
                  <div className={cn(cardAlt, "p-4")}>
                    <div className="text-xs font-medium uppercase tracking-wide text-white/50 mb-3">
                      A vs B comparison
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] uppercase text-white/50">A — Previous</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {alignmentToPreparedness(previousReport.alignment)}
                        </div>
                        <div className="text-xs text-white/60">Preparedness</div>
                      </div>
                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                        <div className="text-[10px] uppercase text-cyan-400/80">B — New</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {alignmentToPreparedness(report!.alignment)}
                        </div>
                        <div className="text-xs text-white/60">Preparedness</div>
                      </div>
                    </div>
                    {verdict && (
                      <p className={cn(
                        "mt-3 text-sm font-medium",
                        verdict.better === "B" && "text-cyan-400",
                        verdict.better === "A" && "text-amber-400",
                        !verdict.better && "text-white/70"
                      )}>
                        {verdict.text}
                      </p>
                    )}
                  </div>
                )}

                {/* Last analyzed */}
                {lastAnalyzedAt && (
                  <p className="text-[11px] text-white/45">
                    Last analyzed {new Date(lastAnalyzedAt).toLocaleString()}
                  </p>
                )}

                {/* A) Role Requirements Overview */}
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-3">
                    Role Requirements Overview
                  </h3>

                  {coreSkills.length > 0 && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => toggleSection("core")}
                        className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2 w-full text-left"
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
                          <li key={s} className="flex items-center gap-2 text-sm text-white/90">
                            <CheckCircle2 className="h-4 w-4 text-cyan-500/80 shrink-0" />
                            {s}
                          </li>
                        ))}
                        {coreSkills.length > MAX_VISIBLE && !collapsedSections.core && (
                          <li>
                            <button
                              type="button"
                              onClick={() => setCollapsedSections((p) => ({ ...p, core: true }))}
                              className="text-xs text-white/50 hover:text-white/80"
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
                        className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2 w-full text-left"
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
                          <li key={s} className="flex items-center gap-2 text-sm text-white/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-white/50 shrink-0" />
                            {s}
                          </li>
                        ))}
                        {preferredSkills.length > MAX_VISIBLE && !collapsedSections.preferred && (
                          <li>
                            <button
                              type="button"
                              onClick={() => setCollapsedSections((p) => ({ ...p, preferred: true }))}
                              className="text-xs text-white/50 hover:text-white/80"
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
                      <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        Experience Level
                      </div>
                      <p className="text-sm text-white/80">{experienceLevel}</p>
                    </div>
                  )}
                </div>

                {/* B) Preparation Signals */}
                {(preparedness || preparationSignals.length > 0) && (
                  <div className={cn(cardAlt, "p-4")}>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-white/50 mb-3">
                      Preparation signals
                    </h3>
                    <div className="space-y-2">
                      {preparedness && (
                        <p className={cn(
                          "text-sm font-medium",
                          preparedness === "High" && "text-cyan-400",
                          preparedness === "Medium" && "text-amber-400/90",
                          preparedness === "Low" && "text-white/70"
                        )}>
                          {preparedness} preparedness
                        </p>
                      )}
                      {preparationSignals.slice(0, 6).map((s) => (
                        <p key={s} className="text-sm text-white/70">
                          • {s}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* C) Action Panel */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <h3 className="text-xs font-medium text-white/50 mb-2">Actions</h3>
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
                        className="btn-press inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
                      >
                        <Sparkles className="h-4 w-4" />
                        Add missing skill note
                      </button>
                    )}
                    <div className="relative" ref={markNextStepRef}>
                      <button
                        type="button"
                        onClick={() => setShowMarkNextStep((p) => !p)}
                        className="btn-press inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
                      >
                        <ListChecks className="h-4 w-4" />
                        Mark next step
                        <ChevronDown className={cn("h-4 w-4 transition", showMarkNextStep && "rotate-180")} />
                      </button>
                      {showMarkNextStep && (
                        <div className="absolute left-0 top-full mt-1 z-10 rounded-xl border border-white/10 bg-[#0d1117] py-2 shadow-xl min-w-[180px]">
                          {QUICK_NEXT_STEPS.map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => handleMarkNextStep(step)}
                              className="block w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10"
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
                <div className="pt-2 border-t border-white/10">
                  {showComparison ? (
                    <div className="space-y-3">
                      <p className="text-sm text-white/60">
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
                          className="btn-press flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
                        >
                          Keep A (Previous)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (reanalyzeRoleId && report && alignmentHistory) {
                              const snapshot = {
                                alignment: report.alignment,
                                coverage: report.coverage,
                                skills: report.skills,
                                missingSignals: report.missingSignals,
                                actions: report.actions,
                                meta: report.meta,
                                alignmentHistory: alignmentHistory.map((h) => ({
                                  alignment: h.alignment,
                                  createdAt: h.createdAt,
                                })),
                                resumeStrengthAtSave: resumeStrength?.score,
                              };
                              updateReportSnapshot(reanalyzeRoleId, snapshot);
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
                          className="btn-press flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:bg-white/5"
                        >
                          Back to Roles
                        </button>
                        <Link
                          to="/dashboard"
                          className="btn-press flex-1 rounded-xl border border-white/10 px-4 py-2 text-center text-sm text-white/60 transition hover:bg-white/5"
                        >
                          Dashboard
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-medium text-white/50">Add to Roles</span>
                        {hasResults && (
                          <button
                            type="button"
                            onClick={() => {
                              if (resume && hasValidJd) onAnalyze();
                              else onAnalyzeJdOnly();
                            }}
                            className="text-xs text-white/45 hover:text-white/80 inline-flex items-center gap-1"
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
                        <Input
                          value={tracker.nextStep}
                          onChange={(e) => tracker.setNextStep(e.target.value)}
                          placeholder="Next step (e.g. Follow up)"
                        />
                        {tracker.trackerError && (
                          <p className="text-xs text-red-400">
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
