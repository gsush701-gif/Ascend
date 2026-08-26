import { useEffect, useState } from "react";
import type {
  TrackerItem,
  TrackerStatus,
  SavedReportSnapshot,
  RolePriority,
} from "../../../types/tracker";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

type RoleRow = {
  id: string;
  company: string;
  role: string;
  status: TrackerStatus;
  alignment: number;
  next_step: string | null;
  job_description: string | null;
  notes: string | null;
  deadline: string | null;
  priority: RolePriority | null;
  report_snapshot: SavedReportSnapshot | null;
  cover_letter: string | null;
  interview_prep: TrackerItem["interviewPrep"] | null;
  created_at: string;
  updated_at: string;
  // Phase 2b "application details" columns (all nullable/additive).
  job_id: string | null;
  resume_id: string | null;
  job_url: string | null;
  source: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  sponsorship: string | null;
  recruiter_name: string | null;
  recruiter_email: string | null;
  recruiter_linkedin: string | null;
  application_url: string | null;
  referral: boolean | null;
  deadline_at: string | null;
  applied_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
  rejection_at: string | null;
  follow_up_at: string | null;
};

function rowToItem(row: RoleRow): TrackerItem {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    alignment: row.alignment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextStep: row.next_step ?? "",
    reportSnapshot: row.report_snapshot ?? undefined,
    notes: row.notes ?? undefined,
    deadline: row.deadline ?? undefined,
    priority: row.priority ?? undefined,
    jobDescription: row.job_description ?? undefined,
    coverLetter: row.cover_letter ?? undefined,
    interviewPrep: row.interview_prep ?? undefined,
    jobId: row.job_id ?? undefined,
    resumeId: row.resume_id ?? undefined,
    jobUrl: row.job_url ?? undefined,
    source: row.source ?? undefined,
    location: row.location ?? undefined,
    remoteType: row.remote_type ?? undefined,
    employmentType: row.employment_type ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    salaryCurrency: row.salary_currency ?? undefined,
    sponsorship: row.sponsorship ?? undefined,
    recruiterName: row.recruiter_name ?? undefined,
    recruiterEmail: row.recruiter_email ?? undefined,
    recruiterLinkedin: row.recruiter_linkedin ?? undefined,
    applicationUrl: row.application_url ?? undefined,
    referral: row.referral ?? false,
    deadlineAt: row.deadline_at ?? undefined,
    appliedAt: row.applied_at ?? undefined,
    interviewAt: row.interview_at ?? undefined,
    offerAt: row.offer_at ?? undefined,
    rejectionAt: row.rejection_at ?? undefined,
    followUpAt: row.follow_up_at ?? undefined,
  };
}

/** Maps the new Phase 2b TrackerItem fields to their snake_case DB columns.
 * Used only by updateRoleFields (the generic setter) — the pre-existing
 * fields keep their own dedicated updateX functions below. */
const APPLICATION_DETAIL_COLUMNS: Partial<Record<keyof TrackerItem, string>> = {
  jobId: "job_id",
  resumeId: "resume_id",
  jobUrl: "job_url",
  source: "source",
  location: "location",
  remoteType: "remote_type",
  employmentType: "employment_type",
  salaryMin: "salary_min",
  salaryMax: "salary_max",
  salaryCurrency: "salary_currency",
  sponsorship: "sponsorship",
  recruiterName: "recruiter_name",
  recruiterEmail: "recruiter_email",
  recruiterLinkedin: "recruiter_linkedin",
  applicationUrl: "application_url",
  referral: "referral",
  deadlineAt: "deadline_at",
  appliedAt: "applied_at",
  interviewAt: "interview_at",
  offerAt: "offer_at",
  rejectionAt: "rejection_at",
  followUpAt: "follow_up_at",
};

function touchUpdatedAt(x: TrackerItem): TrackerItem {
  return { ...x, updatedAt: new Date().toISOString() };
}

export function useTracker(reportAlignment: number | undefined) {
  const { user } = useAuth();
  const [tracker, setTracker] = useState<TrackerItem[]>([]);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [nextStep, setNextStep] = useState("Apply today");
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [trackerFilter, setTrackerFilter] = useState<
    "All" | "Applied" | "Interview"
  >("All");

  useEffect(() => {
    if (!user) {
      setTracker([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("roles")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useTracker] load failed:", error);
          setTrackerError(error.message);
          return;
        }
        setTracker(((data as RoleRow[] | null) ?? []).map(rowToItem));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Optimistically apply a local patch, then persist to Supabase in the background. */
  function applyUpdate(
    id: string,
    patch: Partial<TrackerItem>,
    dbPatch: Record<string, unknown>,
  ) {
    setTracker((prev) =>
      prev.map((x) => (x.id === id ? touchUpdatedAt({ ...x, ...patch }) : x)),
    );
    if (!user) return;
    supabase
      .from("roles")
      .update({ ...dbPatch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useTracker] update failed:", error);
          setTrackerError(error.message);
        }
      });
  }

  function addManualTrackerItem(
    onAdded: (newItemId: string) => void,
    reportSnapshot?: SavedReportSnapshot,
    options?: {
      company?: string;
      role?: string;
      status?: TrackerStatus;
      nextStep?: string;
      jobDescription?: string;
      notes?: string;
    },
  ) {
    if (!user) {
      setTrackerError("You must be logged in to add a role.");
      return;
    }

    const c = (options?.company ?? company).trim() || "Unknown company";
    const r = (options?.role ?? role).trim() || "Unknown role";
    const status = options?.status ?? "Wishlist";
    const next = (options?.nextStep ?? (nextStep || "Apply")).trim();
    setTrackerError(null);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const alignment = reportAlignment ?? reportSnapshot?.alignment ?? 0;
    const jobDescription = options?.jobDescription?.trim() || undefined;
    const notes = options?.notes?.trim() || undefined;

    const item: TrackerItem = {
      id,
      company: c,
      role: r,
      status,
      alignment,
      createdAt: now,
      updatedAt: now,
      nextStep: next,
      reportSnapshot: reportSnapshot ?? undefined,
      jobDescription,
      notes,
    };

    setTracker((prev) => [item, ...prev]);
    setCompany("");
    setRole("");
    setNextStep("Apply today");
    onAdded(id);

    supabase
      .from("roles")
      .insert({
        id,
        user_id: user.id,
        company: c,
        role: r,
        status,
        alignment,
        next_step: next,
        job_description: jobDescription ?? null,
        notes: notes ?? null,
        report_snapshot: reportSnapshot ?? null,
        created_at: now,
        updated_at: now,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[useTracker] insert failed:", error);
          setTrackerError(error.message);
        }
      });
  }

  function removeItem(id: string) {
    setTracker((prev) => prev.filter((x) => x.id !== id));
    if (!user) return;
    supabase
      .from("roles")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useTracker] delete failed:", error);
          setTrackerError(error.message);
        }
      });
  }

  function updateStatus(id: string, status: TrackerStatus) {
    applyUpdate(id, { status }, { status });
  }

  function updateNextStep(id: string, next: string) {
    applyUpdate(id, { nextStep: next }, { next_step: next });
  }

  function updateNotes(id: string, notes: string) {
    applyUpdate(id, { notes }, { notes });
  }

  function updateRole(id: string, roleValue: string) {
    const trimmed = roleValue.trim();
    if (!trimmed) return;
    applyUpdate(id, { role: trimmed }, { role: trimmed });
  }

  function updateCompany(id: string, companyValue: string) {
    const trimmed = companyValue.trim();
    if (!trimmed) return;
    applyUpdate(id, { company: trimmed }, { company: trimmed });
  }

  function updateDeadline(id: string, deadline: string) {
    const trimmed = deadline.trim();
    applyUpdate(
      id,
      { deadline: trimmed || undefined },
      { deadline: trimmed || null },
    );
  }

  function updatePriority(id: string, priority: RolePriority | "") {
    applyUpdate(
      id,
      { priority: priority || undefined },
      { priority: priority || null },
    );
  }

  function updateCoverLetter(id: string, coverLetter: string) {
    applyUpdate(id, { coverLetter }, { cover_letter: coverLetter });
  }

  function updateInterviewPrep(id: string, interviewPrep: TrackerItem["interviewPrep"]) {
    applyUpdate(id, { interviewPrep }, { interview_prep: interviewPrep ?? null });
  }

  /**
   * Generic setter for the Phase 2b "application details" fields (job URL,
   * location, salary, recruiter contact, milestone dates, etc). Avoids an
   * unwieldy explosion of near-identical updateX functions for ~20 fields;
   * follows the same optimistic-update, RLS-scoped pattern as applyUpdate.
   * Only fields present in APPLICATION_DETAIL_COLUMNS are persisted —
   * anything else is silently ignored to avoid accidentally writing to an
   * unmapped column.
   */
  function updateRoleFields(id: string, fields: Partial<TrackerItem>) {
    const dbPatch: Record<string, unknown> = {};
    (Object.keys(fields) as (keyof TrackerItem)[]).forEach((key) => {
      const column = APPLICATION_DETAIL_COLUMNS[key];
      if (!column) return;
      const value = fields[key];
      dbPatch[column] = value === "" || value === undefined ? null : value;
    });
    applyUpdate(id, fields, dbPatch);
  }

  function updateReportSnapshot(id: string, snapshot: SavedReportSnapshot) {
    applyUpdate(
      id,
      { alignment: snapshot.alignment, reportSnapshot: snapshot },
      { alignment: snapshot.alignment, report_snapshot: snapshot },
    );
  }

  return {
    tracker,
    company,
    setCompany,
    role,
    setRole,
    nextStep,
    setNextStep,
    trackerError,
    setTrackerError,
    trackerFilter,
    setTrackerFilter,
    addManualTrackerItem,
    removeItem,
    updateStatus,
    updateNextStep,
    updateNotes,
    updateRole,
    updateCompany,
    updateDeadline,
    updatePriority,
    updateReportSnapshot,
    updateCoverLetter,
    updateInterviewPrep,
    updateRoleFields,
  };
}
