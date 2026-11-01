// "Before you apply" checklist for one tracked role, worked out from what's
// already saved on it. The steps are the ones that actually move an application
// forward: know your gaps, close the required ones, write the cover letter,
// practise the interview, set a deadline. Pure so it is tested.

import { TRACKER_STATUS_ORDER, type TrackerItem } from "../../types/tracker";

export type ReadinessKey = "analyzed" | "gaps" | "coverLetter" | "interview" | "deadline" | "applied";

export type ReadinessItem = {
  key: ReadinessKey;
  label: string;
  done: boolean;
  /** One line shown under an unfinished step. */
  hint: string;
};

export function getReadiness(item: TrackerItem): ReadinessItem[] {
  const snap = item.reportSnapshot;
  const missingRequired = (snap?.skills ?? []).filter(
    (s) => s.status === "miss" && (s.importance ?? "required") === "required",
  ).length;

  const appliedIndex = TRACKER_STATUS_ORDER.indexOf("Applied");
  const hasApplied = TRACKER_STATUS_ORDER.indexOf(item.status) >= appliedIndex;

  return [
    {
      key: "analyzed",
      label: "Checked your fit",
      done: Boolean(snap),
      hint: "Run the analysis to see how your resume matches this posting.",
    },
    {
      key: "gaps",
      label: "Covered the required skills",
      done: Boolean(snap) && missingRequired === 0,
      hint: snap
        ? `${missingRequired} required skill${missingRequired === 1 ? "" : "s"} still missing from your resume.`
        : "Needs an analysis first.",
    },
    {
      key: "coverLetter",
      label: "Drafted a cover letter",
      done: Boolean(item.coverLetter?.trim()),
      hint: "Generate one from this job description, then make it yours.",
    },
    {
      key: "interview",
      label: "Practised interview questions",
      done: Boolean(item.interviewPrep),
      hint: "Get questions based on this posting and rehearse your answers.",
    },
    {
      key: "deadline",
      label: "Set a deadline",
      done: Boolean(item.deadline?.trim() || item.deadlineAt),
      hint: "Pick the date you want this application in by.",
    },
    {
      key: "applied",
      label: "Submitted the application",
      done: hasApplied,
      hint: "Mark it Applied once you've sent it, and note a follow-up.",
    },
  ];
}

export function readinessProgress(items: ReadinessItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
