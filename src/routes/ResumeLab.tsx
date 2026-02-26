import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Copy, Sparkles } from "lucide-react";
import { cn } from "../lib/cn";
import { AppShell } from "../components/layout/AppShell";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { pageTitle, pageSubtitle, card, cardAlt } from "../lib/ui";
import {
  getBulletImprovementDetails,
  type BulletImprovementResult,
} from "../features/analyzer/utils";
import { toast } from "../components/ui/toast";
import { setResumeLabUsed } from "../lib/onboarding";

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

export function ResumeLab() {
  const location = useLocation();
  const jobDescription = (location.state as { jobDescription?: string } | null)?.jobDescription ?? "";
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulletImprovementResult | null>(null);
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showEmptyError, setShowEmptyError] = useState(false);
  const [jobContextExpanded, setJobContextExpanded] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    setHistory(loadHistory());
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runImprove = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setShowEmptyError(true);
      toast.error("Paste a bullet to improve");
      return;
    }
    setShowEmptyError(false);
    setLoading(true);
    setResult(null);

    const timer = setTimeout(() => {
      try {
        const details = getBulletImprovementDetails(trimmed);
        if (!mounted.current) return;
        setResult(details);
        setLoading(false);
        setResumeLabUsed();

        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          input: trimmed,
          result: details,
          createdAt: new Date().toISOString(),
        };
        setHistory((prev) => {
          const next = [entry, ...prev];
          saveHistory(next);
          return next;
        });
      } catch (e) {
        if (mounted.current) setLoading(false);
        console.error("[ResumeLab] improve failed:", e);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [input]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    clearHistory();
  }, []);

  const handleCopy = useCallback(() => {
    if (!result?.improved) return;
    navigator.clipboard.writeText(result.improved).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  }, [result]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 pb-12">
        {/* Hero */}
        <section className="text-center">
          <h1 className={pageTitle}>
            Upgrade your resume impact
          </h1>
          <p className={cn(pageSubtitle, "mt-2")}>
            Paste a bullet and we’ll rewrite it with clarity, metrics, and
            technical depth.
          </p>
        </section>

        {/* Job context (prefilled from Analyzer) */}
        {jobDescription.trim() && (
          <section className={cn(card, "overflow-hidden")}>
            <button
              type="button"
              onClick={() => setJobContextExpanded((p) => !p)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/5 transition"
            >
              Job context (use when tailoring bullets)
              {jobContextExpanded ? (
                <ChevronUp className="h-4 w-4 text-white/50" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/50" />
              )}
            </button>
            {jobContextExpanded && (
              <div className="border-t border-white/10 px-4 py-3 max-h-40 overflow-y-auto">
                <p className="text-sm text-white/70 whitespace-pre-wrap">{jobDescription.slice(0, 2000)}{jobDescription.length > 2000 ? "…" : ""}</p>
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
                : "border-white/10 bg-white/5 focus-within:border-white/20 focus-within:ring-white/10"
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
            <p className="text-sm text-red-400">Paste a bullet to improve.</p>
          )}
          {!input.trim() && !showEmptyError && (
            <div className={cn(cardAlt, "p-4")}>
              <p className="text-sm text-white/70">
                We&apos;ll add metrics, clarity, and technical depth.
              </p>
              <p className="mt-2 text-xs text-white/50">Example bullets:</p>
              <ul className="mt-1.5 space-y-1 text-sm text-white/60">
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
                <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-zinc-400 border-t-transparent" />
                Optimizing…
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Improve
              </>
            )}
          </Button>
        </section>

        {/* Output */}
        {result && !loading && (
          <section className={cn("animate-fade-in space-y-6", card)}>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-white/50">
                Improved version
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/90">
                &ldquo;{result.improved}&rdquo;
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
              >
                <Copy size={14} />
                {copyLabel}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Why it’s better
                </div>
                <p className="mt-1.5 text-sm text-white/70">{result.why}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Stack detected
                </div>
                <p className="mt-1.5 text-sm text-white/70">{result.stack}</p>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Impact metric suggestion
                </div>
                <p className="mt-1.5 text-sm text-white/70">{result.impact}</p>
              </div>
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white/80">
                Recent improvements
              </h2>
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs font-medium text-white/50 hover:text-white/90 transition"
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
                  <p className="text-white/60 line-clamp-1">&ldquo;{entry.input}&rdquo;</p>
                  <p className="mt-1.5 text-white/90 line-clamp-1">
                    → {entry.result.improved}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
