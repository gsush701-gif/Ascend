import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "../../../config/api";
import { getApiErrorMessage } from "../../../lib/apiError";
import { emptyResumeStructuredContent } from "../../../types/resume";
import type { ResumeSectionKey, ResumeStructuredContent, ResumeSuggestion } from "../../../types/resume";
import { applySuggestionToContent } from "../applySuggestion";

type SuggestionRow = {
  id: string;
  resume_id: string;
  section: ResumeSectionKey;
  original_text: string | null;
  proposed_text: string;
  reason: string;
  status: ResumeSuggestion["status"];
  created_at: string;
  updated_at: string;
};

function rowToSuggestion(row: SuggestionRow): ResumeSuggestion {
  return {
    id: row.id,
    resumeId: row.resume_id,
    section: row.section,
    originalText: row.original_text,
    proposedText: row.proposed_text,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Load/save hook for one resume's `structured_content` plus its pending AI
 * suggestions (supabase/migrations/015_resume_structured_content.sql).
 *
 * Direct-to-Supabase, RLS-protected for every read/write on both
 * `resumes` and `resume_suggestions` — same pattern as useResumes.ts. The
 * only backend calls are the two stateless AI routes (`/api/parse-resume`,
 * `/api/resume-suggestions`); neither persists anything itself (see the
 * comments on those routes in server/index.js) — this hook owns every
 * write, and an AI parse or suggestion is never saved without the caller
 * explicitly choosing to (parsing sets local, unsaved state; accepting a
 * suggestion updates local state and the suggestion's own status, not the
 * resume row — `save()` is a separate, explicit action).
 */
export function useResumeEditor(resumeId: string | undefined) {
  const { user, session } = useAuth();

  const [resumeName, setResumeName] = useState<string | null>(null);
  const [content, setContent] = useState<ResumeStructuredContent | null>(null);
  const [hasStructuredContent, setHasStructuredContent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<ResumeSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const loadResume = useCallback(async () => {
    if (!resumeId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    const { data, error } = await supabase
      .from("resumes")
      .select("id, name, structured_content")
      .eq("id", resumeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[useResumeEditor] load failed:", error);
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const row = data as { id: string; name: string; structured_content: ResumeStructuredContent | null };
    setResumeName(row.name);
    setHasStructuredContent(Boolean(row.structured_content));
    setContent(row.structured_content ?? emptyResumeStructuredContent());
    setDirty(false);
    setLoading(false);
  }, [resumeId, user]);

  const loadSuggestions = useCallback(async () => {
    if (!resumeId || !user) return;
    setSuggestionsLoading(true);
    const { data, error } = await supabase
      .from("resume_suggestions")
      .select("id, resume_id, section, original_text, proposed_text, reason, status, created_at, updated_at")
      .eq("resume_id", resumeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[useResumeEditor] load suggestions failed:", error);
    } else {
      setSuggestions(((data as SuggestionRow[] | null) ?? []).map(rowToSuggestion));
    }
    setSuggestionsLoading(false);
  }, [resumeId, user]);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const updateSection = useCallback(
    <K extends keyof ResumeStructuredContent>(key: K, value: ResumeStructuredContent[K]) => {
      setContent((prev) => (prev ? { ...prev, [key]: value } : prev));
      setDirty(true);
    },
    [],
  );

  const save = useCallback(async (): Promise<{ error: string | null }> => {
    if (!resumeId || !content) return { error: "Nothing to save" };
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from("resumes")
      .update({ structured_content: content, updated_at: new Date().toISOString() })
      .eq("id", resumeId);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return { error: error.message };
    }
    setHasStructuredContent(true);
    setDirty(false);
    return { error: null };
  }, [resumeId, content]);

  const parseResume = useCallback(async (): Promise<{ error: string | null }> => {
    if (!resumeId) return { error: "No resume selected" };
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch(`${API_BASE}/api/parse-resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ resumeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to parse resume"));
      // Never auto-saved: the parsed structure only lands in local editable
      // state here — the user reviews/edits it in the form and must click
      // Save themselves before it touches the database.
      setContent(data as ResumeStructuredContent);
      setDirty(true);
      return { error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to parse resume";
      setParseError(message);
      return { error: message };
    } finally {
      setParsing(false);
    }
  }, [resumeId, session]);

  const generateSuggestions = useCallback(
    async (section?: ResumeSectionKey): Promise<{ error: string | null }> => {
      if (!resumeId) return { error: "No resume selected" };
      setGeneratingSuggestions(true);
      setSuggestionsError(null);
      try {
        const res = await fetch(`${API_BASE}/api/resume-suggestions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ resumeId, ...(section ? { section } : {}) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to generate suggestions"));
        const created = ((data.suggestions as SuggestionRow[] | undefined) ?? []).map(rowToSuggestion);
        setSuggestions((prev) => [...created, ...prev]);
        return { error: null };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to generate suggestions";
        setSuggestionsError(message);
        return { error: message };
      } finally {
        setGeneratingSuggestions(false);
      }
    },
    [resumeId, session],
  );

  const acceptSuggestion = useCallback(
    async (suggestion: ResumeSuggestion, textOverride?: string): Promise<{ error: string | null }> => {
      if (!content) return { error: "No resume content loaded" };
      const nextContent = applySuggestionToContent(content, suggestion, textOverride);
      setContent(nextContent);
      setDirty(true);
      const { error } = await supabase
        .from("resume_suggestions")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", suggestion.id);
      if (error) {
        console.error("[useResumeEditor] accept suggestion failed:", error);
        return { error: error.message };
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      return { error: null };
    },
    [content],
  );

  const rejectSuggestion = useCallback(async (suggestion: ResumeSuggestion): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from("resume_suggestions")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", suggestion.id);
    if (error) {
      console.error("[useResumeEditor] reject suggestion failed:", error);
      return { error: error.message };
    }
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    return { error: null };
  }, []);

  return {
    resumeName,
    content,
    hasStructuredContent,
    loading,
    notFound,
    loadError,
    dirty,
    saving,
    saveError,
    parsing,
    parseError,
    suggestions,
    suggestionsLoading,
    generatingSuggestions,
    suggestionsError,
    updateSection,
    save,
    parseResume,
    generateSuggestions,
    acceptSuggestion,
    rejectSuggestion,
  };
}
