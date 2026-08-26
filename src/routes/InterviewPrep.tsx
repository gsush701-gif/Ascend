import { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "../lib/cn";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/apiError";
import { logEvent } from "../lib/analytics";

type InterviewQuestion = { question: string; category: string };

type FeedbackResult = {
  feedback: string;
  strengths: string[];
  improvements: string[];
};

function CategoryBadge({ category }: { category: string }) {
  const isBehavioral = category === "behavioral";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
        isBehavioral
          ? "border-slate-200 bg-slate-900/[0.04] text-slate-600"
          : "border-cyan-500/50 bg-cyan-500/20 text-cyan-700"
      )}
    >
      {category}
    </span>
  );
}

export function InterviewPrep() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { tracker, updateInterviewPrep } = useTracker(undefined);

  const item = id ? tracker.find((x) => x.id === id) : null;

  const [genLoading, setGenLoading] = useState(false);
  const [genSlow, setGenSlow] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, FeedbackResult>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<number | null>(null);
  const [feedbackError, setFeedbackError] = useState<Record<number, string>>({});

  const runGenerateQuestions = useCallback(async () => {
    if (!item?.jobDescription) return;
    setGenError(null);
    setGenLoading(true);
    setGenSlow(false);
    const slowTimer = setTimeout(() => setGenSlow(true), 6000);
    try {
      const res = await fetch(`${API_BASE}/api/generate-interview-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
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
      updateInterviewPrep(item.id, {
        questions: data.questions ?? [],
        generatedAt: new Date().toISOString(),
      });
      logEvent("interview_started", { questionCount: data.questions?.length });
      setExpandedIndex(null);
      setAnswers({});
      setFeedbackByIndex({});
      setFeedbackError({});
    } catch (e) {
      setGenError(
        e instanceof Error ? e.message : "Failed to generate interview questions"
      );
    } finally {
      clearTimeout(slowTimer);
      setGenLoading(false);
      setGenSlow(false);
    }
  }, [item, session, updateInterviewPrep]);

  const runGetFeedback = useCallback(
    async (index: number, question: string) => {
      const answer = (answers[index] ?? "").trim();
      if (answer.length < 10) {
        setFeedbackError((prev) => ({
          ...prev,
          [index]: "Write a bit more before requesting feedback.",
        }));
        return;
      }
      setFeedbackError((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setFeedbackLoading(index);
      try {
        const res = await fetch(`${API_BASE}/api/interview-feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            question,
            answer,
            jobDescription: item?.jobDescription,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(data, "AI request failed"));
        setFeedbackByIndex((prev) => ({ ...prev, [index]: data }));
      } catch (e) {
        setFeedbackError((prev) => ({
          ...prev,
          [index]: e instanceof Error ? e.message : "Failed to get feedback",
        }));
      } finally {
        setFeedbackLoading((cur) => (cur === index ? null : cur));
      }
    },
    [answers, item, session]
  );

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

  const questions = item.interviewPrep?.questions ?? [];

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
            Mock interview practice
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {item.role} at {item.company}
          </p>
        </section>

        {!item.jobDescription ? (
          <Panel>
            <p className="text-sm text-slate-500">
              This role needs a job description before interview questions can
              be generated. Add one via Analyze or Re-analyze this role.
            </p>
          </Panel>
        ) : (
          <>
            <Panel>
              {genError && <p className="mb-3 text-sm text-red-600">{genError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {questions.length > 0
                    ? `${questions.length} questions generated${
                        item.interviewPrep?.generatedAt
                          ? " · " + new Date(item.interviewPrep.generatedAt).toLocaleDateString()
                          : ""
                      }`
                    : "Generate a mix of behavioral and technical questions grounded in this role's job description."}
                </p>
                <Button
                  type="button"
                  onClick={runGenerateQuestions}
                  disabled={genLoading}
                  variant={questions.length > 0 ? "secondary" : "primary"}
                  size="sm"
                >
                  {genLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                      Generating…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles size={14} />
                      {questions.length > 0 ? "Regenerate questions" : "Generate questions"}
                    </span>
                  )}
                </Button>
              </div>
              {genLoading && genSlow && (
                <p className="mt-2 text-xs text-slate-500">
                  Still working — the server may be waking up from idle, this
                  can take up to a minute.
                </p>
              )}
            </Panel>

            {questions.length > 0 && (
              <div className="space-y-3">
                {questions.map((q: InterviewQuestion, i: number) => {
                  const expanded = expandedIndex === i;
                  const feedback = feedbackByIndex[i];
                  return (
                    <section
                      key={i}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-dash-card shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedIndex(expanded ? null : i)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-900/[0.04] transition"
                      >
                        <div className="flex items-start gap-3">
                          <CategoryBadge category={q.category} />
                          <span className="text-sm font-medium text-slate-900">
                            {q.question}
                          </span>
                        </div>
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </button>

                      {expanded && (
                        <div className="animate-fade-in space-y-3 border-t border-slate-200 px-4 py-4">
                          <textarea
                            value={answers[i] ?? ""}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                            }
                            placeholder="Type your answer..."
                            rows={5}
                            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                          />
                          {feedbackError[i] && (
                            <p className="text-sm text-red-600">{feedbackError[i]}</p>
                          )}
                          <Button
                            type="button"
                            onClick={() => runGetFeedback(i, q.question)}
                            disabled={feedbackLoading === i}
                            size="sm"
                          >
                            {feedbackLoading === i ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-700 border-t-transparent" />
                                Getting feedback…
                              </span>
                            ) : (
                              "Get feedback"
                            )}
                          </Button>

                          {feedback && (
                            <div className="animate-fade-in space-y-4 rounded-xl border border-slate-200 bg-slate-900/[0.04] p-4">
                              <p className="text-sm leading-relaxed text-slate-800">
                                {feedback.feedback}
                              </p>
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
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
