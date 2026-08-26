import { useEffect, useState } from "react";
import type { CareerGoal, CareerGoalInput } from "../../../types/goals";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

type CareerGoalRow = {
  id: string;
  title: string;
  target_date: string | null;
  applications_target: number | null;
  interviews_target: number | null;
  offers_target: number | null;
  created_at: string;
  updated_at: string;
};

function rowToGoal(row: CareerGoalRow): CareerGoal {
  return {
    id: row.id,
    title: row.title,
    targetDate: row.target_date ?? undefined,
    applicationsTarget: row.applications_target ?? undefined,
    interviewsTarget: row.interviews_target ?? undefined,
    offersTarget: row.offers_target ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Trims/normalizes a CareerGoalInput into the shape both local state and the DB patch need. */
function normalize(input: CareerGoalInput) {
  return {
    title: input.title.trim(),
    targetDate: input.targetDate || undefined,
    applicationsTarget:
      input.applicationsTarget !== undefined && Number.isFinite(input.applicationsTarget)
        ? input.applicationsTarget
        : undefined,
    interviewsTarget:
      input.interviewsTarget !== undefined && Number.isFinite(input.interviewsTarget)
        ? input.interviewsTarget
        : undefined,
    offersTarget:
      input.offersTarget !== undefined && Number.isFinite(input.offersTarget)
        ? input.offersTarget
        : undefined,
  };
}

/**
 * RLS-scoped direct-Supabase CRUD hook for `career_goals`, following the same
 * optimistic-update pattern as useContacts.ts/useTracker.ts. Goals never
 * store computed progress — that's always derived live from the user's real
 * `roles` data (see src/features/goals/progress.ts).
 */
export function useCareerGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<CareerGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("career_goals")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useCareerGoals] load failed:", error);
          setGoalsError(error.message);
          setLoading(false);
          return;
        }
        setGoals(((data as CareerGoalRow[] | null) ?? []).map(rowToGoal));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function addGoal(input: CareerGoalInput) {
    if (!user) {
      setGoalsError("You must be logged in to add a goal.");
      return;
    }
    const n = normalize(input);
    if (!n.title) {
      setGoalsError("Title is required.");
      return;
    }
    setGoalsError(null);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const goal: CareerGoal = { id, ...n, createdAt: now, updatedAt: now };

    setGoals((prev) => [goal, ...prev]);

    supabase
      .from("career_goals")
      .insert({
        id,
        user_id: user.id,
        title: n.title,
        target_date: n.targetDate ?? null,
        applications_target: n.applicationsTarget ?? null,
        interviews_target: n.interviewsTarget ?? null,
        offers_target: n.offersTarget ?? null,
        created_at: now,
        updated_at: now,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[useCareerGoals] insert failed:", error);
          setGoalsError(error.message);
        }
      });
  }

  function updateGoal(id: string, input: CareerGoalInput) {
    const n = normalize(input);
    if (!n.title) {
      setGoalsError("Title is required.");
      return;
    }
    setGoalsError(null);
    const now = new Date().toISOString();

    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...n, updatedAt: now } : g))
    );
    if (!user) return;

    supabase
      .from("career_goals")
      .update({
        title: n.title,
        target_date: n.targetDate ?? null,
        applications_target: n.applicationsTarget ?? null,
        interviews_target: n.interviewsTarget ?? null,
        offers_target: n.offersTarget ?? null,
        updated_at: now,
      })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useCareerGoals] update failed:", error);
          setGoalsError(error.message);
        }
      });
  }

  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (!user) return;
    supabase
      .from("career_goals")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useCareerGoals] delete failed:", error);
          setGoalsError(error.message);
        }
      });
  }

  return {
    goals,
    loading,
    goalsError,
    setGoalsError,
    addGoal,
    updateGoal,
    removeGoal,
  };
}
