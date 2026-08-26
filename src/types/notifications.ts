export type AppNotification = {
  id: string;
  /** e.g. "follow_up" — free-form, matches the `notifications.type` text column. */
  type: string;
  title: string;
  message?: string;
  read: boolean;
  relatedContactId?: string;
  createdAt: string;
};
