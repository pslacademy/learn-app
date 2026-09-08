// src/lib/notifications.ts
//
// The bell in the header.
//
// Rows are never written from here. They are created by notify_for_comment
// and notify_for_post in the database, which work out who to tell from the
// post itself rather than being told by the browser. If the client could
// insert, anybody could put anything into anybody else's bell, and a
// notification is trusted precisely because it was not asked for.

import { supabase } from "./supabase";

export interface Notification {
  id: string;
  kind: "reply" | "mention" | "message";
  post_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  /** Copied at the time, so an old notification still reads sensibly. */
  actor_name: string | null;
  excerpt: string | null;
  read_at: string | null;
  created_at: string;
}

export const getNotifications = async (limit = 20): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Could not read notifications:", error.message);
    return [];
  }
  return (data ?? []) as Notification[];
};

export const unreadCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return error ? 0 : (count ?? 0);
};

export const markAllRead = async (): Promise<void> => {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
};

/**
 * Ask the database to notify whoever should hear about a comment.
 *
 * Never allowed to fail the comment itself. The member has said their piece,
 * and a notification that did not go out must not make it look otherwise. The
 * failure is logged rather than shown, because there is nothing they could do
 * about it.
 *
 * supabase.rpc reports failure by returning an error rather than throwing, so
 * a try/catch alone would see nothing and report success.
 */
export const notifyForComment = async (commentId: string): Promise<void> => {
  try {
    const { error } = await supabase.rpc("notify_for_comment", {
      p_comment_id: commentId,
    });
    if (error) console.warn("Notifications for comment failed:", error.message);
  } catch (e) {
    console.warn("Notifications for comment threw:", String(e));
  }
};

export const notifyForPost = async (postId: string): Promise<void> => {
  try {
    const { error } = await supabase.rpc("notify_for_post", {
      p_post_id: postId,
    });
    if (error) console.warn("Notifications for post failed:", error.message);
  } catch (e) {
    console.warn("Notifications for post threw:", String(e));
  }
};

/** Where the bell should take you. */
export const notificationHref = (n: Notification): string =>
  n.post_id ? `/community?space=questions` : "/community";

export const notificationLine = (n: Notification): string => {
  const who = n.actor_name ?? "Somebody";
  if (n.kind === "reply") return `${who} replied to your post`;
  if (n.kind === "mention") return `${who} mentioned you`;
  return `${who} sent you a message`;
};
