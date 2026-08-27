import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Mic,
  Square,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "../lib/cn";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/apiError";
import { logEvent } from "../lib/analytics";
import { useSpeechRecognition, isSpeechRecognitionSupported } from "../features/voiceInterview/useSpeechRecognition";
import { useVoiceInterviewSessions } from "../features/voiceInterview/hooks/useVoiceInterviewSessions";
import {
  computeSessionProgress,
  isTranscriptSubmittable,
  upsertResponse,
} from "../features/voiceInterview/sessionLogic";
import type { VoiceInterviewQuestion, VoiceInterviewResponse, VoiceInterviewSession } from "../types/voiceInterview";

type FeedbackResult = { feedback: string; strengths: string[]; improvements: string[] };

function CategoryBadge({ category }: { category: string }) {
  const isBehavioral = category === "behavioral";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
        isBehavioral
          ? "border-slate-200 bg-slate-900/[0.04] text-slate-600"
          : "border-cyan-500/50 bg-cyan-500/20 text-cyan-700",
      )}
    >
      {category}
    </span>
  );
}

function FeedbackBlock({ feedback }: { feedback: FeedbackResult }) {
  return (
    <div className="animate-fade-in space-y-4 rounded-xl border border-slate-200 bg-slate-900/[0.04] p-4">
      <p className="text-sm leading-relaxed text-slate-800">{feedback.feedback}</p>
      {feedback.strengths?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Strengths
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {feedback.strengths.map((s, si) => (
              <li key={si}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.improvements?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
            <AlertCircle size={13} className="text-amber-600" />
            Improve
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {feedback.improvements.map((s, si) => (
              <li key={si}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SessionHistoryItem({ session }: { session: VoiceInterviewSession }) {
  const [expanded, setExpanded] = useState(false);
  const progress = computeSessionProgress(session.questions, session.responses);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-dash-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-900/[0.04] transition"
      >
        <div className="text-sm">
          <span className="font-medium text-slate-900">
            {new Date(session.startedAt).toLocaleDateString()}
          </span>
          <span className="ml-2 text-slate-500">
            {progress.answered}/{progress.total} answered
            {session.completedAt ? " · Completed" : " · In progress"}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {expanded && (
        <div className="animate-fade-in space-y-4 border-t border-slate-200 px-4 py-4">
          {session.questions.map((q, i) => {
            const response = session.responses.find((r) => r.questionIndex === i);
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-start gap-2">
                  <CategoryBadge category={q.category} />
                  <span className="text-sm font-medium text-slate-900">{q.question}</span>
                </div>
                {response ? (
                  <>
                    <p className="rounded-lg bg-slate-900/[0.04] p-3 text-sm text-slate-700">
                      {response.transcript}
                    </p>
                    <FeedbackBlock feedback={response} />
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Not answered</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function VoiceInterview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session: authSession } = useAuth();
  const { tracker } = useTracker(undefined);
  const item = id ? tracker.find((x) => x.id === id) : null;

  const supported = useMemo(() => isSpeechRecognitionSupported(), []);
  const recognition = useSpeechRecognition();
  const { sessions, loading: sessionsLoading, startSession, saveResponses, completeSession } =
    useVoiceInterviewSessions(item?.id);

  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<VoiceInterviewSession | null>(null);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, FeedbackResult>>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Resume the most recent in-progress session for this role, if one exists,
  // instead of forcing every visit to start a brand-new session.
  useEffect(() => {
    if (activeSession || sessionsLoading) return;
    const inProgress = sessions.find((s) => !s.completedAt);
    if (inProgress) {
      setActiveSession(inProgress);
      const byIndex: Record<number, FeedbackResult> = {};
      inProgress.responses.forEach((r) => {
        byIndex[r.questionIndex] = r;
      });
      setFeedbackByIndex(byIndex);
    }
  }, [sessions, sessionsLoading, activeSession]);

  useEffect(() => {
    if (recognition.status === "stopped") {
      setEditedTranscript(recognition.transcript);
    }
  }, [recognition.status, recognition.transcript]);

  const progress = activeSession
    ? computeSessionProgress(activeSession.questions, activeSession.responses)
    : null;
  const currentQuestion: VoiceInterviewQuestion | null =
    activeSession && progress && progress.nextIndex !== null
      ? activeSession.questions[progress.nextIndex]
      : null;
  const currentIndex = progress?.nextIndex ?? null;
  const currentFeedback = currentIndex !== null ? feedbackByIndex[currentIndex] : undefined;

  const runStartSession = useCallback(async () => {
    if (!item?.jobDescription) return;
    setGenError(null);
    setGenLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate-interview-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authSession?.access_token
            ? { Authorization: `Bearer ${authSession.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          jobDescription: item.jobDescription,
          companyName: item.company,
          roleTitle: item.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));
      const questions: VoiceInterviewQuestion[] = data.questions ?? [];
      const { session: created, error: startError } = await startSession(questions);
      if (startError || !created) throw new Error(startError ?? "Failed to start session");
      setActiveSession(created);
      setFeedbackByIndex({});
      recognition.reset();
      logEvent("interview_started", { mode: "voice", questionCount: questions.length });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to start voice interview");
    } finally {
      setGenLoading(false);
    }
  }, [item, authSession, startSession, recognition]);

  const submitAnswer = useCallback(async () => {
    if (!activeSession || currentIndex === null || !currentQuestion) return;
    const transcript = editedTranscript.trim();
    if (!isTranscriptSubmittable(transcript)) {
      setFeedbackError("Record (or edit in) a bit more before submitting.");
      return;
    }
    setFeedbackError(null);
    setFeedbackLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/interview-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authSession?.access_token
            ? { Authorization: `Bearer ${authSession.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          question: currentQuestion.question,
          answer: transcript,
          jobDescription: item?.jobDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));

      const entry: VoiceInterviewResponse = {
        questionIndex: currentIndex,
        transcript,
        feedback: data.feedback,
        strengths: data.strengths ?? [],
        improvements: data.improvements ?? [],
        answeredAt: new Date().toISOString(),
      };
      const nextResponses = upsertResponse(activeSession.responses, entry);
      const { error: saveError } = await saveResponses(activeSession.id, nextResponses);
      if (saveError) throw new Error(saveError);

      const updatedSession = { ...activeSession, responses: nextResponses };
      setActiveSession(updatedSession);
      setFeedbackByIndex((prev) => ({ ...prev, [currentIndex]: entry }));
      recognition.reset();
      setEditedTranscript("");

      const nextProgress = computeSessionProgress(updatedSession.questions, nextResponses);
      if (nextProgress.isComplete) {
        await completeSession(updatedSession.id);
        setActiveSession({ ...updatedSession, completedAt: new Date().toISOString() });
      }
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : "Failed to get feedback");
    } finally {
      setFeedbackLoading(false);
    }
  }, [activeSession, currentIndex, currentQuestion, editedTranscript, authSession, item, saveResponses, completeSession, recognition]);

  if (!item) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-slate-500">Role not found.</p>
          <button
            type="button"
            onClick={() => navigate("/roles")}
            className="mt-4 text-sm text-slate-700 underline hover:text-slate-900"
          >
            Back to Roles
          </button>
        </div>
      </AppShell>
    );
  }

  const pastSessions = sessions.filter((s) => s.id !== activeSession?.id || s.completedAt);

  return (
    <AppShell>
      <div className="animate-fade-in mx-auto max-w-2xl space-y-6 pb-12">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/roles", { state: { openRoleId: item.id } })}
            className="btn-press flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-900/[0.06]"
          >
            <ArrowLeft size={18} />
            Back to role
          </button>
        </div>

        <section className="text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            Voice interview practice
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {item.role} at {item.company}
          </p>
        </section>

        {!supported && (
          <Panel>
            <p className="text-sm text-slate-700">
              Voice interview mode isn&apos;t supported in this browser. Try Chrome or Edge, or
              use the regular text-based{" "}
              <button
                type="button"
                onClick={() => navigate(`/roles/${item.id}/interview-prep`)}
                className="underline hover:text-slate-900"
              >
                interview prep
              </button>{" "}
              instead — it works everywhere.
            </p>
          </Panel>
        )}

        {supported && !item.jobDescription && (
          <Panel>
            <p className="text-sm text-slate-500">
              This role needs a job description before interview questions can be generated. Add
              one via Analyze or Re-analyze this role.
            </p>
          </Panel>
        )}

        {supported && item.jobDescription && !activeSession && (
          <Panel>
            {genError && <p className="mb-3 text-sm text-red-600">{genError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Answer a mix of behavioral and technical questions out loud — your speech is
                transcribed live in your browser, then scored the same way as typed answers.
              </p>
              <Button type="button" onClick={runStartSession} disabled={genLoading} size="sm">
                {genLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                    Starting…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Mic size={14} />
                    Start voice interview
                  </span>
                )}
              </Button>
            </div>
          </Panel>
        )}

        {supported && activeSession && currentQuestion && currentIndex !== null && (
          <Panel
            title={`Question ${currentIndex + 1} of ${activeSession.questions.length}`}
            right={<CategoryBadge category={currentQuestion.category} />}
          >
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-900">{currentQuestion.question}</p>

              {recognition.status === "permission-denied" && (
                <p className="text-sm text-red-600">{recognition.error}</p>
              )}
              {recognition.status === "error" && (
                <p className="text-sm text-red-600">{recognition.error}</p>
              )}

              {(recognition.status === "idle" || recognition.status === "error" || recognition.status === "permission-denied") && (
                <Button type="button" onClick={recognition.start} size="sm">
                  <span className="inline-flex items-center gap-2">
                    <Mic size={14} />
                    Start speaking
                  </span>
                </Button>
              )}

              {recognition.status === "listening" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-sm text-slate-700">
                    {recognition.transcript || (
                      <span className="text-slate-400">Listening…</span>
                    )}
                  </div>
                  <Button type="button" onClick={recognition.stop} variant="secondary" size="sm">
                    <span className="inline-flex items-center gap-2">
                      <Square size={14} />
                      Stop
                    </span>
                  </Button>
                </div>
              )}

              {recognition.status === "stopped" && !currentFeedback && (
                <div className="space-y-3">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    rows={5}
                    placeholder="Your transcribed answer will appear here — edit it if needed before submitting."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                  />
                  {feedbackError && <p className="text-sm text-red-600">{feedbackError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={submitAnswer} disabled={feedbackLoading} size="sm">
                      {feedbackLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-700 border-t-transparent" />
                          Getting feedback…
                        </span>
                      ) : (
                        "Submit answer"
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        recognition.reset();
                        setEditedTranscript("");
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      <span className="inline-flex items-center gap-2">
                        <RotateCcw size={14} />
                        Re-record
                      </span>
                    </Button>
                  </div>
                </div>
              )}

              {currentFeedback && (
                <div className="space-y-3">
                  <p className="rounded-lg bg-slate-900/[0.04] p-3 text-sm text-slate-700">
                    {activeSession.responses.find((r) => r.questionIndex === currentIndex)
                      ?.transcript}
                  </p>
                  <FeedbackBlock feedback={currentFeedback} />
                </div>
              )}
            </div>
          </Panel>
        )}

        {supported && activeSession && progress?.isComplete && (
          <Panel title="Session complete">
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                You answered all {activeSession.questions.length} questions. Nice work.
              </p>
              <Button
                type="button"
                onClick={() => {
                  setActiveSession(null);
                  setFeedbackByIndex({});
                  recognition.reset();
                }}
                size="sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={14} />
                  Start another voice interview
                </span>
              </Button>
            </div>
          </Panel>
        )}

        {pastSessions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Past sessions</h2>
            <div className="space-y-3">
              {pastSessions.map((s) => (
                <SessionHistoryItem key={s.id} session={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
