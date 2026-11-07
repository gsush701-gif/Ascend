import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../lib/apiError";
import { Button } from "../ui/Button";

const MAX = 2000;

/**
 * A "Feedback" control that opens a one-box form. It is a small tab fixed to the
 * bottom-left corner by default (the AI advisor sits bottom-right), or, with
 * `variant="sidebar"`, a row in the left sidebar whose form opens above it.
 * Works signed out too, so testers on the public /try page can use it; a
 * signed-in sender is tied to their account by the token, an anonymous one can
 * leave an email if they want a reply.
 */
export function FeedbackButton({
  className = "",
  variant = "floating",
}: {
  className?: string;
  variant?: "floating" | "sidebar";
}) {
  const inSidebar = variant === "sidebar";
  const { session } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    // Start fresh next time, but keep a draft the person hasn't sent.
    if (sent) {
      setSent(false);
      setMessage("");
      setEmail("");
    }
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || message.trim().length < 3) return;
    setSending(true);
    setError(null);
    try {
      const token = session?.access_token;
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message,
          email: token ? undefined : email || undefined,
          page: pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Couldn't send your feedback. Please try again."));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your feedback. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={inSidebar ? `relative ${className}` : `fixed bottom-4 left-4 z-30 sm:bottom-6 sm:left-6 ${className}`}>
      {open && (
        <form
          onSubmit={submit}
          className={
            inSidebar
              ? "absolute bottom-full left-0 z-50 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
              : "mb-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          }
          aria-label="Send feedback"
        >
          {sent ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Thank you, that helps.</p>
              <p className="text-xs text-slate-500">Every message is read by the person building Ascend.</p>
              <Button type="button" variant="secondary" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <label htmlFor="feedback-message" className="text-sm font-semibold text-slate-900">
                  What was confusing or missing?
                </label>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close feedback"
                  className="text-slate-400 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
              <textarea
                id="feedback-message"
                ref={boxRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                rows={4}
                placeholder="Anything at all, even a few words."
                className="w-full resize-y rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
              {!session && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email, only if you want a reply"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button type="submit" variant="primary" size="sm" disabled={sending || message.trim().length < 3}>
                {sending ? "Sending…" : "Send feedback"}
              </Button>
            </div>
          )}
        </form>
      )}
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={
          inSidebar
            ? "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            : "btn-press rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        }
      >
        {inSidebar && <MessageSquare className="h-[18px] w-[18px] shrink-0 text-slate-400" />}
        Feedback
      </button>
    </div>
  );
}
