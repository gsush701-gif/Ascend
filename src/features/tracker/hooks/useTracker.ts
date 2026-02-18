import { useEffect, useState } from "react";
import type {
  TrackerItem,
  TrackerStatus,
  SavedReportSnapshot,
} from "../../../types/tracker";
import { LS_KEY } from "../../../types/tracker";

function loadTrackerFromStorage(): TrackerItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
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
    navigateToTracker: () => void,
    reportSnapshot?: SavedReportSnapshot,
    options?: { company?: string; role?: string }
  ) {
    const c = (options?.company ?? company).trim() || "Unknown company";
    const r = (options?.role ?? role).trim() || "Unknown role";
    setTrackerError(null);

    const item: TrackerItem = {
      id: crypto.randomUUID(),
      company: c,
      role: r,
      status: "Wishlist",
      alignment: reportAlignment ?? reportSnapshot?.alignment ?? 0,
      createdAt: new Date().toISOString(),
      nextStep: (nextStep || "Apply").trim(),
      reportSnapshot: reportSnapshot ?? undefined,
    };

    const newList = [item, ...tracker];
    setTracker(newList);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(newList));
    } catch {}
    setCompany("");
    setRole("");
    setNextStep("Apply today");
    navigateToTracker();
  }

  function removeItem(id: string) {
    setTracker((prev) => prev.filter((x) => x.id !== id));
  }

  function updateStatus(id: string, status: TrackerStatus) {
    setTracker((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status } : x))
    );
  }

  function updateNextStep(id: string, next: string) {
    setTracker((prev) =>
      prev.map((x) => (x.id === id ? { ...x, nextStep: next } : x))
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
  };
}
