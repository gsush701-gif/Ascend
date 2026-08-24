import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { toast, subscribeToToasts, getToastDuration } from "./toast";

type ToastEntry = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
  createdAt: number;
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES = {
  success:
    "border-cyan-500/40 bg-[#FFFFFF]/95 backdrop-blur-md text-cyan-700 shadow-lg shadow-cyan-500/5 hover:shadow-cyan-500/10",
  error:
    "border-rose-500/40 bg-[#FFFFFF]/95 backdrop-blur-md text-rose-700 shadow-lg shadow-rose-500/5 hover:shadow-rose-500/10",
  info:
    "border-slate-300 bg-[#FFFFFF]/95 backdrop-blur-md text-slate-800 shadow-lg shadow-black/10 hover:shadow-black/[0.08]",
};

const ICON_COLORS = {
  success: "text-cyan-600",
  error: "text-rose-600",
  info: "text-slate-600",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    return subscribeToToasts(setToasts);
  }, []);

  return (
    <>
      {children}
      {toasts.length > 0 && (
        <div
          role="region"
          aria-label="Notifications"
          className="fixed right-4 top-20 z-[9999] flex max-w-sm flex-col gap-3"
          style={{ pointerEvents: "auto" }}
        >
          <AnimatePresence mode="popLayout">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

function ToastItem({ toast: t }: { toast: ToastEntry }) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = getToastDuration();

  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        toast.dismiss(t.id);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [t.id, paused, duration]);

  const barWidth = progress;
  const Icon = ICONS[t.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") toast.dismiss(t.id);
      }}
      className={`group flex min-w-[300px] max-w-sm cursor-default flex-col overflow-hidden rounded-xl border transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#F4F5FA] ${STYLES[t.type]}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={`shrink-0 rounded-full p-0.5 ${ICON_COLORS[t.type]}`}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900/95">{t.title}</div>
          {t.description && (
            <div className="mt-0.5 text-sm text-slate-500">{t.description}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-900/[0.06] hover:text-slate-700 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-slate-900/[0.04]">
        <motion.div
          className={`h-full ${
            t.type === "success"
              ? "bg-cyan-500"
              : t.type === "error"
                ? "bg-rose-500"
                : "bg-slate-400"
          }`}
          initial={{ width: "100%" }}
          animate={{ width: `${barWidth}%` }}
          transition={paused ? { duration: 0 } : { duration: 0.05 }}
        />
      </div>
    </motion.div>
  );
}
