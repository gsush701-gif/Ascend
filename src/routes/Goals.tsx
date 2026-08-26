import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { GoalCard } from "../components/goals/GoalCard";
import { GoalFormModal } from "../components/goals/GoalFormModal";
import { useCareerGoals } from "../features/goals/hooks/useCareerGoals";
import { useTracker } from "../features/tracker/hooks/useTracker";
import type { CareerGoal, CareerGoalInput } from "../types/goals";
import { toast } from "../components/ui/toast";
import { pageHeader, pageTitle, pageSubtitle, pageHeaderActions, card } from "../lib/ui";

export function Goals() {
  const { goals, loading, addGoal, updateGoal, removeGoal } = useCareerGoals();
  const tracker = useTracker(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CareerGoal | null>(null);

  function openAddModal() {
    setEditingGoal(null);
    setModalOpen(true);
  }

  function openEditModal(goal: CareerGoal) {
    setEditingGoal(goal);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingGoal(null);
  }

  function handleSubmit(input: CareerGoalInput) {
    if (editingGoal) {
      updateGoal(editingGoal.id, input);
      toast.success({ title: "Goal updated" });
    } else {
      addGoal(input);
      toast.success({ title: "Goal added", description: input.title });
    }
    closeModal();
  }

  function handleDelete(goal: CareerGoal) {
    if (window.confirm(`Delete the goal "${goal.title}"?`)) {
      removeGoal(goal.id);
      toast.success({ title: "Goal deleted" });
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Career goals</h1>
            <p className={pageSubtitle}>
              Set targets and see real progress, computed from your tracked roles.
            </p>
          </div>
          <div className={pageHeaderActions}>
            <Button onClick={openAddModal}>Add goal</Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${card} h-40 animate-pulse`} />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            title="Set your first career goal"
            subtitle="Track applications, interviews, and offers against a target — progress is computed from the roles you already track, never guessed."
            bullets={[
              "e.g. \"Get a SWE internship\"",
              "Optional target date and counts",
              "Progress updates automatically as you apply",
            ]}
            primaryAction={{ label: "Add goal", onClick: openAddModal }}
          />
        ) : (
          <div className="animate-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                items={tracker.tracker}
                onEdit={() => openEditModal(g)}
                onDelete={() => handleDelete(g)}
              />
            ))}
          </div>
        )}
      </div>

      <GoalFormModal isOpen={modalOpen} onClose={closeModal} onSubmit={handleSubmit} initial={editingGoal} />
    </AppShell>
  );
}
