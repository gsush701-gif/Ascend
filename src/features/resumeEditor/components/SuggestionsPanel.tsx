import { useState } from "react";
import { Check, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { Panel } from "../../../components/ui/Panel";
import { Textarea } from "../../../components/ui/Textarea";
import { Button } from "../../../components/ui/Button";
import { badge, cardAlt } from "../../../lib/ui";
import { cn } from "../../../lib/cn";
import { RESUME_SECTION_LABELS } from "../../../types/resume";
import type { ResumeSuggestion } from "../../../types/resume";

type SuggestionsPanelProps = {
  suggestions: ResumeSuggestion[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onAccept: (suggestion: ResumeSuggestion, textOverride?: string) => void;
  onReject: (suggestion: ResumeSuggestion) => void;
};

function SuggestionRow({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: ResumeSuggestion;
  onAccept: (suggestion: ResumeSuggestion, textOverride?: string) => void;
  onReject: (suggestion: ResumeSuggestion) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(suggestion.proposedText);

  return (
    <li className={cn(cardAlt, "space-y-2 p-4")}>
      <span className={badge}>{RESUME_SECTION_LABELS[suggestion.section]}</span>

      {suggestion.originalText && <p className="text-xs text-slate-400 line-through">{suggestion.originalText}</p>}

      {editing ? (
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
      ) : (
        <p className="text-sm text-slate-800">{suggestion.proposedText}</p>
      )}

      <p className="text-xs text-slate-500">{suggestion.reason}</p>

      <div className="flex flex-wrap gap-2 pt-1">
        {editing ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onAccept(suggestion, draft);
                setEditing(false);
              }}
            >
              <Check className="h-3.5 w-3.5" /> Apply edited
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(suggestion.proposedText);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="primary" size="sm" onClick={() => onAccept(suggestion)}>
              <Check className="h-3.5 w-3.5" /> Accept
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onReject(suggestion)}>
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Pending `resume_suggestions` for one resume (Phase 7, Resume Editor Task
 * 1) — never applies anything automatically. Accepting hands the (possibly
 * user-edited) proposed text back up to the caller, which applies it into
 * the resume's editable structured content (see
 * useResumeEditor.acceptSuggestion / applySuggestionToContent) — the
 * suggestion row itself is only ever marked accepted/rejected here, never
 * deleted, so it stays auditable.
 */
export function SuggestionsPanel({
  suggestions,
  loading,
  generating,
  error,
  onGenerate,
  onAccept,
  onReject,
}: SuggestionsPanelProps) {
  return (
    <Panel
      title="AI suggestions"
      subtitle="Grounded only in what's already on this resume — review before applying."
      right={
        <Button type="button" variant="secondary" size="sm" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? "Generating…" : "Generate suggestions"}
        </Button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-slate-400">
          No pending suggestions. Click &quot;Generate suggestions&quot; for AI-drafted edits to review.
        </p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} onAccept={onAccept} onReject={onReject} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
