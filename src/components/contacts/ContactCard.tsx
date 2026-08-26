import { Building2, Mail, Linkedin, Calendar, Pencil, Trash2, Sparkles } from "lucide-react";
import { card, badge } from "../../lib/ui";
import { cn } from "../../lib/cn";
import type { Contact } from "../../types/contacts";

function isOverdue(dateIso?: string) {
  if (!dateIso) return false;
  return new Date(dateIso).getTime() <= Date.now();
}

/**
 * Formats the calendar date the user picked, independent of the viewer's
 * timezone. Date-only values (e.g. "2026-08-20") are parsed as UTC per the
 * ECMAScript spec, so formatting with `toLocaleDateString` directly would
 * shift the displayed day backwards for any viewer west of UTC. Reading the
 * Y-M-D components and building a local `Date` from them avoids that shift.
 */
function formatDate(dateIso?: string) {
  if (!dateIso) return null;
  const [y, m, d] = dateIso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type ContactCardProps = {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
  onGenerateEmail: () => void;
};

export function ContactCard({ contact, onEdit, onDelete, onGenerateEmail }: ContactCardProps) {
  const overdue = isOverdue(contact.nextFollowUpAt);

  return (
    <div className={cn(card, "animate-fade-in flex flex-col gap-3")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{contact.name}</h3>
          {(contact.title || contact.company) && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {[contact.title, contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onGenerateEmail}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-cyan-500/10 hover:text-cyan-600"
            aria-label={`Generate outreach message for ${contact.name}`}
            title="Generate outreach message"
          >
            <Sparkles size={14} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-900/[0.06] hover:text-slate-900"
            aria-label={`Edit ${contact.name}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600"
            aria-label={`Delete ${contact.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {contact.relationship && <span className={cn(badge, "w-fit")}>{contact.relationship}</span>}

      {(contact.email || contact.linkedinUrl || contact.source) && (
        <div className="space-y-1.5 text-xs text-slate-500">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 transition hover:text-slate-700"
            >
              <Mail size={12} className="shrink-0" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 transition hover:text-slate-700"
            >
              <Linkedin size={12} className="shrink-0" />
              <span className="truncate">LinkedIn profile</span>
            </a>
          )}
          {contact.source && (
            <div className="flex items-center gap-1.5">
              <Building2 size={12} className="shrink-0" />
              <span className="truncate">via {contact.source}</span>
            </div>
          )}
        </div>
      )}

      {contact.notes && <p className="line-clamp-2 text-xs text-slate-500">{contact.notes}</p>}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
        <span className="truncate text-slate-400">
          {contact.lastContactAt
            ? `Last contact: ${formatDate(contact.lastContactAt)}`
            : "No contact logged"}
        </span>
        {contact.nextFollowUpAt && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 font-medium",
              overdue ? "text-rose-600" : "text-slate-600"
            )}
          >
            <Calendar size={12} />
            {formatDate(contact.nextFollowUpAt)}
          </span>
        )}
      </div>
    </div>
  );
}
