import { useRef, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";
import type { TrackerItem } from "../types/tracker";
import { findDuplicateRole, formatDuplicateWarning } from "../features/tracker/duplicateDetection";

type QuickAddModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (company: string, role: string) => void;
  recentCompanies?: string[];
  recentRoles?: string[];
  /** Already-tracked roles, used to warn on a likely duplicate before adding. */
  existingItems?: TrackerItem[];
};

export function QuickAddModal({
  isOpen,
  onClose,
  onAdd,
  recentCompanies = [],
  recentRoles = [],
  existingItems = [],
}: QuickAddModalProps) {
  const companyRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      companyRef.current?.focus();
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const company = companyRef.current?.value?.trim() ?? "";
    const role = roleRef.current?.value?.trim() ?? "";
    if (!company) {
      setError("Company is required");
      companyRef.current?.focus();
      return;
    }
    if (!role) {
      setError("Role title is required");
      roleRef.current?.focus();
      return;
    }
    setError(null);

    const duplicate = findDuplicateRole(existingItems, { company, role });
    if (duplicate) {
      const proceed = window.confirm(
        `${formatDuplicateWarning(duplicate)}\n\nAdd it anyway?`
      );
      if (!proceed) return;
    }

    onAdd(company, role);
    companyRef.current!.value = "";
    roleRef.current!.value = "";
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={cn("relative w-full max-w-md p-6 shadow-xl animate-modal-content", card)}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="quick-add-title" className="text-lg font-semibold text-slate-900">
            Quick add
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-900/[0.06] hover:text-slate-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Log an application in seconds. Status = Applied.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {recentCompanies.length > 0 && (
            <datalist id="quick-add-companies">
              {recentCompanies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
          {recentRoles.length > 0 && (
            <datalist id="quick-add-roles">
              {recentRoles.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          )}
          <Input
            ref={companyRef}
            type="text"
            placeholder="Company *"
            autoComplete="organization"
            list={recentCompanies.length > 0 ? "quick-add-companies" : undefined}
          />
          <Input
            ref={roleRef}
            type="text"
            placeholder="Role title * (e.g. SWE Intern)"
            autoComplete="off"
            list={recentRoles.length > 0 ? "quick-add-roles" : undefined}
          />
          <Button type="submit" className="w-full">
            Add application
          </Button>
        </form>
      </div>
    </div>
  );
}
