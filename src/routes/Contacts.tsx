import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";
import { ContactCard } from "../components/contacts/ContactCard";
import { ContactFormModal } from "../components/contacts/ContactFormModal";
import { useContacts, type ContactInput } from "../features/contacts/hooks/useContacts";
import {
  filterAndSortContacts,
  type ContactSortKey,
  type ContactFilterKey,
} from "../features/contacts/filterContacts";
import type { Contact } from "../types/contacts";
import { toast } from "../components/ui/toast";
import { pageHeader, pageTitle, pageSubtitle, pageHeaderActions, card } from "../lib/ui";

export function Contacts() {
  const { contacts, loading, addContact, updateContact, removeContact } = useContacts();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<ContactSortKey>("nextFollowUp");
  const [filter, setFilter] = useState<ContactFilterKey>("all");

  const filteredAndSorted = useMemo(
    () => filterAndSortContacts(contacts, { searchQuery, filter, sortKey }),
    [contacts, searchQuery, sortKey, filter]
  );

  function openAddModal() {
    setEditingContact(null);
    setModalOpen(true);
  }

  function openEditModal(contact: Contact) {
    setEditingContact(contact);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingContact(null);
  }

  function handleSubmit(input: ContactInput) {
    if (editingContact) {
      updateContact(editingContact.id, input);
      toast.success({ title: "Contact updated", groupId: "contact-update" });
    } else {
      addContact(input);
      toast.success({ title: "Contact added", description: input.name });
    }
    closeModal();
  }

  function handleDelete(contact: Contact) {
    if (window.confirm(`Remove ${contact.name} from your contacts?`)) {
      removeContact(contact.id);
      toast.success({ title: "Contact removed" });
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Contacts</h1>
            <p className={pageSubtitle}>
              Recruiters, referrals, and networking contacts — with follow-up reminders.
            </p>
          </div>
          <div className={pageHeaderActions}>
            <Button onClick={openAddModal}>Add contact</Button>
          </div>
        </div>

        {contacts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search contacts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={filter}
              onChange={(v) => setFilter(v as ContactFilterKey)}
              options={[
                { value: "all", label: "All contacts" },
                { value: "overdue", label: "Overdue follow-ups" },
                { value: "upcoming", label: "Upcoming (7 days)" },
              ]}
            />
            <Select
              value={sortKey}
              onChange={(v) => setSortKey(v as ContactSortKey)}
              options={[
                { value: "nextFollowUp", label: "Sort: Next follow-up" },
                { value: "name", label: "Sort: Name" },
                { value: "company", label: "Sort: Company" },
                { value: "lastContact", label: "Sort: Last contact" },
              ]}
            />
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${card} h-40 animate-pulse`} />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            title="Add your first contact"
            subtitle="Track recruiters, referrals, and networking contacts — and never miss a follow-up."
            bullets={["Log who you've spoken to", "Set follow-up reminders", "See everything in one place"]}
            primaryAction={{ label: "Add contact", onClick: openAddModal }}
          />
        ) : filteredAndSorted.length === 0 ? (
          <div className={`${card} py-12 text-center text-sm text-slate-500`}>
            No contacts match your filters.
          </div>
        ) : (
          <div className="animate-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSorted.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onEdit={() => openEditModal(c)}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </div>
        )}
      </div>

      <ContactFormModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initial={editingContact}
      />
    </AppShell>
  );
}
