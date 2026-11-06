import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { ResumeDropzone } from "../features/analyzer/components/ResumeDropzone";
import { useAnalyzer } from "../features/analyzer/hooks/useAnalyzer";
import {
  EXAMPLE_JOB_DESCRIPTION,
  EXAMPLE_RESUME_NAME,
  EXAMPLE_RESUME_URL,
} from "../features/analyzer/exampleData";
import { FeedbackButton } from "../components/feedback/FeedbackButton";
import { getVisitorId, logEvent } from "../lib/analytics";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";

function fitLabel(pct: number) {
  if (pct >= 80) return "Strong fit";
  if (pct >= 60) return "Good fit";
  if (pct >= 40) return "Medium fit";
  return "Low fit";
}

/**
 * Logged-out try-out of the analyzer. The server's /analyze already accepts
 * anonymous requests (tighter per-IP limit plus a shared daily budget) and only
 * saves an analysis for a signed-in user, so nothing here is stored.
 */
export function Try() {
  const a = useAnalyzer();
  const { setResume, setJd } = a;
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingExample, setLoadingExample] = useState(false);
  const [exampleError, setExampleError] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const exampleRequested = useRef(false);

  useEffect(() => {
    document.title = "Try Ascend, no account needed";
    logEvent("try_viewed", { vid: getVisitorId() });
    return () => {
      document.title = "Ascend";
    };
  }, []);

  async function loadExample() {
    setLoadingExample(true);
    setExampleError(false);
    try {
      const res = await fetch(EXAMPLE_RESUME_URL);
      if (!res.ok) throw new Error("example resume not found");
      const blob = await res.blob();
      setResume(new File([blob], EXAMPLE_RESUME_NAME, { type: "application/pdf" }), "example");
      setJd(EXAMPLE_JOB_DESCRIPTION);
    } catch {
      setExampleError(true);
    } finally {
      setLoadingExample(false);
    }
  }

  // Arriving from "See it on an example" (?example=1): load the sample so the
  // visitor only has to press Analyze.
  useEffect(() => {
    if (searchParams.get("example") !== "1" || exampleRequested.current) return;
    exampleRequested.current = true;
    const params = new URLSearchParams(searchParams);
    params.delete("example");
    setSearchParams(params, { replace: true });
    void loadExample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { report } = a;
  // The result renders below the form, which on a phone is off screen.
  const usingExample = a.resume?.name === EXAMPLE_RESUME_NAME;
  useEffect(() => {
    if (!report) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    logEvent("try_analysis_completed", { vid: getVisitorId(), example: usingExample });
    // Only when a new report arrives; usingExample is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);
  const missing = report?.skills.filter((s) => s.status === "miss") ?? [];
  const matched = report?.skills.filter((s) => s.status === "hit") ?? [];

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl space-y-6 pt-4">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            See your fit score, no account needed
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
            Add your resume and paste an internship posting. You get a fit score, the skills you are missing,
            and what to fix first. We don&apos;t save your resume unless you create an account.
          </p>
        </div>

        <section className={cn(card, "space-y-5 p-6")}>
          {!a.resume && !a.jd.trim() && (
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/[0.05] px-4 py-3 text-sm">
              <div className="font-medium text-slate-800">No resume or posting handy?</div>
              <p className="mt-0.5 text-xs text-slate-500">
                Loads a made-up resume and a sample internship posting. Nothing of yours is uploaded.
              </p>
              <button
                type="button"
                onClick={loadExample}
                disabled={loadingExample}
                className="mt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800 disabled:opacity-50"
              >
                {loadingExample ? "Loading the example…" : "Try an example →"}
              </button>
              {exampleError && (
                <p className="mt-1 text-xs text-red-600">Couldn&apos;t load the example. Check your connection and try again.</p>
              )}
            </div>
          )}

          {usingExample && (
            <p className="rounded-lg bg-slate-900/[0.04] px-3 py-2 text-xs text-slate-600">
              This is a made-up resume and posting. To see your real score, choose your own resume below and paste a
              posting you are applying to.
            </p>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">Your resume (PDF or Word)</label>
            <ResumeDropzone fileName={a.resume ? a.resume.name : null} onFile={(file) => a.setResume(file)} />
          </div>

          <div>
            <label htmlFor="try-jd" className="mb-2 block text-xs font-medium text-slate-500">
              Job description
            </label>
            <textarea
              id="try-jd"
              value={a.jd}
              onChange={(e) => a.setJd(e.target.value)}
              placeholder="Paste the internship posting here..."
              className="min-h-[180px] w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => void a.onAnalyze()}
            disabled={!a.canAnalyze}
          >
            {a.loading ? "Analyzing…" : "See my fit score"}
          </Button>

          {a.loading && a.slowRequest && (
            <p className="text-center text-xs text-slate-500">
              Still working. The first run can take up to a minute while the server wakes up.
            </p>
          )}
          {a.analyzeError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {a.analyzeError}{" "}
              <Link to="/signup" className="font-medium underline">
                Create a free account
              </Link>{" "}
              if it keeps failing.
            </div>
          )}
        </section>

        {report && (
          <section ref={resultsRef} className={cn(card, "space-y-6 p-6 scroll-mt-24")}>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Fit score{report.roleTitle ? `: ${report.roleTitle}` : ""}
              </div>
              <div className="mt-1 flex items-end gap-3">
                <span className="font-display gradient-text text-6xl font-semibold tracking-tight">
                  {Math.round(report.alignment)}%
                </span>
                <span className="pb-2 text-sm text-slate-500">{fitLabel(report.alignment)}</span>
              </div>
            </div>

            {report.aiSummary && <p className="text-sm leading-relaxed text-slate-700">{report.aiSummary}</p>}

            {missing.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500">Skills the posting wants that your resume doesn&apos;t show</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missing.slice(0, 10).map((s) => (
                    <span key={s.name} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {matched.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500">Already on your resume</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {matched.slice(0, 10).map((s) => (
                    <span key={s.name} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {report.actions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500">What to fix first</div>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
                  {report.actions.slice(0, 3).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.05] p-5 text-center">
              <div className="font-display text-lg font-semibold text-slate-900">Keep this and act on it, free</div>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                Create an account to save your results, rewrite weak resume bullets with AI, and track every
                application in one place.
              </p>
              <Link
                to="/signup?next=%2Fanalyzer"
                className="mt-4 inline-block"
                onClick={() => logEvent("try_signup_clicked", { vid: getVisitorId() })}
              >
                <Button variant="primary">Create a free account</Button>
              </Link>
              <p className="mt-2 text-xs text-slate-400">Sign in with Google in seconds. No card needed.</p>
            </div>
          </section>
        )}
      </div>
      <FeedbackButton />
    </PublicShell>
  );
}
