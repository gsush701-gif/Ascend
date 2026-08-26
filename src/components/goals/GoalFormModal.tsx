import { useEffect, useRef, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import type { CareerGoal, CareerGoalInput } from "../../types/goals";

type FormState = {
  title: string;
  targetDate: string;
  applicationsTarget: string;
  interviewsTarget: string;
  offersTarget: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  targetDate: "",
  applicationsTarget: "",
  interviewsTarget: "",
  offersTarget: "",
};

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

type GoalFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CareerGoalInput) => void;
  initial?: CareerGoal | null;
};

export function GoalFormModal({ isOpen, onClose, onSubmit, initial }: GoalFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setForm(
      initial
        ? {
            title: initial.title,
            targetDate: toDateInputValue(initial.targetDate),
            applicationsTarget: initial.applicationsTarget?.toString() ?? "",
            interviewsTarget: initial.interviewsTarget?.toString() ?? "",
            offersTarget: initial.offersTarget?.toString() ?? "",
          }
        : EMPTY_FORM
    );
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [isOpen, initial]);

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setError("Give your goal a title.");
      return;
    }
    const toNum = (v: string) => (v.trim() === "" ? undefined : Number(v));
    onSubmit({
      title: form.title.trim(),
      targetDate: form.targetDate || undefined,
      applicationsTarget: toNum(form.applicationsTarget),
      interviewsTarget: toNum(form.interviewsTarget),
      offersTarget: toNum(form.offersTarget),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit goal" : "New goal"}>
      <div className="mt-4 space-y-4">
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div>
          <label className="block text-xs text-slate-500">Goal title</label>
          <Input
            ref={titleRef}
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Get a SWE internship"
            className="mt-1"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Target date (optional)</label>
          <Input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-500">Applications target</label>
            <Input
              type="number"
              min="0"
              value={form.applicationsTarget}
              onChange={(e) => setForm((f) => ({ ...f, applicationsTarget: e.target.value }))}
              placeholder="e.g. 50"
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Interviews target</label>
            <Input
              type="number"
              min="0"
              value={form.interviewsTarget}
              onChange={(e) => setForm((f) => ({ ...f, interviewsTarget: e.target.value }))}
              placeholder="e.g. 5"
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Offers target</label>
            <Input
              type="number"
              min="0"
              value={form.offersTarget}
              onChange={(e) => setForm((f) => ({ ...f, offersTarget: e.target.value }))}
              placeholder="e.g. 1"
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit}>
            {initial ? "Save changes" : "Add goal"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
