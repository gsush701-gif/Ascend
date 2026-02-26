import { useEffect, useState } from "react";
import type {
  TrackerItem,
  TrackerStatus,
  SavedReportSnapshot,
  RolePriority,
} from "../../../types/tracker";
import { LS_KEY } from "../../../types/tracker";

function loadTrackerFromStorage(): TrackerItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackerItem[];
    return parsed.map((x) => ({
      ...x,
      updatedAt: (x as TrackerItem & { updatedAt?: string }).updatedAt ?? x.createdAt,
    }));
  } catch {}
  return [];
}

export function useTracker(reportAlignment: number | undefined) {
  const [tracker, setTracker] = useState<TrackerItem[]>(loadTrackerFromStorage);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [nextStep, setNextStep] = useState("Apply today");
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [trackerFilter, setTrackerFilter] = useState<
    "All" | "Applied" | "Interview"
  >("All");

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(tracker));
    } catch {}
  }, [tracker]);

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
    }
  ) {
    const c = (options?.company ?? company).trim() || "Unknown company";
    const r = (options?.role ?? role).trim() || "Unknown role";
    const status = options?.status ?? "Wishlist";
    const next = (options?.nextStep ?? (nextStep || "Apply")).trim();
    setTrackerError(null);

    const now = new Date().toISOString();
    const item: TrackerItem = {
      id: crypto.randomUUID(),
      company: c,
      role: r,
      status,
      alignment: reportAlignment ?? reportSnapshot?.alignment ?? 0,
      createdAt: now,
      updatedAt: now,
      nextStep: next,
      reportSnapshot: reportSnapshot ?? undefined,
      jobDescription: options?.jobDescription?.trim() || undefined,
      notes: options?.notes?.trim() || undefined,
    };

    const newList = [item, ...tracker];
    setTracker(newList);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(newList));
    } catch {}
    setCompany("");
    setRole("");
    setNextStep("Apply today");
    onAdded(item.id);
  }

  function removeItem(id: string) {
    setTracker((prev) => prev.filter((x) => x.id !== id));
  }

  const touchUpdatedAt = (x: TrackerItem) =>
    ({ ...x, updatedAt: new Date().toISOString() });

  function updateStatus(id: string, status: TrackerStatus) {
    setTracker((prev) =>
      prev.map((x) => (x.id === id ? touchUpdatedAt({ ...x, status }) : x))
    );
  }

  function updateNextStep(id: string, next: string) {
    setTracker((prev) =>
      prev.map((x) => (x.id === id ? touchUpdatedAt({ ...x, nextStep: next }) : x))
    );
  }

  function updateNotes(id: string, notes: string) {
    setTracker((prev) =>
      prev.map((x) => (x.id === id ? touchUpdatedAt({ ...x, notes }) : x))
    );
  }

  function updateRole(id: string, role: string) {
    setTracker((prev) =>
      prev.map((x) =>
        x.id === id
          ? touchUpdatedAt({ ...x, role: role.trim() || x.role })
          : x
      )
    );
  }

  function updateCompany(id: string, company: string) {
    setTracker((prev) =>
      prev.map((x) =>
        x.id === id
          ? touchUpdatedAt({ ...x, company: company.trim() || x.company })
          : x
      )
    );
  }

  function updateDeadline(id: string, deadline: string) {
    setTracker((prev) =>
      prev.map((x) =>
        x.id === id
          ? touchUpdatedAt({ ...x, deadline: deadline.trim() || undefined })
          : x
      )
    );
  }

  function updatePriority(id: string, priority: RolePriority | "") {
    setTracker((prev) =>
      prev.map((x) =>
        x.id === id
          ? touchUpdatedAt({ ...x, priority: priority || undefined })
          : x
      )
    );
  }

  function updateReportSnapshot(id: string, snapshot: SavedReportSnapshot) {
    setTracker((prev) =>
      prev.map((x) =>
        x.id === id
          ? touchUpdatedAt({
              ...x,
              alignment: snapshot.alignment,
              reportSnapshot: snapshot,
            })
          : x
      )
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
