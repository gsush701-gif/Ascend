import { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Sparkles } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  getBulletImprovementDetails,
  type BulletImprovementResult,
} from "../features/analyzer/utils";

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

export function ResumeLab() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulletImprovementResult | null>(null);
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
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
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    const timer = setTimeout(() => {
      const details = getBulletImprovementDetails(trimmed);
      if (!mounted.current) return;
      setResult(details);
      setLoading(false);

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
    }, 600);

    return () => clearTimeout(timer);
  }, [input]);

  const handleCopy = useCallback(() => {
    if (!result?.improved) return;
    navigator.clipboard.writeText(result.improved).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  }, [result]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-10 pb-12">
        {/* Hero */}
        <section className="text-center">
          <h1 className="text-2xl font-semibold text-white">
            Upgrade your resume impact
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Paste a bullet and we’ll rewrite it with clarity, metrics, and
            technical depth.
          </p>
        </section>

        {/* Large search-style input */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  runImprove();
                }
              }}
              placeholder="Paste a resume bullet to improve it..."
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={runImprove}
            disabled={!input.trim() || loading}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
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
          </button>
        </section>

        {/* Output */}
        {result && !loading && (
          <section className="animate-fade-in rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
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
            <h2 className="text-sm font-semibold text-white/80">
              Recent improvements
            </h2>
            <ul className="mt-3 space-y-2">
              {history.slice(0, 8).map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
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
