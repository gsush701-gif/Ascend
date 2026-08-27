import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import { API_BASE } from "../../../config/api";
import { useAuth } from "../../../context/AuthContext";
import { getApiErrorMessage } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { cardAlt } from "../../../lib/ui";

type AtsBreakdown = {
  keywordMatch: number;
  formatting: number;
  experienceRelevance: number;
  skillsMatch: number;
};

type AtsKeywords = {
  matched: string[];
  missing: string[];
  coveragePercent: number;
};

type AtsStructure = {
  hasContactInfo: boolean;
  hasSummary: boolean;
  hasExperience: boolean;
  hasEducation: boolean;
  hasSkillsSection: boolean;
  issues: string[];
};

type AtsWeakBullet = { text: string; reason: string };

type AtsContent = {
  weakBullets: AtsWeakBullet[];
  genericStatements: string[];
  repeatedPhrases: string[];
};

export type AtsCheckResult = {
  overallScore: number;
  breakdown: AtsBreakdown;
  keywords: AtsKeywords;
  structure: AtsStructure;
  content: AtsContent;
};

type AtsCheckerProps = {
  /** Already-extracted resume text (same value /analyze's own report was built from). */
  resumeText: string;
  /** Job description text, if any — keyword/skills matching is skipped gracefully without one. */
  jobDescriptionText: string;
};

function scoreTone(score: number) {
  if (score >= 80) return "text-cyan-600";
  if (score >= 60) return "text-amber-600/90";
  return "text-rose-600";
}

/**
 * Dedicated, deeper ATS compatibility check — a separate, explicit,
 * user-triggered action (not run automatically alongside /analyze) since
 * it's its own metered feature (`ai.ats_check` in server/lib/plans.js), not
 * a free side effect of every analysis.
 *
 * This surfaces Ascend's own deterministic compatibility analysis
 * (server/lib/scoring.js's computeDetailedAtsAnalysis) — explicitly not a
 * claim to reproduce any specific real-world ATS's parsing behavior, since
 * there's no single standard algorithm every real ATS follows the same way.
 */
export function AtsChecker({ resumeText, jobDescriptionText }: AtsCheckerProps) {
  const { session } = useAuth();
  const [result, setResult] = useState<AtsCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ats-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ resumeText, jobDescriptionText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to run ATS check"));
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run ATS check");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn(cardAlt, "p-4")}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <ClipboardCheck className="h-3.5 w-3.5" />
          ATS compatibility check
        </h3>
        {result && !loading && (
          <button
            type="button"
            onClick={runCheck}
            className="text-xs font-medium text-cyan-700 hover:text-cyan-800"
          >
            Re-check
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Ascend&apos;s own compatibility analysis — not a simulation of any specific real-world
        ATS, since every real ATS parses resumes a little differently.
      </p>

      {!result && (
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="btn-press inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
          {loading ? "Running ATS check…" : "Run detailed ATS check"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {result && (
        <div className="animate-fade-in space-y-4">
          <div className="rounded-lg border border-slate-200 bg-[#FFFFFF] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Overall ATS score
              </span>
              <span className={cn("text-lg font-semibold", scoreTone(result.overallScore))}>
                {result.overallScore}%
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Keyword match", value: result.breakdown.keywordMatch },
                { label: "Formatting", value: result.breakdown.formatting },
                { label: "Experience relevance", value: result.breakdown.experienceRelevance },
                { label: "Skills match", value: result.breakdown.skillsMatch },
              ].map((c) => (
                <div key={c.label} className="text-center">
                  <div className={cn("text-base font-semibold", scoreTone(c.value))}>{c.value}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          {(result.keywords.matched.length > 0 || result.keywords.missing.length > 0) && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Keywords ({result.keywords.coveragePercent}% coverage)
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.keywords.matched.map((k) => (
                  <span
                    key={`m-${k}`}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-700"
                  >
                    <CheckCircle2 className="h-3 w-3" /> {k}
                  </span>
                ))}
                {result.keywords.missing.map((k) => (
                  <span
                    key={`x-${k}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-900/[0.04] px-2 py-0.5 text-[11px] text-slate-500"
                  >
                    <XCircle className="h-3 w-3" /> {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.structure.issues.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Structure issues
              </h4>
              <ul className="space-y-1">
                {result.structure.issues.map((issue) => (
                  <li key={issue} className="text-sm text-slate-700">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(result.content.weakBullets.length > 0 ||
            result.content.genericStatements.length > 0 ||
            result.content.repeatedPhrases.length > 0) && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Content quality
              </h4>
              {result.content.weakBullets.slice(0, 6).map((b, i) => (
                <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                  <p className="text-xs text-slate-700">&ldquo;{b.text}&rdquo;</p>
                  <p className="mt-0.5 text-[11px] text-amber-700">{b.reason}</p>
                </div>
              ))}
              {result.content.genericStatements.length > 0 && (
                <p className="text-xs text-slate-500">
                  Generic phrasing: {result.content.genericStatements.join("; ")}
                </p>
              )}
              {result.content.repeatedPhrases.length > 0 && (
                <p className="text-xs text-slate-500">
                  Repeated phrases: {result.content.repeatedPhrases.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
