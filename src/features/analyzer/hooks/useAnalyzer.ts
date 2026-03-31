import { useEffect, useMemo, useState } from "react";
import { extractTextFromPdf } from "../../../lib/pdf";
import { HISTORY_KEY, LAST_RESUME_KEY } from "../../../types/analyzer";
import type {
  Report,
  ResumeStrength,
  AlignmentHistoryItem,
} from "../../../types/analyzer";
import { setStoredSharePayload } from "../../../lib/shareProfile";
import { computeResumeStrength } from "../utils";
import {
  parseJdRequirements,
  type ParsedJdRequirements,
} from "../../../lib/parseJd";
import { API_BASE } from "../../../config/api";

const API_URL = `${API_BASE}/analyze`;
const JD_MIN_LENGTH = 20;

export function useAnalyzer() {
  const [resume, setResume] = useState<File | null>(null);
  const [resumeStrength, setResumeStrength] = useState<ResumeStrength | null>(
    null,
  );
  const [resumeStrengthLoading, setResumeStrengthLoading] = useState(false);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [parsedJdData, setParsedJdData] = useState<ParsedJdRequirements | null>(
    null,
  );
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [recruiterSimMode, setRecruiterSimMode] = useState(false);
  const [alignmentHistory, setAlignmentHistory] = useState<
    AlignmentHistoryItem[]
  >([]);
  const [shareSlug, setShareSlug] = useState("");
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setAlignmentHistory(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(alignmentHistory));
    } catch {}
  }, [alignmentHistory]);

  useEffect(() => {
    if (!report) return;
    setStoredSharePayload({
      skills: report.skills.slice(0, 12).map((s) => s.name),
      strength: resumeStrength?.score ?? 0,
      history: alignmentHistory.slice(0, 10).map((h) => ({
        alignment: h.alignment,
        createdAt: h.createdAt,
      })),
    });
  }, [report, resumeStrength?.score, alignmentHistory]);

  useEffect(() => {
    if (resume?.name) {
      try {
        localStorage.setItem(LAST_RESUME_KEY, resume.name);
      } catch {}
    }
  }, [resume?.name]);

  useEffect(() => {
    if (!resume) {
      setResumeStrength(null);
      setResumeStrengthLoading(false);
      return;
    }
    let cancelled = false;
    setResumeStrengthLoading(true);
    setResumeStrength(null);
    extractTextFromPdf(resume)
      .then((text) => {
        if (cancelled) return;
        setResumeStrength(computeResumeStrength(text));
      })
      .catch(() => {
        if (!cancelled) setResumeStrength(null);
      })
      .finally(() => {
        if (!cancelled) setResumeStrengthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resume]);

  const hasValidJd = jd.trim().length >= JD_MIN_LENGTH;
  const canAnalyzeJdOnly = hasValidJd && !loading;
  const canAnalyze = useMemo(
    () => !!resume && hasValidJd && !loading,
    [resume, jd, loading],
  );

  /** JD-only: parse locally, no backend. */
  function onAnalyzeJdOnly() {
    if (!hasValidJd) return;
    setAnalyzeError(null);
    setReport(null);
    setParsedJdData(parseJdRequirements(jd.trim()));
  }

  async function onAnalyze() {
    if (!resume || !hasValidJd) return;

    setLoading(true);
    setReport(null);
    setParsedJdData(null);
    setAnalyzeError(null);

    try {
      const fd = new FormData();
      fd.append("resume", resume);
      fd.append("jd", jd);

      const res = await fetch(API_URL, { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setAnalyzeError(data?.error || "Analyze failed. Please try again.");
        return;
      }
      setReport(data);
      setAlignmentHistory((prev) => {
        const next: AlignmentHistoryItem[] = [
          {
            id: crypto.randomUUID(),
            alignment: data.alignment ?? 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
        return next.slice(0, 20);
      });
    } catch {
      setAnalyzeError(
        `Could not reach backend. Is server running on ${API_BASE}?`,
      );
    } finally {
      setLoading(false);
    }
  }

  function generateShareLink() {
    const slug = shareSlug.trim() || "profile";
    const payload = {
      skills: (report?.skills ?? []).slice(0, 12).map((s) => s.name),
      strength: resumeStrength?.score ?? 0,
      history: (alignmentHistory ?? []).slice(0, 10).map((h) => ({
        alignment: h.alignment,
        createdAt: h.createdAt,
      })),
    };
    const url = `${window.location.origin}/${slug}?d=${btoa(JSON.stringify(payload))}`;
    window.navigator.clipboard.writeText(url).then(() => {
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    });
  }

  const lastResumeFilename =
    resume?.name ??
    (typeof window !== "undefined"
      ? localStorage.getItem(LAST_RESUME_KEY)
      : null);

  return {
    resume,
    setResume,
    lastResumeFilename,
    resumeStrength,
    resumeStrengthLoading,
    jd,
    setJd,
    loading,
    report,
    parsedJdData,
    setParsedJdData,
    analyzeError,
    canAnalyze,
    canAnalyzeJdOnly,
    hasValidJd,
    onAnalyze,
    onAnalyzeJdOnly,
    recruiterSimMode,
    setRecruiterSimMode,
    alignmentHistory,
    shareSlug,
    setShareSlug,
    shareLinkCopied,
    generateShareLink,
  };
}
