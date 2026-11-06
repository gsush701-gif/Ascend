/**
 * Shown when a request is taking longer than a few seconds. On the free hosting
 * tier the first request after a quiet spell is slow because the server is
 * waking up, so say that plainly instead of leaving a spinner that looks stuck.
 */
export function WakingNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-live="polite">
      <div className="h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-500" />
      </div>
      <p className="text-xs text-slate-500">
        Waking the server up. The first request after a quiet spell can take up to a minute, and it is quick
        after that. Please keep this page open.
      </p>
    </div>
  );
}
