import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Plus } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { WakingNotice } from "../components/ui/WakingNotice";
import { KairosAvatar } from "../components/ui/KairosAvatar";
import { card, pageHeader, pageTitle, pageSubtitle } from "../lib/ui";
import { cn } from "../lib/cn";
import { useAuth } from "../context/AuthContext";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useAdvisorPlan } from "../features/advisor/useAdvisorPlan";
import { API_BASE } from "../config/api";
import { AI_NAME } from "../config/brand";
import { getApiErrorMessage } from "../lib/apiError";

/**
 * Standalone home for the AI career advisor, laid out as a conversation: the
 * thread fills the page, the box to type in sits at the bottom, and a side panel
 * shows what Kairos suggests for this week. It calls the same
 * POST /api/career-advice endpoint as the "Ask AI about this role" panel on a
 * role, with the same auth and the same { question, roleId? } shape, plus the
 * last few messages so a follow-up question makes sense. Facts about the
 * student still come only from rows the server looks up itself.
 *
 * The thread is kept in this browser (per account, last 40 messages) so a
 * refresh does not lose it, and is cleared on sign-out.
 */

const SUGGESTED_QUESTIONS = [
  "Am I a strong fit for my target role?",
  "What should I improve first on my resume?",
  "How many roles should I apply to each week?",
  "What's the highest-leverage thing I can do this week?",
];

type Msg = { id: string; role: "user" | "assistant"; content: string };

const THREAD_KEY_PREFIX = "ascend.kairos.thread.";
const MAX_SAVED = 40;
const HISTORY_SENT = 6;

function loadThread(userId: string | undefined): Msg[] {
  if (!userId) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(THREAD_KEY_PREFIX + userId) ?? "null");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (m): m is Msg =>
          m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && typeof m.id === "string",
      )
      .slice(-MAX_SAVED);
  } catch {
    return [];
  }
}

function saveThread(userId: string | undefined, messages: Msg[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(THREAD_KEY_PREFIX + userId, JSON.stringify(messages.slice(-MAX_SAVED)));
  } catch {
    // Private mode or full storage: the thread just will not survive a refresh.
  }
}

let nextId = 0;
const newId = () => `${Date.now().toString(36)}-${nextId++}`;

export function Assistant() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { tracker } = useTracker(undefined);
  const { items: planItems, loading: planLoading, error: planError } = useAdvisorPlan();
  const userId = session?.user?.id;

  const [roleId, setRoleId] = useState("");
  const [messages, setMessages] = useState<Msg[]>(() => loadThread(userId));
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<{ message: string; question: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const roleOptions = useMemo(
    () => [
      { value: "", label: "General question" },
      ...tracker.map((t) => ({ value: t.id, label: `${t.role} — ${t.company}` })),
    ],
    [tracker],
  );

  useEffect(() => {
    saveThread(userId, messages);
  }, [userId, messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, error]);

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || loading) return;
      const history = messages.slice(-HISTORY_SENT).map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { id: newId(), role: "user", content: q }]);
      setDraft("");
      setError(null);
      setLoading(true);
      const slowTimer = setTimeout(() => setSlow(true), 6000);
      try {
        const res = await fetch(`${API_BASE}/api/career-advice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ question: q, history, ...(roleId ? { roleId } : {}) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to get an answer"));
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: String(data.answer ?? "") }]);
      } catch (e) {
        setError({ message: e instanceof Error ? e.message : "Failed to get an answer", question: q });
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
        setLoading(false);
      }
    },
    [loading, messages, roleId, session?.access_token],
  );

  function retry() {
    if (!error) return;
    const q = error.question;
    // The failed question is already in the thread; drop it so it is not shown twice.
    setMessages((prev) => (prev[prev.length - 1]?.content === q && prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev));
    setError(null);
    void ask(q);
  }

  function newChat() {
    setMessages([]);
    setError(null);
    setDraft("");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>
              <span className="inline-flex items-center gap-3">
                <KairosAvatar size={34} state={loading ? "thinking" : "idle"} />
                {AI_NAME}
              </span>
            </h1>
            <p className={pageSubtitle}>Your AI career advisor. Direct answers grounded in your real data.</p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-12">
          <section
            className={cn(card, "flex h-[calc(100vh-17rem)] min-h-[480px] min-w-0 flex-col !p-0 lg:col-span-8")}
            aria-label="Conversation"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs font-medium text-slate-500">About</span>
                <Select
                  value={roleId}
                  onChange={setRoleId}
                  options={roleOptions}
                  placeholder="General question"
                  buttonClassName="w-56 max-w-full sm:w-72"
                />
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={newChat}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New chat
                </button>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              {messages.length === 0 && !loading ? (
                <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
                  <KairosAvatar size={56} />
                  <h2 className="mt-4 font-display text-lg font-semibold text-slate-900">Ask me about your search</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Pick a role above to ground the answer in its fit score and skill gaps, or ask a general question.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void ask(q)}
                        className="btn-press rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) =>
                  m.role === "user" ? (
                    <div
                      key={m.id}
                      className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-900 px-4 py-2.5 text-sm text-white"
                    >
                      {m.content}
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-start gap-3">
                      <KairosAvatar size={28} className="mt-0.5 shrink-0" />
                      <div className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-800">
                        {m.content}
                      </div>
                    </div>
                  ),
                )
              )}

              {loading && (
                <div className="flex items-start gap-3">
                  <KairosAvatar size={28} state="thinking" className="mt-0.5 shrink-0" />
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3" aria-label={`${AI_NAME} is thinking`}>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                    {slow && <WakingNotice />}
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error.message}
                  <button type="button" onClick={retry} className="ml-2 font-medium underline hover:text-rose-900">
                    Try again
                  </button>
                </div>
              )}
            </div>

            <form
              className="border-t border-slate-100 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(draft);
              }}
            >
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-5 pr-1.5 transition focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-200">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${AI_NAME}`}
                  maxLength={500}
                  aria-label={`Message ${AI_NAME}`}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !draft.trim()}
                  aria-label="Send"
                  className="btn-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cyan-500"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          </section>

          <aside className="min-w-0 space-y-6 lg:col-span-4">
            <section className={card}>
              <div className="flex items-center gap-3">
                <KairosAvatar size={48} state={loading ? "thinking" : "idle"} />
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold text-slate-900">{AI_NAME}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className={cn("h-1.5 w-1.5 rounded-full", loading ? "bg-amber-400" : "bg-emerald-500")} />
                    {loading ? "Thinking" : "Ready"}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Answers use your tracked roles, fit scores and profile. If the data needed to answer is missing, Kairos
                says so instead of guessing.
              </p>
            </section>

            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">This week</h2>
              <p className="mt-0.5 text-xs text-slate-500">Picked from your own roles, goal and resume.</p>
              {planLoading ? (
                <Skeleton className="mt-4 h-20" />
              ) : planError || planItems.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  {planError ? "Your plan is not available right now." : "Nothing needs you right now. Keep applying to build your pipeline."}
                </p>
              ) : (
                <ul className="-mx-2 mt-3 divide-y divide-slate-100">
                  {planItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigate(item.action.path)}
                        className="w-full rounded-lg px-2 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium text-slate-900">{item.title}</div>
                        <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.why}</div>
                        <div className="mt-1.5 text-xs font-medium text-cyan-700">{item.action.label} →</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
