// src/lib/messages.ts
//
// Direct messages.
//
// Three rules, all enforced by the database rather than here: you may write
// to somebody only if you share a community, only if they have direct
// messages turned on, and only as yourself. This file asks and reports.
//
// Where it hides the composer, that is a courtesy to save somebody typing
// something that would be refused. It is not what stops them.

import { supabase } from "./supabase";
import { spaceMemberIds } from "./community";
import { memberCommunityIds } from "./communities";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  avatar_url: string | null;
  allow_messaging: boolean;
  /** The most recent message either way, for the list. */
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
}

export const contactName = (c: Pick<Contact, "first_name" | "last_name">) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ") || "A member";

export const contactInitials = (c: Pick<Contact, "first_name" | "last_name">) =>
  `${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}` || "?";

/**
 * Everyone you could hold a conversation with.
 *
 * The people in your communities, whether or not they have messaging on:
 * somebody who has turned it off still appears, greyed, with the reason
 * given. Hiding them would look like they had left.
 *
 * The team is in several communities, so this is the union of them all.
 */
export const listContacts = async (): Promise<Contact[]> => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return [];

  const communities = await memberCommunityIds();
  const lists = await Promise.all(communities.map((id) => spaceMemberIds(id)));

  const ids = [...new Set(lists.flat())].filter((id) => id !== me);
  if (ids.length === 0) return [];

  const [{ data: people }, { data: messages }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, title, avatar_url, allow_messaging")
      .in("id", ids),
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const rows = (people ?? []) as Omit<
    Contact,
    "lastMessage" | "lastAt" | "unread"
  >[];

  return rows
    .map((p) => {
      const thread = (messages ?? []).filter(
        (m) =>
          (m.sender_id === me && m.receiver_id === p.id) ||
          (m.sender_id === p.id && m.receiver_id === me),
      );
      const latest = thread[0];

      return {
        ...p,
        lastMessage: latest?.body ?? null,
        lastAt: latest?.created_at ?? null,
        unread: thread.filter(
          (m) => m.receiver_id === me && m.read_at === null,
        ).length,
      };
    })
    .sort((a, b) => {
      /* Conversations first, newest at the top; then everybody else by name.
         A list ordered purely alphabetically buries the person who just
         wrote to you. */
      if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
      if (a.lastAt) return -1;
      if (b.lastAt) return 1;
      return contactName(a).localeCompare(contactName(b));
    });
};

export const listThread = async (otherId: string): Promise<Message[]> => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${me},receiver_id.eq.${otherId}),` +
        `and(sender_id.eq.${otherId},receiver_id.eq.${me})`,
    )
    .order("created_at");

  if (error) {
    console.error("Could not read the conversation:", error.message);
    return [];
  }
  return (data ?? []) as Message[];
};

export const sendMessage = async (
  receiverId: string,
  body: string,
): Promise<{ error: string | null }> => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return { error: "You are not signed in." };

  const { error } = await supabase.from("messages").insert({
    sender_id: me,
    receiver_id: receiverId,
    body: body.trim(),
  });

  if (!error) return { error: null };

  /*
    The database refuses a message to somebody who has messaging off, and the
    error it gives is about a policy. Translated here, because "new row
    violates row-level security policy" tells the member nothing they can act
    on.
  */
  const denied = /row-level security|policy/i.test(error.message);
  return {
    error: denied
      ? "That member is not accepting direct messages at the moment."
      : error.message,
  };
};

/** Mark everything they sent me as read. */
export const markThreadRead = async (otherId: string): Promise<void> => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherId)
    .eq("receiver_id", me)
    .is("read_at", null);
};

export const unreadTotal = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return error ? 0 : (count ?? 0);
};
