import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, FileText, MessageSquare, BarChart3, ChevronRight, Mic, Lock } from "lucide-react";
import { useFeatureAccess } from "../../features/featureAccess/useFeatureAccess";
import { alignmentToPreparedness } from "../../lib/preparedness";
import { Panel } from "../ui/Panel";
import type { TrackerItem } from "../../types/tracker";
import { isSpeechRecognitionSupported } from "../../features/voiceInterview/useSpeechRecognition";

type RoleDetailDrawerProps = {
  item: TrackerItem;
  onClose: () => void;
  updateDeadline: (id: string, deadline: string) => void;
  removeItem: (id: string) => void;
};

/**
 * Primary-action row used for Generate Cover Letter / Interview Prep /
 * Report — each navigates to its own dedicated page (see src/routes) rather
 * than duplicating that page's logic here.
 */
function ActionRow({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-press flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-left transition hover:border-cyan-500/40 hover:bg-slate-900/[0.06]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-700">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block truncate text-xs text-slate-500">{hint}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-slate-400" />
    </button>
  );
}

export function RoleDetailDrawer({ item, onClose, updateDeadline, removeItem }: RoleDetailDrawerProps) {
  const navigate = useNavigate();
  const alignment = item.reportSnapshot?.alignment ?? item.alignment;
  const voiceInterviewSupported = isSpeechRecognitionSupported();
  const { voiceInterview: voiceInterviewUnlocked } = useFeatureAccess();

  // Same free-text `deadline` field the Roles table and Dashboard's
  // "Upcoming deadlines" / "Overdue" pill already read (src/lib/
  // dashboardStats.ts) — this is the one place it's actually edited, via a
  // native date picker, one click to open + pick.
  const rawDeadline = item.deadline?.trim() ?? "";
  const parsedDeadline = rawDeadline ? new Date(rawDeadline) : null;
  const isValidDeadline = parsedDeadline != null && !Number.isNaN(parsedDeadline.getTime());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = isValidDeadline && parsedDeadline.getTime() < today.getTime();
  const deadlineInputValue = isValidDeadline ? parsedDeadline.toISOString().slice(0, 10) : "";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-full w-[400px] shrink-0 flex-col border-l border-slate-200 bg-[#FFFFFF] shadow-xl animate-drawer-slide-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-[#FFFFFF] px-4 py-3 pt-16">
        <h2 id="drawer-title" className="truncate text-base font-semibold text-slate-900">
          {item.role} at {item.company}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-900/[0.06] hover:text-slate-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{item.role}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.company}</p>
              <span className="mt-2 inline-flex rounded-md border border-slate-200 bg-slate-900/[0.04] px-2 py-0.5 text-xs font-medium text-slate-600">
                {item.status}
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-slate-900">
                {alignmentToPreparedness(alignment)}
              </div>
              <div className="text-xs text-slate-500">Preparedness</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <label htmlFor="drawer-deadline" className="text-xs font-medium text-slate-500">
              Deadline
              {isOverdue && (
                <span className="ml-1.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                  Overdue
                </span>
              )}
            </label>
            <input
              id="drawer-deadline"
              type="date"
              value={deadlineInputValue}
              onChange={(e) => updateDeadline(item.id, e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </Panel>

        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Actions
          </h3>
          <div className="space-y-2">
            <ActionRow
              icon={FileText}
              label="Generate cover letter"
              hint={item.coverLetter ? "View, edit, or regenerate your draft" : "AI-drafted from this role's job description"}
              onClick={() => goTo(`/roles/${item.id}/cover-letter`)}
            />
            <ActionRow
              icon={MessageSquare}
              label="Interview prep"
              hint={
                item.interviewPrep
                  ? `${item.interviewPrep.questions.length} questions generated`
                  : "AI mock interview questions for this role"
              }
              onClick={() => goTo(`/roles/${item.id}/interview-prep`)}
            />
            {voiceInterviewSupported &&
              (voiceInterviewUnlocked ? (
                <ActionRow
                  icon={Mic}
                  label="Voice interview practice"
                  hint="Practice out loud with live AI feedback"
                  onClick={() => goTo(`/roles/${item.id}/voice-interview`)}
                />
              ) : (
                <ActionRow
                  icon={Lock}
                  label="Voice interview practice"
                  hint="Upgrade to Pro"
                  onClick={() => goTo(`/roles/${item.id}/voice-interview`)}
                />
              ))}
            <ActionRow
              icon={BarChart3}
              label="Report"
              hint="Full details: fit, skill gaps, notes, and more"
              onClick={() => goTo(`/roles/${item.id}`)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (window.confirm("Remove this role from your list?")) {
              removeItem(item.id);
              onClose();
              navigate("/roles");
            }
          }}
          className="btn-press w-full rounded-xl border border-rose-300 bg-white py-2.5 px-4 text-sm font-semibold text-rose-600 transition hover:border-rose-500 hover:bg-rose-500 hover:text-white"
        >
          Remove role
        </button>
      </div>
    </aside>
  );
}
