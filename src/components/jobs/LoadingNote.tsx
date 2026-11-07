import { useEffect, useState } from "react";
import { WakingNotice } from "../ui/WakingNotice";

/**
 * A line of status above the grey placeholder cards, so a blank-looking list reads
 * as "working on it" and says what is being loaded. If it is still going after a
 * few seconds the free server is probably waking up, so it says so.
 */
export function LoadingNote({ label }: { label: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
        <span
          className="spinner inline-block h-4 w-4 rounded-full border-2 border-cyan-500 border-t-transparent"
          aria-hidden
        />
        {label}
      </div>
      {slow && <WakingNotice />}
    </div>
  );
}
