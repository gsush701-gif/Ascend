import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Save } from "lucide-react";
import { PageLayout } from "../components/layout/PageLayout";
import { Card } from "../components/ui/Card";
import { Container } from "../components/ui/Container";
import { cn } from "../lib/cn";
import { useAnalyzer } from "../features/analyzer/hooks/useAnalyzer";
import { useTracker } from "../features/tracker/hooks/useTracker";
import {
  getApplicationConfidence,
  getInterviewProbability,
  getRecruiterScan,
  getRoleDifficulty,
  getSignalDisplay,
  improveResumeBullet,
} from "../features/analyzer/utils";
import { ResumeUploader } from "../features/analyzer/components/ResumeUploader";
import { JobDescriptionBox } from "../features/analyzer/components/JobDescriptionBox";
import { SkillPills } from "../features/analyzer/components/SkillPills";
import { MissingSignals } from "../features/analyzer/components/MissingSignals";
import { ActionsList } from "../features/analyzer/components/ActionsList";

export function Analyzer() {
  const navigate = useNavigate();
  const analyzer = useAnalyzer();
  const tracker = useTracker(analyzer.report?.alignment);

  const {
    resume,
    setResume,
    resumeStrength,
    resumeStrengthLoading,
    jd,
    setJd,
    loading,
    report,
    analyzeError,
    canAnalyze,
    onAnalyze,
    recruiterSimMode,
    setRecruiterSimMode,
    bulletImproveInput,
    setBulletImproveInput,
    alignmentHistory,
    shareSlug,
    setShareSlug,
    shareLinkCopied,
    generateShareLink,
  } = analyzer;

  useEffect(() => {
    if (report?.roleTitle && !tracker.role.trim()) {
      tracker.setRole(report.roleTitle);
    }
  }, [report?.roleTitle]);

  const handleSaveToTracker = () => {
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
    const company =
      tracker.company.trim() || "Unknown company";
    const role =
      tracker.role.trim() || report?.roleTitle || "Unknown role";
    tracker.addManualTrackerItem(
      () => navigate("/tracker"),
      snapshot,
      { company, role }
    );
  };

  return (
    <PageLayout>
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left - Resume */}
          <section className="lg:col-span-1 space-y-6 rounded-2xl bg-gradient-to-b from-zinc-950 to-zinc-900/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
            <ResumeUploader resume={resume} onResumeChange={setResume} />

            {resume && (
              <Card>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                  Step 2 • Intelligence
                </div>
                <div className="text-sm font-semibold text-zinc-100">
                  Resume Overview
                </div>
                <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-500">
                      Resume Strength
                    </span>
                    {resumeStrengthLoading ? (
                      <span className="text-sm text-zinc-500">Analyzing…</span>
                    ) : resumeStrength ? (
                      <span className="text-lg font-semibold text-zinc-100">
                        {resumeStrength.score}/100
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                  {resumeStrength && !resumeStrengthLoading && (
                    <div className="mt-3 space-y-2 text-xs">
                      {(
                        [
                          { key: "quantifiedBullets" as const, state: resumeStrength.signals.quantifiedBullets },
                          { key: "github" as const, state: resumeStrength.signals.github },
                          { key: "deployment" as const, state: resumeStrength.signals.deployment },
                          { key: "metrics" as const, state: resumeStrength.signals.metrics },
                        ] as const
                      ).map(({ key, state }) => {
                        const d = getSignalDisplay(key, state);
                        const iconClass =
                          state === "linked"
                            ? "text-emerald-400"
                            : state === "mentioned_only"
                              ? "text-amber-400"
                              : "text-zinc-500";
                        return (
                          <div key={key} className="flex gap-2">
                            <span className={cn("shrink-0", iconClass)}>{d.icon}</span>
                            <div>
                              <span className="font-medium text-zinc-300">{d.label}: </span>
                              <span className="text-zinc-400">{d.message}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex gap-2 pt-0.5">
                        {resumeStrength.signals.projects ? (
                          <>
                            <span className="shrink-0 text-emerald-400">✓</span>
                            <span className="text-zinc-400">
                              <span className="font-medium text-zinc-300">Projects: </span>
                              Projects section present.
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="shrink-0 text-zinc-500">❗</span>
                            <span className="text-zinc-400">
                              <span className="font-medium text-zinc-300">Projects: </span>
                              No projects section detected.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2 text-sm text-zinc-300">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-zinc-500 shrink-0">•</span>
                    <span className="min-w-0 truncate">
                      <span className="text-zinc-500">File:</span>{" "}
                      <span className="text-zinc-200">{resume.name}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">•</span>
                    <span>
                      <span className="text-zinc-500">Size:</span>{" "}
                      {resume.size >= 1024 * 1024
                        ? `${(resume.size / 1024 / 1024).toFixed(2)} MB`
                        : `${(resume.size / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">•</span>
                    <span>
                      <span className="text-zinc-500">Pages:</span>{" "}
                      {report?.meta?.pdfPages != null ? report.meta.pdfPages : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">•</span>
                    <span>
                      <span className="text-zinc-500">Skills extracted:</span>{" "}
                      {report?.meta?.resumeSkillsFound ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">•</span>
                    <span>
                      <span className="text-zinc-500">Parsing:</span>{" "}
                      {report ? "Successful" : "Pending"}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                Bullet improvement
              </div>
              <div className="text-sm font-semibold text-zinc-100">
                Strengthen a resume line
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Paste a short bullet; we add stack, scale, and impact.
              </p>
              <input
                type="text"
                value={bulletImproveInput}
                onChange={(e) => setBulletImproveInput(e.target.value)}
                placeholder='e.g. "Built REST API"'
                className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-zinc-600"
              />
              {bulletImproveInput.trim() && (
                <div className="mt-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-sm">
                  <div className="text-xs font-medium text-emerald-400/90 mb-1.5">
                    Improved bullet
                  </div>
                  <p className="text-zinc-200 leading-snug">
                    &ldquo;{improveResumeBullet(bulletImproveInput)}&rdquo;
                  </p>
                </div>
              )}
            </Card>

            <Card>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                Shareable profile
              </div>
              <div className="text-sm font-semibold text-zinc-100">Get your link</div>
              <p className="mt-1 text-xs text-zinc-400">
                Share top skills, resume strength, and alignment history.
              </p>
              <input
                type="text"
                value={shareSlug}
                onChange={(e) =>
                  setShareSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
                }
                placeholder="username (e.g. sushil)"
                className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-zinc-600"
              />
              <button
                type="button"
                onClick={generateShareLink}
                disabled={!shareSlug.trim()}
                className={cn(
                  "mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  shareSlug.trim()
                    ? "bg-zinc-100 text-zinc-900 hover:bg-white"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                {shareLinkCopied ? "Copied!" : "Generate & copy link"}
              </button>
              {shareSlug.trim() && (
                <p className="mt-2 text-[11px] text-zinc-500">
                  {typeof window !== "undefined" && window.location.origin}/
                  {shareSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "")}
                </p>
              )}
            </Card>
          </section>

          {/* Center - Report */}
          <section className="lg:col-span-2 space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-2xl font-semibold tracking-tight">
                    InternOS Alignment Report
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    Upload a resume + paste a job description to generate an action plan.
                  </div>
                </div>
                {report && (
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Coverage</div>
                    <div className="text-xl font-semibold">{report.coverage}%</div>
                  </div>
                )}
              </div>

              {!report ? (
                <div className="rounded-3xl border border-zinc-900 bg-zinc-950/40 p-12 text-center">
                  <div className="text-xl font-semibold mb-2">
                    AI-powered Resume Intelligence
                  </div>
                  <div className="text-sm text-zinc-400 mb-8">
                    Upload your resume and instantly measure alignment against any
                    internship role.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-lg font-semibold mb-1">1. Upload Resume</div>
                      <div className="text-sm text-zinc-500">Text-based PDF recommended.</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold mb-1">2. Paste Job Description</div>
                      <div className="text-sm text-zinc-500">We extract required skills automatically.</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold mb-1">3. Get Action Plan</div>
                      <div className="text-sm text-zinc-500">Improve alignment before applying.</div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div>
                      <div className="text-2xl font-semibold text-zinc-100">
                        Overall Alignment: {report.alignment}%
                      </div>
                    </div>
                    {(() => {
                      const confidence = getApplicationConfidence(report, resumeStrength ?? null);
                      const confStyles = {
                        High: "border-emerald-500/50 bg-emerald-950/30 text-emerald-200",
                        Medium: "border-amber-500/50 bg-amber-950/30 text-amber-200",
                        Low: "border-rose-500/50 bg-rose-950/30 text-rose-200",
                      };
                      return (
                        <div className="flex flex-col gap-1">
                          <div
                            className={cn(
                              "rounded-xl border px-4 py-2 text-sm font-semibold",
                              confStyles[confidence]
                            )}
                          >
                            Application Confidence: {confidence}
                          </div>
                          <span className="text-[11px] text-zinc-500">
                            Based on alignment, resume strength, missing signals
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {(() => {
                    const prob = getInterviewProbability(
                      report,
                      resumeStrength ?? null,
                      alignmentHistory
                    );
                    return (
                      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                          Internship probability engine
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span className="text-2xl font-bold text-zinc-100">
                            Estimated interview probability: {prob}%
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-zinc-500">
                          Based on alignment %, resume strength, missing signals, historical improvement
                        </p>
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setRecruiterSimMode((v) => !v)}
                    className={cn(
                      "mb-6 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                      recruiterSimMode
                        ? "border-amber-500/50 bg-amber-950/30 text-amber-200"
                        : "border-zinc-700/80 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    )}
                  >
                    <span aria-hidden>🧠</span>
                    <span>Simulate 6-Second Recruiter Scan</span>
                  </button>

                  {recruiterSimMode && (() => {
                    const scan = getRecruiterScan(report, resumeStrength ?? null);
                    return (
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90 mb-3">
                            Top 3 things a recruiter notices
                          </div>
                          <ul className="space-y-2 text-sm text-zinc-200">
                            {scan.notices.map((n, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-emerald-400 shrink-0">✓</span>
                                <span>{n}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wider text-rose-400/90 mb-3">
                            Top 3 weaknesses
                          </div>
                          <ul className="space-y-2 text-sm text-zinc-200">
                            {scan.weaknesses.map((w, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-rose-400 shrink-0">!</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="h-px bg-zinc-700/80 my-6" aria-hidden="true" />

                  <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-base font-semibold">Core Skills Match</div>
                      <div className="text-sm text-zinc-400">
                        Skill Coverage: {report.coverage}%
                      </div>
                    </div>
                    <div className="space-y-3">
                      {report.skills.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-4 py-2"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {s.status === "hit" ? (
                              <span className="text-emerald-400 text-lg flex-shrink-0">✓</span>
                            ) : (
                              <span className="text-rose-400 text-lg flex-shrink-0">✕</span>
                            )}
                            <span className="text-sm text-zinc-200">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  s.status === "hit" ? "bg-emerald-500" : "bg-amber-500/60"
                                )}
                                style={{
                                  width: s.status === "hit" ? "100%" : "30%",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {report.missingSignals.length > 0 && (
                    <div className="h-px bg-zinc-700/80 my-6" aria-hidden="true" />
                  )}

                  <MissingSignals
                    signals={report.missingSignals}
                    resumeStrength={resumeStrength}
                  />

                  <div className="h-px bg-zinc-700/80 my-6" aria-hidden="true" />

                  <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-5">
                    <div className="text-base font-semibold mb-3">Recommended Actions</div>
                    <ActionsList actions={report.actions} />
                  </div>

                  {alignmentHistory.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-3">
                        Last 3 analyses
                      </div>
                      {(() => {
                        const slice = alignmentHistory.slice(0, 3).reverse();
                        const values = slice.map((h) => h.alignment);
                        const min = Math.min(0, ...values);
                        const max = Math.max(100, ...values);
                        const range = max - min || 1;
                        const w = 100;
                        const h = 40;
                        const pad = 4;
                        const x = (i: number) =>
                          values.length === 1
                            ? w / 2
                            : pad + (i / (values.length - 1)) * (w - 2 * pad);
                        const y = (v: number) =>
                          h - pad - ((v - min) / range) * (h - 2 * pad);
                        const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
                        const last = values[values.length - 1];
                        const first = values[0];
                        const trendUp = last > first;
                        const stroke = trendUp ? "#34d399" : last < first ? "#fb7185" : "#71717a";
                        return (
                          <div className="mb-4 rounded-xl bg-zinc-900/60 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] text-zinc-500">Alignment trend</span>
                              <span className="text-xs text-zinc-400">
                                {first}% → {last}%
                              </span>
                            </div>
                            <svg
                              viewBox={`0 0 ${w} ${h}`}
                              className="w-full h-10 block"
                              preserveAspectRatio="xMidYMid meet"
                            >
                              <polyline
                                fill="none"
                                stroke={stroke}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={points}
                              />
                              {values.map((v, i) => (
                                <circle
                                  key={i}
                                  cx={x(i)}
                                  cy={y(v)}
                                  r="3"
                                  fill={stroke}
                                />
                              ))}
                            </svg>
                          </div>
                        );
                      })()}
                      <div className="space-y-3">
                        {alignmentHistory.slice(0, 3).map((item, idx, arr) => {
                          const prev = arr[idx + 1];
                          const diff = prev != null ? item.alignment - prev.alignment : 0;
                          let arrow = "•";
                          let arrowClass = "text-zinc-500";
                          if (prev != null) {
                            if (item.alignment > prev.alignment) {
                              arrow = "↑";
                              arrowClass = "text-emerald-400";
                            } else if (item.alignment < prev.alignment) {
                              arrow = "↓";
                              arrowClass = "text-rose-400";
                            } else {
                              arrow = "→";
                              arrowClass = "text-zinc-500";
                            }
                          }
                          return (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-900/80 bg-zinc-950/60 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                {prev != null ? (
                                  <>
                                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                                      <span>{prev.alignment}%</span>
                                      <span className="text-zinc-500">→</span>
                                      <span>{item.alignment}%</span>
                                      <span className={arrowClass}>{arrow}</span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-zinc-500">
                                      Previous: {prev.alignment}% · Now: {item.alignment}% ·
                                      Improvement: {diff >= 0 ? "+" : ""}
                                      {diff}%
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm font-medium text-zinc-200">
                                    {item.alignment}% alignment
                                  </div>
                                )}
                              </div>
                              <span className="shrink-0 text-[11px] text-zinc-500">
                                {new Date(item.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </section>

          {/* Right - JD + Tracker */}
          <section className="lg:col-span-1 space-y-6">
            <JobDescriptionBox
              jd={jd}
              onJdChange={setJd}
              onAnalyze={onAnalyze}
              canAnalyze={canAnalyze}
              loading={loading}
              analyzeError={analyzeError}
              onRetry={onAnalyze}
            />

            <div className="rounded-3xl border border-zinc-900 bg-zinc-950/40 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Job Alignment</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Quick summary from the job description.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Detected skills</div>
                  <div className="text-lg font-semibold">
                    {report?.skills?.length ?? 0}
                  </div>
                </div>
              </div>
              {report && getRoleDifficulty(report, jd) && (
                <div className="mt-4">
                  {(() => {
                    const difficulty = getRoleDifficulty(report, jd);
                    if (!difficulty) return null;
                    const config = {
                      "Entry-level": {
                        dot: "🟢",
                        label: "Entry-level",
                        className: "border-emerald-500/50 bg-emerald-950/30 text-emerald-200",
                      },
                      Competitive: {
                        dot: "🟡",
                        label: "Competitive",
                        className: "border-amber-500/50 bg-amber-950/30 text-amber-200",
                      },
                      "Highly competitive": {
                        dot: "🔴",
                        label: "Highly competitive",
                        className: "border-rose-500/50 bg-rose-950/30 text-rose-200",
                      },
                    } as const;
                    const c = config[difficulty];
                    return (
                      <>
                        <div
                          className={cn(
                            "rounded-xl border px-3 py-2 flex items-center gap-2 w-fit",
                            c.className
                          )}
                        >
                          <span className="text-base leading-none" aria-hidden>
                            {c.dot}
                          </span>
                          <span className="text-sm font-semibold">{c.label}</span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-zinc-500">
                          Based on skills detected, JD complexity, number of requirements
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
              {report && report.skills.length > 0 ? (
                <div className="mt-5">
                  <div className="text-xs font-semibold text-zinc-300 mb-3">
                    Skills detected
                  </div>
                  <SkillPills skills={report.skills} />
                </div>
              ) : (
                <div className="mt-5 text-sm text-zinc-500">
                  Paste a job description and analyze to see detected skills.
                </div>
              )}
            </div>

            {report && (
              <Card>
                <div className="text-base font-semibold">Save to Tracker</div>
                <p className="mt-1 text-xs text-zinc-400">
                  Save this opportunity and track progress.
                </p>
                <div className="mt-4 h-px bg-zinc-900/80" />
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-zinc-500">
                      Company & role
                    </label>
                    <span className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                      {report.alignment}% alignment
                    </span>
                  </div>
                  <input
                    value={tracker.company}
                    onChange={(e) => tracker.setCompany(e.target.value)}
                    placeholder="Company (e.g., Microsoft)"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-700"
                  />
                  {tracker.trackerError && (
                    <div className="text-xs text-red-400">{tracker.trackerError}</div>
                  )}
                  <input
                    value={tracker.role}
                    onChange={(e) => tracker.setRole(e.target.value)}
                    placeholder="Role (e.g., SWE Intern)"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-700"
                  />
                  <div className="pt-1">
                    <label className="text-xs font-medium text-zinc-500">
                      Next step
                    </label>
                    <input
                      value={tracker.nextStep}
                      onChange={(e) => tracker.setNextStep(e.target.value)}
                      placeholder="e.g. Apply today"
                      className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-700"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveToTracker}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm hover:bg-zinc-900 transition-colors"
                    >
                      <Save size={16} />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        tracker.setCompany("");
                        tracker.setRole("");
                        tracker.setNextStep("Apply today");
                        navigate("/tracker");
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-900 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      View Tracker
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </section>
        </div>

        <footer className="mt-10 text-center text-xs text-zinc-600">
          InternOS V1 • Next: smarter extraction + saving to database
        </footer>
      </Container>
    </PageLayout>
  );
}
