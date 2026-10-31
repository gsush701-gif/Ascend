import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Volume2,
  Lock,
} from "lucide-react";
import { cn } from "../lib/cn";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { AnimatedBar } from "../components/ui/AnimatedBar";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { useFeatureAccess } from "../features/featureAccess/useFeatureAccess";
import { useBillingActions } from "../features/profile/hooks/useBillingActions";
import { getApiErrorMessage } from "../lib/apiError";
import { logEvent } from "../lib/analytics";
import { useSpeechRecognition, isSpeechRecognitionSupported } from "../features/voiceInterview/useSpeechRecognition";
import { useAutoStopOnSilence } from "../features/voiceInterview/useAutoStopOnSilence";
import { useInterviewerVoice } from "../features/voiceInterview/useInterviewerVoice";
import { useVoiceInterviewSessions } from "../features/voiceInterview/hooks/useVoiceInterviewSessions";
import {
  computeSessionProgress,
  isTranscriptSubmittable,
  upsertResponse,
} from "../features/voiceInterview/sessionLogic";
import {
  initialConversationState,
  appendTurn,
  advanceConversationState,
  countCandidateTurns,
  progressDotsFilled,
  formatTranscriptForDisplay,
} from "../features/voiceInterview/conversationLogic";
import type {
  VoiceInterviewQuestion,
  VoiceInterviewResponse,
  VoiceInterviewSession,
  ConversationTurn,
  ConversationState,
  InterviewEvaluation,
} from "../types/voiceInterview";

type FeedbackResult = { feedback: string; strengths: string[]; improvements: string[] };

const PROGRESS_DOT_COUNT = 5;

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

/** Legacy (Week 2 and earlier) fixed-question session history — unchanged.
 * Still used for any session created before the Week 3 conversation engine;
 * new sessions render via ConversationSessionHistoryItem instead. */
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

/** Chat-style rendering of a dynamic conversation's full transcript —
 * available live (collapsed by default) and in past-session history. */
function TranscriptView({ transcript }: { transcript: ConversationTurn[] }) {
  if (transcript.length === 0) {
    return <p className="text-xs text-slate-400">No conversation recorded.</p>;
  }
  return (
    <div className="space-y-2">
      {transcript.map((t, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl px-3 py-2 text-sm",
            t.speaker === "interviewer"
              ? "bg-slate-900/[0.04] text-slate-700"
              : "ml-6 bg-cyan-500/10 text-slate-800",
          )}
        >
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t.speaker === "interviewer" ? "Interviewer" : "You"}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Subtle progress indicator replacing "Question N of M" — a fixed number of
 * dots filled proportionally to the soft turn budget, never a literal count. */
function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-label="Interview progress">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full transition-colors", i < filled ? "bg-cyan-500" : "bg-slate-200")}
        />
      ))}
    </div>
  );
}

const EVAL_SCORE_ROWS: { key: keyof InterviewEvaluation; label: string }[] = [
  { key: "communication", label: "Communication" },
  { key: "relevance", label: "Relevance" },
  { key: "technicalKnowledge", label: "Technical knowledge" },
  { key: "problemSolving", label: "Problem solving" },
  { key: "confidence", label: "Confidence" },
  { key: "completeness", label: "Completeness" },
  { key: "behavioralQuality", label: "Behavioral quality" },
];

/** Final evaluation for a completed dynamic interview — shown once at the
 * end (never mid-interview) and again in past-session history. */
function EvaluationPanel({ evaluation }: { evaluation: InterviewEvaluation }) {
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <span className="font-display text-4xl font-semibold tracking-tight text-slate-900">
          {evaluation.overallScore}
        </span>
        <span className="pb-1 text-sm text-slate-500">/ 100 overall</span>
      </div>

      <div className="space-y-2.5">
        {EVAL_SCORE_ROWS.map(({ key, label }) => (
          <div key={key}>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{label}</span>
              <span>{evaluation[key] as number}%</span>
            </div>
            <div className="mt-1">
              <AnimatedBar pct={evaluation[key] as number} colorClassName="bg-cyan-500" />
            </div>
          </div>
        ))}
      </div>

      {evaluation.strongAnswers.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Strong moments
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {evaluation.strongAnswers.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
      {evaluation.weakAnswers.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
            <AlertCircle size={13} className="text-amber-600" />
            Weak moments
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {evaluation.weakAnswers.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
      {evaluation.areasForImprovement.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Areas to improve</div>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {evaluation.areasForImprovement.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
      {evaluation.suggestedBetterAnswers.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            A stronger answer would have been
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {evaluation.suggestedBetterAnswers.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
      {evaluation.struggledFollowUps.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Follow-ups you struggled with
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {evaluation.struggledFollowUps.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-400">
        {evaluation.usedConcreteExamples
          ? "You backed your answers with concrete examples — keep doing that."
          : "Try grounding more answers in a specific, concrete example next time."}
      </p>
    </div>
  );
}

/** Week 3 dynamic-conversation session history — used whenever a session has
 * `conversationState` set (i.e. was created by the new engine). */
function ConversationSessionHistoryItem({ session }: { session: VoiceInterviewSession }) {
  const [expanded, setExpanded] = useState(false);
  const candidateTurns = countCandidateTurns(session.transcript);
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
            {candidateTurns} {candidateTurns === 1 ? "exchange" : "exchanges"}
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
          <TranscriptView transcript={session.transcript} />
          {session.evaluation && (
            <div className="border-t border-slate-200 pt-4">
              <EvaluationPanel evaluation={session.evaluation} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function VoiceInterview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session: authSession } = useAuth();
  const featureAccess = useFeatureAccess();
  const { billingBusy, handleUpgrade } = useBillingActions(authSession);
  const { tracker } = useTracker(undefined);
  const item = id ? tracker.find((x) => x.id === id) : null;

  const supported = useMemo(() => isSpeechRecognitionSupported(), []);
  const recognition = useSpeechRecognition();
  const voice = useInterviewerVoice(authSession?.access_token);
  useAutoStopOnSilence(recognition);
  const {
    sessions,
    loading: sessionsLoading,
    saveResponses,
    startConversation,
    appendTranscriptTurns,
    saveEvaluation,
    completeSession,
  } = useVoiceInterviewSessions(item?.id);

  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<VoiceInterviewSession | null>(null);

  // --- Legacy (Week 2 and earlier) fixed-question state — only ever used
  // when a resumed in-progress session is legacy-shaped (created before the
  // Week 3 conversation engine below). Nothing new is created this way.
  const [editedTranscript, setEditedTranscript] = useState("");
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, FeedbackResult>>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // --- Week 3 dynamic-conversation state.
  const [turnLoading, setTurnLoading] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  const isConversationSession = activeSession != null && activeSession.conversationState != null;

  // Resume the most recent in-progress session for this role, if one exists,
  // instead of forcing every visit to start a brand-new session. Works for
  // either session shape — conversation-shaped sessions simply have empty
  // `responses`, so the legacy feedbackByIndex population below is a no-op.
  useEffect(() => {
    if (activeSession || sessionsLoading) return;
    const inProgress = sessions.find((s) => !s.completedAt);
    if (inProgress) {
      setActiveSession(inProgress);
      if (inProgress.evaluation) setEvaluation(inProgress.evaluation);
      const byIndex: Record<number, FeedbackResult> = {};
      inProgress.responses.forEach((r) => {
        byIndex[r.questionIndex] = r;
      });
      setFeedbackByIndex(byIndex);
    }
  }, [sessions, sessionsLoading, activeSession]);

  useEffect(() => {
    if (recognition.status === "stopped" && !isConversationSession) {
      setEditedTranscript(recognition.transcript);
    }
  }, [recognition.status, recognition.transcript, isConversationSession]);

  // ===== Legacy fixed-question flow (unchanged from Week 2) =====
  const progress = activeSession && !isConversationSession
    ? computeSessionProgress(activeSession.questions, activeSession.responses)
    : null;
  const currentQuestion: VoiceInterviewQuestion | null =
    activeSession && progress && progress.nextIndex !== null
      ? activeSession.questions[progress.nextIndex]
      : null;
  const currentIndex = progress?.nextIndex ?? null;
  const currentFeedback = currentIndex !== null ? feedbackByIndex[currentIndex] : undefined;

  const LEGACY_TRANSITIONS = [
    "Thanks for sharing that.",
    "Got it, thank you.",
    "That's helpful, thanks.",
    "Okay, noted.",
  ];

  const spokenQuestionKeyRef = useRef<string | null>(null);
  const activeSessionId = activeSession?.id ?? null;
  const questionText = currentQuestion?.question ?? null;
  const itemRole = item?.role ?? null;
  const itemCompany = item?.company ?? null;
  useEffect(() => {
    if (!supported || !itemRole || !itemCompany || !activeSessionId || currentIndex === null || !questionText) return;
    if (currentFeedback) return;
    const key = `${activeSessionId}:${currentIndex}`;
    if (spokenQuestionKeyRef.current === key) return;
    spokenQuestionKeyRef.current = key;

    let cancelled = false;
    (async () => {
      const line =
        currentIndex === 0
          ? `Hi, I'm your interviewer today for the ${itemRole} role at ${itemCompany}. Let's get started with your first question. ${questionText}`
          : `${LEGACY_TRANSITIONS[currentIndex % LEGACY_TRANSITIONS.length]} Here's your next question. ${questionText}`;
      await voice.speak(line);
      if (cancelled) return;
      if (
        recognition.status === "idle" ||
        recognition.status === "error" ||
        recognition.status === "permission-denied"
      ) {
        recognition.start();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, itemRole, itemCompany, activeSessionId, currentIndex, questionText, currentFeedback]);

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
        if (item) {
          void voice.speak(
            `That wraps up our interview for the ${item.role} role at ${item.company}. Thanks so much for your time today — nice work.`,
          );
        }
      }
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : "Failed to get feedback");
    } finally {
      setFeedbackLoading(false);
    }
  }, [activeSession, currentIndex, currentQuestion, editedTranscript, authSession, item, saveResponses, completeSession, recognition, voice]);

  // ===== Week 3 dynamic-conversation engine =====

  /** Generates + speaks the next interviewer turn from a given transcript
   * and state, then either auto-starts the mic or closes the interview. */
  const requestNextTurn = useCallback(
    async (sessionId: string, transcriptSoFar: ConversationTurn[], stateSoFar: ConversationState) => {
      if (!item?.jobDescription) return;
      setTurnLoading(true);
      setTurnError(null);
      try {
        const res = await fetch(`${API_BASE}/api/interview-turn`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authSession?.access_token ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
          },
          body: JSON.stringify({
            jobDescription: item.jobDescription,
            companyName: item.company,
            roleTitle: item.role,
            transcript: transcriptSoFar.map((t) => ({ speaker: t.speaker, text: t.text })),
            topicsCovered: stateSoFar.topicsCovered,
            currentTopic: stateSoFar.currentTopic,
            followUpCountForTopic: stateSoFar.followUpCountForTopic,
            turnCount: stateSoFar.turnCount,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));

        const newTranscript = appendTurn(transcriptSoFar, "interviewer", data.message);
        const newState = advanceConversationState(stateSoFar, stateSoFar.turnCount, data.action, data.topic ?? null);
        setActiveSession((prev) =>
          prev && prev.id === sessionId ? { ...prev, transcript: newTranscript, conversationState: newState } : prev,
        );
        setTurnLoading(false);
        void appendTranscriptTurns(sessionId, newTranscript, newState);

        await voice.speak(data.message);

        if (data.action === "CLOSE_INTERVIEW") {
          await completeSession(sessionId);
          setActiveSession((prev) =>
            prev && prev.id === sessionId ? { ...prev, completedAt: new Date().toISOString() } : prev,
          );
          setEvalLoading(true);
          try {
            const evalRes = await fetch(`${API_BASE}/api/interview-evaluation`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(authSession?.access_token ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
              },
              body: JSON.stringify({
                transcript: formatTranscriptForDisplay(newTranscript),
                jobDescription: item.jobDescription,
              }),
            });
            const evalData = await evalRes.json();
            if (!evalRes.ok) throw new Error(getApiErrorMessage(evalData, "AI request failed"));
            setEvaluation(evalData);
            void saveEvaluation(sessionId, evalData);
          } catch (evalErr) {
            setTurnError(
              evalErr instanceof Error
                ? `Interview complete, but the evaluation failed: ${evalErr.message}`
                : "Interview complete, but the evaluation failed to generate.",
            );
          } finally {
            setEvalLoading(false);
          }
        } else if (
          recognition.status === "idle" ||
          recognition.status === "error" ||
          recognition.status === "permission-denied"
        ) {
          recognition.start();
        }
      } catch (e) {
        setTurnError(e instanceof Error ? e.message : "Failed to continue the interview");
        setTurnLoading(false);
      }
    },
    [item, authSession, appendTranscriptTurns, voice, recognition, completeSession, saveEvaluation],
  );

  const startInterview = useCallback(async () => {
    if (!item?.jobDescription) return;
    setGenError(null);
    setGenLoading(true);
    try {
      const { session: created, error: startError } = await startConversation();
      if (startError || !created) throw new Error(startError ?? "Failed to start interview");
      setActiveSession(created);
      setEvaluation(null);
      setTurnError(null);
      recognition.reset();
      logEvent("interview_started", { mode: "voice-conversation" });
      await requestNextTurn(created.id, [], initialConversationState());
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to start voice interview");
    } finally {
      setGenLoading(false);
    }
  }, [item, startConversation, recognition, requestNextTurn]);

  // Auto-fires whenever the mic stops (silence auto-stop, or a manual Stop)
  // during an active dynamic conversation — sends the answer immediately,
  // no review/edit step, matching a real call.
  useEffect(() => {
    if (recognition.status !== "stopped") return;
    if (!activeSession || !isConversationSession || !activeSession.conversationState) return;
    if (turnLoading) return;
    const answer = recognition.transcript.trim();
    recognition.reset();
    if (!isTranscriptSubmittable(answer)) return;

    const newTranscript = appendTurn(activeSession.transcript, "candidate", answer);
    const newTurnCount = countCandidateTurns(newTranscript);
    const newState: ConversationState = { ...activeSession.conversationState, turnCount: newTurnCount };
    const sessionId = activeSession.id;
    setActiveSession((prev) =>
      prev && prev.id === sessionId ? { ...prev, transcript: newTranscript, conversationState: newState } : prev,
    );
    void appendTranscriptTurns(sessionId, newTranscript, newState);
    void requestNextTurn(sessionId, newTranscript, newState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.status]);

  /** Shared "start over" for both session shapes — abandons whatever's in
   * progress (if anything) and always starts a fresh dynamic conversation. */
  const restartInterview = useCallback(async () => {
    if (activeSession && !activeSession.completedAt) {
      await completeSession(activeSession.id);
    }
    voice.stop();
    recognition.reset();
    spokenQuestionKeyRef.current = null;
    setFeedbackByIndex({});
    setEditedTranscript("");
    setActiveSession(null);
    setEvaluation(null);
    setTurnError(null);
    await startInterview();
  }, [activeSession, completeSession, voice, recognition, startInterview]);

  const handleMicClick = useCallback(() => {
    if (voice.status === "speaking" || voice.status === "loading") {
      // Manual interrupt — stop the interviewer's audio and start listening
      // right away, rather than waiting for it to finish.
      voice.stop();
    }
    recognition.start();
  }, [voice, recognition]);

  // Pro-only feature — see useFeatureAccess. UX only; the server routes this
  // page calls independently reject callers whose plan doesn't include it.
  if (!featureAccess.checked) {
    return (
      <AppShell>
        <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
      </AppShell>
    );
  }
  if (!featureAccess.voiceInterview) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-12 text-center">
          <Lock className="mx-auto h-8 w-8 text-slate-400" />
          <h1 className="mt-3 font-display text-xl font-semibold tracking-tight text-slate-900">
            Voice interview is a Pro feature
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Practice a real back-and-forth interview out loud, with a spoken AI interviewer and a
            scored evaluation at the end. Upgrade to Pro to unlock it. The text-based interview
            prep stays free for every role.
          </p>
          <div className="mt-5 flex flex-col items-center gap-3">
            {authSession ? (
              <Button type="button" onClick={handleUpgrade} disabled={billingBusy} size="sm">
                {billingBusy ? "Opening checkout…" : "Upgrade to Pro"}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(id ? `/roles/${id}/interview-prep` : "/roles")}
              className="text-sm text-slate-700 underline hover:text-slate-900"
            >
              Go to interview prep
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

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

  const conversationState = activeSession?.conversationState ?? null;
  const transcript = activeSession?.transcript ?? [];
  const latestInterviewerMessage =
    [...transcript].reverse().find((t) => t.speaker === "interviewer")?.text ?? null;

  const phaseLabel = activeSession?.completedAt
    ? "Interview complete"
    : turnLoading
      ? "One moment…"
      : voice.status === "speaking" || voice.status === "loading"
        ? "Interviewer is speaking… (tap the mic to interrupt)"
        : recognition.status === "listening"
          ? "Listening…"
          : "Your turn";

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
            Voice interview
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
              This role needs a job description before an interview can be generated. Add one via
              Analyze or Re-analyze this role.
            </p>
          </Panel>
        )}

        {supported && item.jobDescription && !activeSession && (
          <Panel>
            {genError && <p className="mb-3 text-sm text-red-600">{genError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                A real back-and-forth interview, not a form — your interviewer asks a question,
                actually listens to your answer, and follows up naturally based on what you said,
                just like a real call. Answer out loud; the mic starts and stops on its own.
              </p>
              <Button type="button" onClick={startInterview} disabled={genLoading} size="sm">
                {genLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                    Starting…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Mic size={14} />
                    Start interview
                  </span>
                )}
              </Button>
            </div>
          </Panel>
        )}

        {/* Week 3 dynamic-conversation interview, in progress */}
        {isConversationSession && activeSession && !activeSession.completedAt && conversationState && (
          <Panel>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Interview in progress
                </span>
                {conversationState.turnCount > 0 && (
                  <button
                    type="button"
                    onClick={restartInterview}
                    title="Abandon this interview and start a fresh one"
                    className="text-xs text-slate-400 underline hover:text-slate-600"
                  >
                    Start over
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center gap-3 py-1 text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  AI Interviewer
                </span>
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                    voice.status === "speaking" || voice.status === "loading"
                      ? "bg-cyan-500/15"
                      : "bg-slate-900/[0.04]",
                  )}
                >
                  <Volume2
                    size={22}
                    className={cn(
                      "text-cyan-600",
                      (voice.status === "speaking" || voice.status === "loading") && "animate-pulse",
                    )}
                  />
                </div>
                {latestInterviewerMessage && (
                  <p className="max-w-md text-sm font-medium text-slate-900">{latestInterviewerMessage}</p>
                )}
              </div>

              <p className="text-center text-sm text-slate-500">{phaseLabel}</p>

              <div className="flex flex-col items-center gap-3 border-t border-slate-200 pt-5 text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">You</span>
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={recognition.status === "listening" || turnLoading}
                  className={cn(
                    "btn-press flex h-14 w-14 items-center justify-center rounded-full transition disabled:cursor-not-allowed",
                    recognition.status === "listening"
                      ? "bg-rose-500/15 text-rose-600"
                      : "bg-cyan-500/15 text-cyan-600 hover:bg-cyan-500/20 disabled:opacity-40",
                  )}
                  aria-label={
                    voice.status === "speaking" ? "Interrupt the interviewer and start speaking" : "Start speaking"
                  }
                >
                  <Mic size={22} />
                </button>

                {recognition.status === "listening" && (
                  <p className="max-w-md rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-sm text-slate-700">
                    {recognition.transcript || <span className="text-slate-400">Listening…</span>}
                  </p>
                )}
                {(recognition.status === "permission-denied" || recognition.status === "error") && (
                  <p className="text-xs text-red-600">{recognition.error}</p>
                )}
              </div>

              {turnError && <p className="text-center text-sm text-red-600">{turnError}</p>}

              <ProgressDots
                filled={progressDotsFilled(conversationState.turnCount, PROGRESS_DOT_COUNT, false)}
                total={PROGRESS_DOT_COUNT}
              />

              {transcript.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-center text-xs text-slate-400 hover:text-slate-600">
                    View full transcript
                  </summary>
                  <div className="mt-3">
                    <TranscriptView transcript={transcript} />
                  </div>
                </details>
              )}
            </div>
          </Panel>
        )}

        {/* Week 3 dynamic-conversation interview, complete */}
        {isConversationSession && activeSession?.completedAt && (
          <Panel title="Interview complete">
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Nice work — here's how it went.</p>

              {evalLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                  Generating your evaluation…
                </div>
              ) : evaluation ? (
                <EvaluationPanel evaluation={evaluation} />
              ) : turnError ? (
                <p className="text-sm text-red-600">{turnError}</p>
              ) : null}

              {transcript.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                    View full transcript
                  </summary>
                  <div className="mt-3">
                    <TranscriptView transcript={transcript} />
                  </div>
                </details>
              )}

              <Button type="button" onClick={restartInterview} size="sm">
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={14} />
                  Start another interview
                </span>
              </Button>
            </div>
          </Panel>
        )}

        {/* Legacy (Week 2 and earlier) fixed-question interview — only ever
            shown when a resumed in-progress session predates the Week 3
            conversation engine above. */}
        {!isConversationSession && supported && activeSession && currentQuestion && currentIndex !== null && (
          <Panel
            title={`Question ${currentIndex + 1} of ${activeSession.questions.length}`}
            right={
              <div className="flex items-center gap-2">
                <CategoryBadge category={currentQuestion.category} />
                <button
                  type="button"
                  onClick={restartInterview}
                  title="Abandon this session and start a fresh interview"
                  className="text-xs text-slate-400 underline hover:text-slate-600"
                >
                  Start over
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{currentQuestion.question}</p>
                <button
                  type="button"
                  onClick={() => voice.speak(currentQuestion.question)}
                  disabled={voice.status !== "idle"}
                  title="Replay question"
                  className="btn-press flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-900/[0.04] disabled:opacity-50"
                >
                  <Volume2 size={13} className={voice.status === "speaking" ? "animate-pulse text-cyan-600" : ""} />
                  {voice.status === "speaking" ? "Speaking…" : "Replay"}
                </button>
              </div>

              {recognition.status === "permission-denied" && (
                <p className="text-sm text-red-600">{recognition.error}</p>
              )}
              {recognition.status === "error" && (
                <p className="text-sm text-red-600">{recognition.error}</p>
              )}

              {(recognition.status === "idle" || recognition.status === "error" || recognition.status === "permission-denied") && (
                <Button type="button" onClick={recognition.start} disabled={voice.status !== "idle"} size="sm">
                  <span className="inline-flex items-center gap-2">
                    <Mic size={14} />
                    {voice.status === "idle" ? "Start speaking" : "Waiting for question…"}
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

        {!isConversationSession && supported && activeSession && progress?.isComplete && (
          <Panel title="Session complete">
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                You answered all {activeSession.questions.length} questions. Nice work.
              </p>
              <Button type="button" onClick={restartInterview} size="sm">
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={14} />
                  Start another interview
                </span>
              </Button>
            </div>
          </Panel>
        )}

        {pastSessions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Past sessions</h2>
            <div className="space-y-3">
              {pastSessions.map((s) =>
                s.conversationState != null ? (
                  <ConversationSessionHistoryItem key={s.id} session={s} />
                ) : (
                  <SessionHistoryItem key={s.id} session={s} />
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
