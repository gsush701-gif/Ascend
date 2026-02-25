import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { useAnalyzer } from "../features/analyzer/hooks/useAnalyzer";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { cn } from "../lib/cn";

export function Analyzer() {
  const navigate = useNavigate();
  const analyzer = useAnalyzer();
  const tracker = useTracker(analyzer.report?.alignment);

  const {
    resume,
    setResume,
    jd,
    setJd,
    loading,
    report,
    analyzeError,
    canAnalyze,
    onAnalyze,
    alignmentHistory,
    resumeStrength,
  } = analyzer;

  useEffect(() => {
    if (report?.roleTitle && !tracker.role.trim()) {
      tracker.setRole(report.roleTitle);
    }
  }, [report?.roleTitle]);

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
    tracker.addManualTrackerItem(
      (newItemId) => navigate(`/roles/${newItemId}`),
      snapshot,
      { company, role }
    );
  };

  const hits = report?.skills.filter((s) => s.status === "hit").length ?? 0;
  const misses = report?.skills.filter((s) => s.status === "miss").length ?? 0;
  const summary =
    report && report.skills.length > 0
      ? `${hits} skill${hits !== 1 ? "s" : ""} matched, ${misses} missing`
      : null;

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Analyze a Role
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Upload your resume and paste a job description to measure alignment.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Input panel */}
          <section
            className={cn(
              "rounded-2xl border border-white/10 bg-white/5 p-6",
              "focus-within:border-white/20 transition-colors"
            )}
          >
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">
                  Upload resume
                </label>
                <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition-colors cursor-pointer">
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
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">
                  Job description
                </label>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the job description here..."
                  className={cn(
                    "w-full min-h-[250px] rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40",
                    "outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all resize-y"
                  )}
                />
              </div>

              <button
                type="button"
                onClick={onAnalyze}
                disabled={!canAnalyze || loading}
                className={cn(
                  "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                  "bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed",
                  "inline-flex items-center justify-center gap-2"
                )}
              >
                {loading && (
                  <span
                    className="inline-block h-4 w-4 rounded-full border-2 border-black/20 border-t-black animate-spin"
                    aria-hidden
                  />
                )}
                {loading ? "Analyzing…" : "Analyze Alignment"}
              </button>

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

          {/* Right: Live preview / result */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 min-h-[280px] flex flex-col justify-center">
            {!report ? (
              <p className="text-sm text-white/50 text-center">
                Upload your resume and paste a job description above, then click
                Analyze.
              </p>
            ) : (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <div>
                    <div className="text-xs text-white/50">Alignment</div>
                    <div className="text-3xl font-semibold text-white">
                      {report.alignment}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50">Coverage</div>
                    <div className="text-2xl font-semibold text-white/90">
                      {report.coverage}%
                    </div>
                  </div>
                </div>
                {summary && (
                  <p className="text-sm text-white/70">{summary}</p>
                )}

                <div className="pt-2 border-t border-white/10">
                  <div className="text-xs font-medium text-white/50 mb-3">
                    Add to Roles
                  </div>
                  <div className="space-y-3">
                    <input
                      value={tracker.company}
                      onChange={(e) => tracker.setCompany(e.target.value)}
                      placeholder="Company (e.g. Microsoft)"
                      className={cn(
                        "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40",
                        "outline-none focus:border-white/20 transition-colors"
                      )}
                    />
                    <input
                      value={tracker.role}
                      onChange={(e) => tracker.setRole(e.target.value)}
                      placeholder="Role (e.g. SWE Intern)"
                      className={cn(
                        "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40",
                        "outline-none focus:border-white/20 transition-colors"
                      )}
                    />
                    {tracker.trackerError && (
                      <p className="text-xs text-red-400">
                        {tracker.trackerError}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleAddToRoles}
                      className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
                    >
                      Add to Roles
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
