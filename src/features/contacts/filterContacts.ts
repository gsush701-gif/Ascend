import type { Contact } from "../../types/contacts";

export type ContactSortKey = "nextFollowUp" | "name" | "company" | "lastContact";
export type ContactFilterKey = "all" | "overdue" | "upcoming";

/**
 * Pure filter/sort helper, kept outside the route component so the
 * `Date.now()` read used for "overdue"/"upcoming" comparisons lives in a
 * plain module (mirrors the existing `src/lib/dashboardStats.ts` pattern)
 * rather than directly inside a component's render body.
 */
export function filterAndSortContacts(
  contacts: Contact[],
  opts: { searchQuery: string; filter: ContactFilterKey; sortKey: ContactSortKey },
  now: number = Date.now()
): Contact[] {
  const q = opts.searchQuery.trim().toLowerCase();
  const upcomingCutoff = now + 7 * 24 * 60 * 60 * 1000;

  let list = contacts.filter((c) => {
    if (q) {
      const match =
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (opts.filter === "overdue") {
      if (!c.nextFollowUpAt || new Date(c.nextFollowUpAt).getTime() > now) return false;
    }
    if (opts.filter === "upcoming") {
      if (!c.nextFollowUpAt) return false;
      const t = new Date(c.nextFollowUpAt).getTime();
      if (t < now || t > upcomingCutoff) return false;
    }
    return true;
  });

  list = [...list].sort((a, b) => {
    switch (opts.sortKey) {
      case "name":
        return a.name.localeCompare(b.name);
      case "company":
        return (a.company ?? "").localeCompare(b.company ?? "");
      case "lastContact": {
        const at = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
        const bt = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
        return bt - at;
      }
      case "nextFollowUp":
      default: {
        // Contacts with a follow-up date sort soonest-first; contacts with
        // none sort to the bottom.
        const at = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
        const bt = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
        return at - bt;
      }
    }
  });

  return list;
}
