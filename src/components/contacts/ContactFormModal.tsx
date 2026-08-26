import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { card } from "../../lib/ui";
import { cn } from "../../lib/cn";
import { RELATIONSHIP_OPTIONS, SOURCE_OPTIONS, type Contact } from "../../types/contacts";
import type { ContactInput } from "../../features/contacts/hooks/useContacts";

type FormState = {
  name: string;
  company: string;
  title: string;
  email: string;
  linkedinUrl: string;
  relationship: string;
  source: string;
  notes: string;
  lastContactAt: string;
  nextFollowUpAt: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  company: "",
  title: "",
  email: "",
  linkedinUrl: "",
  relationship: "",
  source: "",
  notes: "",
  lastContactAt: "",
  nextFollowUpAt: "",
};

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

type ContactFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ContactInput) => void;
  initial?: Contact | null;
};

export function ContactFormModal({ isOpen, onClose, onSubmit, initial }: ContactFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setForm(
      initial
        ? {
            name: initial.name,
            company: initial.company ?? "",
            title: initial.title ?? "",
            email: initial.email ?? "",
            linkedinUrl: initial.linkedinUrl ?? "",
            relationship: initial.relationship ?? "",
            source: initial.source ?? "",
            notes: initial.notes ?? "",
            lastContactAt: toDateInputValue(initial.lastContactAt),
            nextFollowUpAt: toDateInputValue(initial.nextFollowUpAt),
          }
        : EMPTY_FORM
    );
    const t = setTimeout(() => nameRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen, initial]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      nameRef.current?.focus();
      return;
    }
    setError(null);
    onSubmit({
      name: form.name,
      company: form.company || undefined,
      title: form.title || undefined,
      email: form.email || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      relationship: form.relationship || undefined,
      source: form.source || undefined,
      notes: form.notes || undefined,
      lastContactAt: form.lastContactAt || undefined,
      nextFollowUpAt: form.nextFollowUpAt || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-form-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl animate-modal-content",
          card
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="contact-form-title" className="text-lg font-semibold text-slate-900">
            {initial ? "Edit contact" : "Add contact"}
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
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <datalist id="contact-relationships">
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <datalist id="contact-sources">
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <Input
            ref={nameRef}
            placeholder="Name *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Company"
              autoComplete="organization"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
            />
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <Input
              type="url"
              placeholder="LinkedIn URL"
              value={form.linkedinUrl}
              onChange={(e) => set("linkedinUrl", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              list="contact-relationships"
              placeholder="Relationship (e.g. Recruiter)"
              value={form.relationship}
              onChange={(e) => set("relationship", e.target.value)}
            />
            <Input
              list="contact-sources"
              placeholder="Source (e.g. LinkedIn)"
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Last contact</span>
              <Input
                type="date"
                value={form.lastContactAt}
                onChange={(e) => set("lastContactAt", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Next follow-up</span>
              <Input
                type="date"
                value={form.nextFollowUpAt}
                onChange={(e) => set("nextFollowUpAt", e.target.value)}
              />
            </label>
          </div>
          <Textarea
            placeholder="Notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
          <Button type="submit" className="w-full">
            {initial ? "Save changes" : "Add contact"}
          </Button>
        </form>
      </div>
    </div>
  );
}
