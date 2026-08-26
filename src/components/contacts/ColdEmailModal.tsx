import { useEffect, useState } from "react";
import { Copy, Loader2, Mail } from "lucide-react";
import { Select } from "../ui/Select";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../lib/apiError";
import type { Contact } from "../../types/contacts";
import type { TrackerItem } from "../../types/tracker";

type ColdEmailModalProps = {
  contact: Contact | null;
  roles: TrackerItem[];
  onClose: () => void;
};

/**
 * "Generate outreach message" (Phase 6a Task 3) — lets the user optionally
 * ground the message in a specific tracked role, then shows the AI-drafted
 * message with a copy button. Only ever sends `contactId`/`roleId` to the
 * backend, which does its own ownership-checked lookup — no contact/role
 * content is read or sent from here.
 */
export function ColdEmailModal({ contact, roles, onClose }: ColdEmailModalProps) {
  const { session } = useAuth();
  const [roleId, setRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");

  useEffect(() => {
    setRoleId("");
    setLoading(false);
    setError(null);
    setMessage(null);
    setCopyLabel("Copy");
  }, [contact]);

  if (!contact) return null;

  async function runGenerate() {
    if (!contact) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate-cold-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ contactId: contact.id, ...(roleId ? { roleId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to generate outreach message"));
      setMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate outreach message");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!message) return;
    navigator.clipboard.writeText(message).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cold-email-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-[#FFFFFF] p-6 shadow-xl animate-modal-content">
        <h2 id="cold-email-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Mail className="h-5 w-5 text-cyan-600" />
          Outreach message for {contact.name}
        </h2>

        {!message && (
          <div className="mt-4 space-y-3">
            {roles.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Tailor to a tracked role (optional)
                </label>
                <Select
                  value={roleId}
                  onChange={setRoleId}
                  placeholder="No specific role"
                  options={[
                    { value: "", label: "No specific role" },
                    ...roles.map((r) => ({ value: r.id, label: `${r.role} at ${r.company}` })),
                  ]}
                />
              </div>
            )}
            <p className="text-xs text-slate-500">
              Drafted from {contact.name}&apos;s real profile info and your own profile — never a
              fabricated shared connection.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={runGenerate}
              disabled={loading}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 px-4 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {loading ? "Generating…" : "Generate message"}
            </button>
          </div>
        )}

        {message && (
          <div className="mt-4 animate-fade-in space-y-4">
            <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-900/[0.03] p-3 text-sm leading-relaxed text-slate-800">
              {message}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
              >
                <Copy size={14} />
                {copyLabel}
              </button>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="btn-press rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
              >
                Regenerate
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn-press mt-6 w-full rounded-lg border border-slate-300 bg-slate-900/[0.04] py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-900/[0.06]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
