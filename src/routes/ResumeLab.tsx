import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Copy, FileText, Sparkles } from "lucide-react";
import { cn } from "../lib/cn";
import { AppShell } from "../components/layout/AppShell";
import { Textarea } from "../components/ui/Textarea";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { pageHeader, pageTitle, pageSubtitle, card, cardAlt } from "../lib/ui";
import {
  getBulletImprovementDetails,
  type BulletImprovementResult,
} from "../features/analyzer/utils";
import { toast } from "../components/ui/toast";
import { setResumeLabUsed } from "../lib/onboarding";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { extractTextFromPdf } from "../lib/pdf";
import { supabase } from "../lib/supabaseClient";
import { getApiErrorMessage } from "../lib/apiError";
import { ResumesBody } from "./Resumes";

const HISTORY_KEY = "internos_resume_lab_history_v1";
const HISTORY_MAX = 20;

type HistoryEntry = {
  id: string;
  input: string;
  result: BulletImprovementResult;
  createdAt: string;
};

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {}
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}

type ResumeImprovementRow = {
  id: string;
  input: string;
  improved: string;
  why: string | null;
  stack: string | null;
  impact: string | null;
  created_at: string;
};

function rowToHistoryEntry(row: ResumeImprovementRow): HistoryEntry {
  return {
    id: row.id,
    input: row.input,
    result: {
      improved: row.improved,
      why: row.why ?? "",
      stack: row.stack ?? "",
      impact: row.impact ?? "",
    },
    createdAt: row.created_at,
  };
}

type ResumeImproveResult = {
  summary: string;
  topFixes: string[];
  rewrittenBullets: { original: string; improved: string }[];
};

type LinkedInSection = "headline" | "about";

type LinkedInImproveResult = {
  improved: string;
  why: string;
};

export function ResumeLabBody({ embedded = false }: { embedded?: boolean }) {
  const location = useLocation();
  const { session, user } = useAuth();
  const jobDescription = (location.state as { jobDescription?: string } | null)?.jobDescription ?? "";
  const [mode, setMode] = useState<"bullet" | "resume" | "linkedin">("bullet");

  // Single-bullet mode
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Render's free/starter tier spins the backend down after idle time, so
  // the first request after a while can take up to ~50s to wake it back
  // up. Surface a hint after a few seconds so that looks like "waking up",
  // not "broken".
  const [slowRequest, setSlowRequest] = useState(false);
  const [result, setResult] = useState<BulletImprovementResult | null>(null);
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  // Logged-in users see their history from the `resume_improvements` table
  // (the backend already persists it there — see server/index.js's
  // /api/improve-bullet handler — but nothing used to read it back).
  // Logged-out users keep the existing localStorage-only behavior, since
  // there's no account to attach DB rows to.
  const [history, setHistory] = useState<HistoryEntry[]>(() => (user ? [] : loadHistory()));
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showEmptyError, setShowEmptyError] = useState(false);
  const [jobContextExpanded, setJobContextExpanded] = useState(true);
  const mounted = useRef(true);

  // Full-resume mode
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeSlowRequest, setResumeSlowRequest] = useState(false);
  const [resumeResult, setResumeResult] = useState<ResumeImproveResult | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // LinkedIn profile mode
  const [linkedinSection, setLinkedinSection] = useState<LinkedInSection>("headline");
  const [linkedinInput, setLinkedinInput] = useState("");
  const [linkedinTargetRole, setLinkedinTargetRole] = useState("");
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinSlowRequest, setLinkedinSlowRequest] = useState(false);
  const [linkedinResult, setLinkedinResult] = useState<LinkedInImproveResult | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [linkedinShowEmptyError, setLinkedinShowEmptyError] = useState(false);
  const [linkedinCopyLabel, setLinkedinCopyLabel] = useState<"Copy" | "Copied!">("Copy");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory(loadHistory());
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    supabase
      .from("resume_improvements")
      .select("id, input, improved, why, stack, impact, created_at")
      .order("created_at", { ascending: false })
      .limit(HISTORY_MAX)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[ResumeLab] failed to load history:", error);
          // Fall back to whatever local history exists rather than showing
          // nothing on a transient network/DB error.
          setHistory(loadHistory());
        } else {
          setHistory(((data as ResumeImprovementRow[] | null) ?? []).map(rowToHistoryEntry));
        }
        setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const runImprove = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setShowEmptyError(true);
      toast.error("Paste a bullet to improve");
      return;
    }
    setShowEmptyError(false);
    setLoading(true);
    setSlowRequest(false);
    setResult(null);
    const slowTimer = setTimeout(() => setSlowRequest(true), 6000);

    let details: BulletImprovementResult;
    try {
      const res = await fetch(`${API_BASE}/api/improve-bullet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ bullet: trimmed }),
      });
      if (!res.ok) throw new Error("AI request failed");
      details = await res.json();
    } catch (e) {
      console.warn("[ResumeLab] AI improve failed, using offline fallback:", e);
      details = getBulletImprovementDetails(trimmed);
    } finally {
      clearTimeout(slowTimer);
    }

    if (!mounted.current) return;
    setResult(details);
    setLoading(false);
    setSlowRequest(false);
    setResumeLabUsed();

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      input: trimmed,
      result: details,
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, HISTORY_MAX);
      // Logged-in: the backend already persisted this call to
      // `resume_improvements` (fire-and-forget, see /api/improve-bullet).
      // This is just an optimistic local prepend for instant feedback —
      // a refresh re-reads the real list from the DB. Logged-out: this
      // localStorage copy IS the only record, so persist it.
      if (!user) saveHistory(next);
      return next;
    });
  }, [input, session, user]);

  const runImproveResume = useCallback(async () => {
    if (!resumeFile) {
      toast.error("Choose a PDF resume first");
      return;
    }
    setResumeError(null);
    setResumeResult(null);
    setResumeLoading(true);
    setResumeSlowRequest(false);
    const slowTimer = setTimeout(() => setResumeSlowRequest(true), 6000);
    try {
      const text = await extractTextFromPdf(resumeFile);
      if (text.trim().length < 30) {
        throw new Error("Could not extract enough text from this PDF. Try a text-based (not scanned) PDF.");
      }
      const res = await fetch(`${API_BASE}/api/improve-resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          resumeText: text,
          jobDescription: jobDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));
      setResumeResult(data);
      setResumeLabUsed();
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : "Failed to improve resume");
    } finally {
      clearTimeout(slowTimer);
      if (mounted.current) {
        setResumeLoading(false);
        setResumeSlowRequest(false);
      }
    }
  }, [resumeFile, jobDescription, session]);

  const runImproveLinkedIn = useCallback(async () => {
    const trimmed = linkedinInput.trim();
    if (!trimmed) {
      setLinkedinShowEmptyError(true);
      toast.error(`Paste your ${linkedinSection === "headline" ? "headline" : "About section"} to improve`);
      return;
    }
    setLinkedinShowEmptyError(false);
    setLinkedinError(null);
    setLinkedinLoading(true);
    setLinkedinSlowRequest(false);
    setLinkedinResult(null);
    const slowTimer = setTimeout(() => setLinkedinSlowRequest(true), 6000);

    try {
      const res = await fetch(`${API_BASE}/api/improve-linkedin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          text: trimmed,
          section: linkedinSection,
          targetRole: linkedinTargetRole.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));
      if (!mounted.current) return;
      setLinkedinResult(data);
      setResumeLabUsed();
    } catch (e) {
      if (!mounted.current) return;
      setLinkedinError(e instanceof Error ? e.message : "Failed to improve LinkedIn section");
    } finally {
      clearTimeout(slowTimer);
      if (mounted.current) {
        setLinkedinLoading(false);
        setLinkedinSlowRequest(false);
      }
    }
  }, [linkedinInput, linkedinSection, linkedinTargetRole, session]);

  const handleCopyLinkedin = useCallback(() => {
    if (!linkedinResult?.improved) return;
    navigator.clipboard.writeText(linkedinResult.improved).then(() => {
      setLinkedinCopyLabel("Copied!");
      setTimeout(() => setLinkedinCopyLabel("Copy"), 2000);
    });
  }, [linkedinResult]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    if (user) {
      supabase
        .from("resume_improvements")
        .delete()
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) console.error("[ResumeLab] failed to clear history:", error);
        });
    } else {
      clearHistory();
    }
  }, [user]);

  const handleCopy = useCallback(() => {
    if (!result?.improved) return;
    navigator.clipboard.writeText(result.improved).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  }, [result]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
        {/* Hero — hidden when embedded in the Resume Lab workspace (it has its own header) */}
        {!embedded && (
          <section className="text-center">
            <h1 className={pageTitle}>
              Upgrade your resume impact
            </h1>
            <p className={cn(pageSubtitle, "mt-2")}>
              AI-powered rewriting — improve one bullet or get a full critique of
              an uploaded resume.
            </p>
          </section>
        )}

        {/* Mode toggle */}
        <section className="flex justify-center">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-900/[0.04] p-1">
            <button
              type="button"
              onClick={() => setMode("bullet")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition",
                mode === "bullet" ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Single bullet
            </button>
            <button
              type="button"
              onClick={() => setMode("resume")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition",
                mode === "resume" ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Full resume (PDF)
            </button>
            <button
              type="button"
              onClick={() => setMode("linkedin")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition",
                mode === "linkedin" ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              LinkedIn profile
            </button>
          </div>
        </section>

        {mode === "bullet" ? (
          <>
            {/* Job context (prefilled from Analyzer) */}
            {jobDescription.trim() && (
              <section className={cn(card, "overflow-hidden")}>
                <button
                  type="button"
                  onClick={() => setJobContextExpanded((p) => !p)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-900/[0.04] transition"
                >
                  Job context (use when tailoring bullets)
                  {jobContextExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {jobContextExpanded && (
                  <div className="border-t border-slate-200 px-4 py-3 max-h-40 overflow-y-auto">
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{jobDescription.slice(0, 2000)}{jobDescription.length > 2000 ? "…" : ""}</p>
                  </div>
                )}
              </section>
            )}

            {/* Large search-style input */}
            <section className="space-y-4">
              <div
                className={cn(
                  "rounded-xl border px-4 py-3 focus-within:ring-1",
                  showEmptyError
                    ? "border-red-400/50 bg-red-500/5 focus-within:border-red-400/50 focus-within:ring-red-400/20"
                    : "border-slate-200 bg-slate-900/[0.04] focus-within:border-slate-300 focus-within:ring-slate-200"
                )}
              >
                <Textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setShowEmptyError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      runImprove();
                    }
                  }}
                  placeholder="Paste a resume bullet to improve it..."
                  rows={3}
                  className="min-h-0 resize-none border-0 bg-transparent p-0 focus:ring-0"
                />
              </div>
              {showEmptyError && (
                <p className="text-sm text-red-600">Paste a bullet to improve.</p>
              )}
              {!input.trim() && !showEmptyError && (
                <div className={cn(cardAlt, "p-4")}>
                  <p className="text-sm text-slate-600">
                    We&apos;ll add metrics, clarity, and technical depth.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Example bullets:</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-slate-500">
                    <li>• Built REST API for user authentication</li>
                    <li>• Implemented unit tests with Jest</li>
                  </ul>
                </div>
              )}
              <Button
                type="button"
                onClick={runImprove}
                disabled={loading}
                className="w-full"
                variant="primary"
              >
                {loading ? (
                  <>
                    <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                    Optimizing…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Improve
                  </>
                )}
              </Button>
              {loading && slowRequest && (
                <p className="text-xs text-slate-500">
                  Still working — the server may be waking up from idle, this can take up to a minute.
                </p>
              )}
            </section>

            {/* Output */}
            {result && !loading && (
              <section className={cn("animate-fade-in space-y-6", card)}>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Improved version
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-800">
                    &ldquo;{result.improved}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                  >
                    <Copy size={14} />
                    {copyLabel}
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Why it’s better
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">{result.why}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Stack detected
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">{result.stack}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Impact metric suggestion
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">{result.impact}</p>
                  </div>
                </div>
              </section>
            )}

            {/* History */}
            {historyLoading && history.length === 0 && (
              <p className="text-xs text-slate-400">Loading your improvement history…</p>
            )}
            {history.length > 0 && (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-700">
                    Recent improvements
                  </h2>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 transition"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="mt-3 space-y-2">
                  {history.slice(0, 8).map((entry) => (
                  <li
                    key={entry.id}
                    className={cn(cardAlt, "px-4 py-3 text-sm")}
                  >
                      <p className="text-slate-500 line-clamp-1">&ldquo;{entry.input}&rdquo;</p>
                      <p className="mt-1.5 text-slate-800 line-clamp-1">
                        → {entry.result.improved}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : mode === "resume" ? (
          <>
            {/* Full resume upload */}
            <section className={cn(card, "space-y-4")}>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Upload resume PDF
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  We&apos;ll extract the text in your browser and send it to the AI for a
                  full critique — nothing is uploaded until you click Improve.
                </p>
              </div>
              <label className="block cursor-pointer">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm hover:bg-slate-900/[0.06] transition">
                  <div className="flex items-center gap-2 text-slate-700">
                    <FileText size={16} />
                    <span>{resumeFile ? resumeFile.name : "Choose PDF"}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Max 5MB</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      setResumeFile(e.target.files?.[0] || null);
                      setResumeResult(null);
                      setResumeError(null);
                    }}
                  />
                </div>
              </label>
              {jobDescription.trim() && (
                <p className="text-xs text-slate-500">
                  Job context from Analyzer will be used to tailor suggestions.
                </p>
              )}
              {resumeError && (
                <p className="text-sm text-red-600">{resumeError}</p>
              )}
              <Button
                type="button"
                onClick={runImproveResume}
                disabled={resumeLoading || !resumeFile}
                className="w-full"
                variant="primary"
              >
                {resumeLoading ? (
                  <>
                    <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                    Analyzing resume…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Improve full resume
                  </>
                )}
              </Button>
              {resumeLoading && resumeSlowRequest && (
                <p className="text-xs text-slate-500">
                  Still working — the server may be waking up from idle, this can take up to a minute.
                </p>
              )}
            </section>

            {resumeResult && !resumeLoading && (
              <section className={cn("animate-fade-in space-y-6", card)}>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Summary
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-800">{resumeResult.summary}</p>
                </div>

                {resumeResult.topFixes?.length > 0 && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Top fixes
                    </div>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                      {resumeResult.topFixes.map((fix, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-slate-400">{i + 1}.</span>
                          <span>{fix}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {resumeResult.rewrittenBullets?.length > 0 && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Rewritten bullets
                    </div>
                    <ul className="mt-2 space-y-3">
                      {resumeResult.rewrittenBullets.map((b, i) => (
                        <li key={i} className={cn(cardAlt, "p-3")}>
                          <p className="text-xs text-slate-500 line-clamp-2">&ldquo;{b.original}&rdquo;</p>
                          <p className="mt-1.5 text-sm text-slate-800">→ {b.improved}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            {/* LinkedIn section toggle */}
            <section className="flex justify-center">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-900/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLinkedinSection("headline");
                    setLinkedinResult(null);
                    setLinkedinError(null);
                  }}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition",
                    linkedinSection === "headline"
                      ? "bg-white text-black shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Headline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkedinSection("about");
                    setLinkedinResult(null);
                    setLinkedinError(null);
                  }}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition",
                    linkedinSection === "about"
                      ? "bg-white text-black shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  About section
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div
                className={cn(
                  "rounded-xl border px-4 py-3 focus-within:ring-1",
                  linkedinShowEmptyError
                    ? "border-red-400/50 bg-red-500/5 focus-within:border-red-400/50 focus-within:ring-red-400/20"
                    : "border-slate-200 bg-slate-900/[0.04] focus-within:border-slate-300 focus-within:ring-slate-200"
                )}
              >
                <Textarea
                  value={linkedinInput}
                  onChange={(e) => {
                    setLinkedinInput(e.target.value);
                    setLinkedinShowEmptyError(false);
                  }}
                  placeholder={
                    linkedinSection === "headline"
                      ? "Paste your current LinkedIn headline..."
                      : "Paste your current LinkedIn About section..."
                  }
                  rows={linkedinSection === "headline" ? 2 : 6}
                  className="min-h-0 resize-none border-0 bg-transparent p-0 focus:ring-0"
                />
              </div>
              {linkedinShowEmptyError && (
                <p className="text-sm text-red-600">
                  Paste your {linkedinSection === "headline" ? "headline" : "About section"} to improve.
                </p>
              )}
              {!linkedinInput.trim() && !linkedinShowEmptyError && (
                <div className={cn(cardAlt, "p-4")}>
                  <p className="text-sm text-slate-600">
                    {linkedinSection === "headline"
                      ? "We'll make it punchy, keyword-rich, and under LinkedIn's headline limit."
                      : "We'll turn it into a fuller narrative that sounds like you, not a template."}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Target role (optional)
                </label>
                <Input
                  value={linkedinTargetRole}
                  onChange={(e) => setLinkedinTargetRole(e.target.value)}
                  placeholder="e.g. Backend Engineer"
                />
              </div>

              {linkedinError && (
                <p className="text-sm text-red-600">{linkedinError}</p>
              )}

              <Button
                type="button"
                onClick={runImproveLinkedIn}
                disabled={linkedinLoading}
                className="w-full"
                variant="primary"
              >
                {linkedinLoading ? (
                  <>
                    <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                    Optimizing…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Improve
                  </>
                )}
              </Button>
              {linkedinLoading && linkedinSlowRequest && (
                <p className="text-xs text-slate-500">
                  Still working — the server may be waking up from idle, this can take up to a minute.
                </p>
              )}
            </section>

            {/* Output */}
            {linkedinResult && !linkedinLoading && (
              <section className={cn("animate-fade-in space-y-6", card)}>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Improved {linkedinSection === "headline" ? "headline" : "About section"}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {linkedinSection === "headline" ? `“${linkedinResult.improved}”` : linkedinResult.improved}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyLinkedin}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                  >
                    <Copy size={14} />
                    {linkedinCopyLabel}
                  </button>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Why it’s better
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600">{linkedinResult.why}</p>
                </div>
              </section>
            )}
          </>
        )}
    </div>
  );
}

/**
 * Combined "Resume Lab" workspace — the single top-nav entry point. Merges the
 * former /resumes page (saved resumes + analysis history) and the former
 * /resume-lab AI tools into one page via a tab switch, reusing both existing
 * bodies unchanged. Opens on the AI Improve tab when arrived at from the
 * Analyzer / a role (which pass a jobDescription in navigation state).
 */
export function ResumeLab() {
  const location = useLocation();
  const fromJob = Boolean(
    (location.state as { jobDescription?: string } | null)?.jobDescription
  );
  const [tab, setTab] = useState<"resumes" | "improve">(
    fromJob ? "improve" : "resumes"
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Resume Lab</h1>
            <p className={pageSubtitle}>
              Manage your saved resumes and analysis history, and sharpen your
              wording with AI.
            </p>
          </div>
          <Link
            to="/analyzer"
            className="shrink-0 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
          >
            Go to Analyzer →
          </Link>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-900/[0.04] p-1">
          <button
            type="button"
            onClick={() => setTab("resumes")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition",
              tab === "resumes"
                ? "bg-white text-black shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            My Resumes
          </button>
          <button
            type="button"
            onClick={() => setTab("improve")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition",
              tab === "improve"
                ? "bg-white text-black shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            AI Improve
          </button>
        </div>

        {tab === "resumes" ? (
          <ResumesBody embedded />
        ) : (
          <ResumeLabBody embedded />
        )}
      </div>
    </AppShell>
  );
}
