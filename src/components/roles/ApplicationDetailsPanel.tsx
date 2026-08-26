import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Panel } from "../ui/Panel";
import type { TrackerItem } from "../../types/tracker";

const fieldInputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none";

const fieldLabelClass = "block text-xs text-slate-500";

/** ISO datetime/date string -> value an <input type="date"> understands. */
function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      {children}
    </label>
  );
}

type ApplicationDetailsPanelProps = {
  item: TrackerItem;
  updateRoleFields: (id: string, fields: Partial<TrackerItem>) => void;
};

/**
 * Collapsible panel for the Phase 2b "application details" fields: job
 * posting metadata, recruiter contact, salary/sponsorship, referral, and
 * real typed milestone dates. Collapsed by default so the drawer/detail page
 * isn't overwhelming for users who don't fill these in — most of this is
 * genuinely optional. Every field writes through updateRoleFields, which
 * follows the same optimistic-update, RLS-scoped pattern as the rest of
 * useTracker.ts.
 */
export function ApplicationDetailsPanel({
  item,
  updateRoleFields,
}: ApplicationDetailsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const set = <K extends keyof TrackerItem>(key: K, value: TrackerItem[K]) => {
    updateRoleFields(item.id, { [key]: value } as Partial<TrackerItem>);
  };

  const setText = (key: keyof TrackerItem) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const v = e.target.value;
    set(key, (v.trim() ? v : undefined) as never);
  };

  const setNumber = (key: keyof TrackerItem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    set(key, (v === "" ? undefined : Number(v)) as never);
  };

  const setDate = (key: keyof TrackerItem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    set(key, (v || undefined) as never);
  };

  return (
    <Panel
      title="Application details"
      subtitle="Optional — job posting, recruiter contact, and key dates."
      right={
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-900/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Show more details"}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      }
    >
      {expanded && (
        <div className="animate-fade-in space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Job posting URL">
              <input
                type="url"
                value={item.jobUrl ?? ""}
                onChange={setText("jobUrl")}
                placeholder="https://..."
                className={fieldInputClass}
              />
            </Field>
            <Field label="Application URL">
              <input
                type="url"
                value={item.applicationUrl ?? ""}
                onChange={setText("applicationUrl")}
                placeholder="https://..."
                className={fieldInputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Location">
              <input
                type="text"
                value={item.location ?? ""}
                onChange={setText("location")}
                placeholder="e.g. San Francisco, CA"
                className={fieldInputClass}
              />
            </Field>
            <Field label="Source">
              <input
                type="text"
                value={item.source ?? ""}
                onChange={setText("source")}
                placeholder="e.g. LinkedIn, referral"
                className={fieldInputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Remote type">
              <select
                value={item.remoteType ?? ""}
                onChange={setText("remoteType")}
                className={fieldInputClass}
              >
                <option value="">—</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Onsite">Onsite</option>
              </select>
            </Field>
            <Field label="Employment type">
              <select
                value={item.employmentType ?? ""}
                onChange={setText("employmentType")}
                className={fieldInputClass}
              >
                <option value="">—</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Salary min">
              <input
                type="number"
                value={item.salaryMin ?? ""}
                onChange={setNumber("salaryMin")}
                placeholder="e.g. 80000"
                className={fieldInputClass}
              />
            </Field>
            <Field label="Salary max">
              <input
                type="number"
                value={item.salaryMax ?? ""}
                onChange={setNumber("salaryMax")}
                placeholder="e.g. 110000"
                className={fieldInputClass}
              />
            </Field>
            <Field label="Currency">
              <input
                type="text"
                value={item.salaryCurrency ?? ""}
                onChange={setText("salaryCurrency")}
                placeholder="USD"
                className={fieldInputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sponsorship">
              <select
                value={item.sponsorship ?? ""}
                onChange={setText("sponsorship")}
                className={fieldInputClass}
              >
                <option value="">—</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Unknown">Unknown</option>
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2.5">
              <input
                type="checkbox"
                checked={item.referral ?? false}
                onChange={(e) => set("referral", e.target.checked as never)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Referral</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Recruiter name">
              <input
                type="text"
                value={item.recruiterName ?? ""}
                onChange={setText("recruiterName")}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Recruiter email">
              <input
                type="email"
                value={item.recruiterEmail ?? ""}
                onChange={setText("recruiterEmail")}
                className={fieldInputClass}
              />
            </Field>
          </div>
          <Field label="Recruiter LinkedIn">
            <input
              type="url"
              value={item.recruiterLinkedin ?? ""}
              onChange={setText("recruiterLinkedin")}
              placeholder="https://linkedin.com/in/..."
              className={fieldInputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deadline">
              <input
                type="date"
                value={toDateInputValue(item.deadlineAt)}
                onChange={setDate("deadlineAt")}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Applied on">
              <input
                type="date"
                value={toDateInputValue(item.appliedAt)}
                onChange={setDate("appliedAt")}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Interview date">
              <input
                type="date"
                value={toDateInputValue(item.interviewAt)}
                onChange={setDate("interviewAt")}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Offer date">
              <input
                type="date"
                value={toDateInputValue(item.offerAt)}
                onChange={setDate("offerAt")}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Rejection date">
              <input
                type="date"
                value={toDateInputValue(item.rejectionAt)}
                onChange={setDate("rejectionAt")}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Follow-up date">
              <input
                type="date"
                value={toDateInputValue(item.followUpAt)}
                onChange={setDate("followUpAt")}
                className={fieldInputClass}
              />
            </Field>
          </div>
        </div>
      )}
    </Panel>
  );
}
