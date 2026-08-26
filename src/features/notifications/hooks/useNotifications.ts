import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "../../../types/notifications";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  related_contact_id: string | null;
  created_at: string;
};

type DueContactRow = {
  id: string;
  name: string;
  company: string | null;
  next_follow_up_at: string | null;
};

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message ?? undefined,
    read: row.read,
    relatedContactId: row.related_contact_id ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Checks contacts whose `next_follow_up_at` is due (today or in the past) and
 * creates a "follow_up" notification for any that don't already have one for
 * this occurrence (dedup rule: a prior notification for that contact created
 * at/after the due date counts as already-notified; if the follow-up date is
 * later pushed further out, a fresh notification will be created when it
 * becomes due again).
 *
 * IMPORTANT: this is a load-time check, not a real scheduler/cron. It only
 * runs when this hook mounts (i.e. when a logged-in user loads a page that
 * renders the notifications bell) — there is no background job, so a due
 * follow-up won't produce a notification until the user's next page load.
 */
async function checkDueFollowUps(
  userId: string,
  existing: AppNotification[]
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data: dueContacts, error: contactsErr } = await supabase
    .from("contacts")
    .select("id, name, company, next_follow_up_at")
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", nowIso);

  if (contactsErr) {
    console.error("[useNotifications] due-contact check failed:", contactsErr);
    return false;
  }
  if (!dueContacts || dueContacts.length === 0) return false;

  const rows = (dueContacts as DueContactRow[]).flatMap((c) => {
    if (!c.next_follow_up_at) return [];
    const dueAt = new Date(c.next_follow_up_at).getTime();
    const latestForContact = existing
      .filter((n) => n.type === "follow_up" && n.relatedContactId === c.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const alreadyNotified =
      latestForContact && new Date(latestForContact.createdAt).getTime() >= dueAt;
    if (alreadyNotified) return [];
    return [
      {
        id: crypto.randomUUID(),
        user_id: userId,
        type: "follow_up",
        title: `Follow up with ${c.name}`,
        message: c.company
          ? `Your planned follow-up with ${c.name} at ${c.company} is due.`
          : `Your planned follow-up with ${c.name} is due.`,
        read: false,
        related_contact_id: c.id,
        created_at: new Date().toISOString(),
      },
    ];
  });

  if (rows.length === 0) return false;

  const { error: insertErr } = await supabase.from("notifications").insert(rows);
  if (insertErr) {
    console.error("[useNotifications] create due-follow-up notifications failed:", insertErr);
    return false;
  }
  return true;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (): Promise<AppNotification[]> => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[useNotifications] load failed:", error);
      setNotificationsError(error.message);
      return [];
    }
    const rows = ((data as NotificationRow[] | null) ?? []).map(rowToNotification);
    setNotifications(rows);
    return rows;
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const existing = await loadNotifications();
      if (cancelled) return;
      setLoading(false);

      // Load-time due-follow-up sweep — see checkDueFollowUps() doc comment.
      const created = await checkDueFollowUps(user.id, existing);
      if (created && !cancelled) {
        await loadNotifications();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (!user) return;
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useNotifications] markRead failed:", error);
          setNotificationsError(error.message);
        }
      });
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (!user) return;
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false)
      .then(({ error }) => {
        if (error) {
          console.error("[useNotifications] markAllRead failed:", error);
          setNotificationsError(error.message);
        }
      });
  }

  function removeNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!user) return;
    supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[useNotifications] delete failed:", error);
          setNotificationsError(error.message);
        }
      });
  }

  return {
    notifications,
    unreadCount,
    loading,
    notificationsError,
    markRead,
    markAllRead,
    removeNotification,
  };
}
