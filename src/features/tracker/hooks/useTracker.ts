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
  created_at: string;
  updated_at: string;
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
  };
}

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
  };
}
