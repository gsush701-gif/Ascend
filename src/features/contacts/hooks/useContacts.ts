import { useEffect, useState } from "react";
import type { Contact } from "../../../types/contacts";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

type ContactRow = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship: string | null;
  source: string | null;
  notes: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactInput = {
  name: string;
  company?: string;
  title?: string;
  email?: string;
  linkedinUrl?: string;
  relationship?: string;
  source?: string;
  notes?: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
};

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? undefined,
    title: row.title ?? undefined,
    email: row.email ?? undefined,
    linkedinUrl: row.linkedin_url ?? undefined,
    relationship: row.relationship ?? undefined,
    source: row.source ?? undefined,
    notes: row.notes ?? undefined,
    lastContactAt: row.last_contact_at ?? undefined,
    nextFollowUpAt: row.next_follow_up_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Trims/normalizes a ContactInput into the shape both local state and the DB patch need. */
function normalize(input: ContactInput) {
  return {
    name: input.name.trim(),
    company: input.company?.trim() || undefined,
    title: input.title?.trim() || undefined,
    email: input.email?.trim() || undefined,
    linkedinUrl: input.linkedinUrl?.trim() || undefined,
    relationship: input.relationship?.trim() || undefined,
    source: input.source?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    lastContactAt: input.lastContactAt || undefined,
    nextFollowUpAt: input.nextFollowUpAt || undefined,
  };
}

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setContacts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("contacts")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useContacts] load failed:", error);
          setContactsError(error.message);
          setLoading(false);
          return;
        }
        setContacts(((data as ContactRow[] | null) ?? []).map(rowToContact));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function addContact(input: ContactInput) {
    if (!user) {
      setContactsError("You must be logged in to add a contact.");
      return;
    }
    const n = normalize(input);
    if (!n.name) {
      setContactsError("Name is required.");
      return;
    }
    setContactsError(null);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const contact: Contact = { id, ...n, createdAt: now, updatedAt: now };

    setContacts((prev) => [contact, ...prev]);

    supabase
      .from("contacts")
      .insert({
        id,
        user_id: user.id,
        name: n.name,
        company: n.company ?? null,
        title: n.title ?? null,
        email: n.email ?? null,
        linkedin_url: n.linkedinUrl ?? null,
        relationship: n.relationship ?? null,
        source: n.source ?? null,
        notes: n.notes ?? null,
        last_contact_at: n.lastContactAt ?? null,
        next_follow_up_at: n.nextFollowUpAt ?? null,
        created_at: now,
        updated_at: now,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[useContacts] insert failed:", error);
          setContactsError(error.message);
        }
      });
  }

  function updateContact(id: string, input: ContactInput) {
    const n = normalize(input);
    if (!n.name) {
      setContactsError("Name is required.");
      return;
    }
    setContactsError(null);
    const now = new Date().toISOString();

    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...n, updatedAt: now } : c))
    );
    if (!user) return;

    supabase
      .from("contacts")
      .update({
        name: n.name,
        company: n.company ?? null,
        title: n.title ?? null,
        email: n.email ?? null,
        linkedin_url: n.linkedinUrl ?? null,
        relationship: n.relationship ?? null,
        source: n.source ?? null,
        notes: n.notes ?? null,
        last_contact_at: n.lastContactAt ?? null,
        next_follow_up_at: n.nextFollowUpAt ?? null,
        updated_at: now,
      })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useContacts] update failed:", error);
          setContactsError(error.message);
        }
      });
  }

  function removeContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (!user) return;
    supabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useContacts] delete failed:", error);
          setContactsError(error.message);
        }
      });
  }

  return {
    contacts,
    loading,
    contactsError,
    setContactsError,
    addContact,
    updateContact,
    removeContact,
  };
}
