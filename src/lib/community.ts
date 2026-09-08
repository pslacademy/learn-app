// src/lib/community.ts
//
// Community spaces.
//
// One space per community, three channels in each. What comes back is what
// the member is allowed to receive: a post from a community they are not in
// never arrives, so nothing here filters for access.
//
// Who may post in Announcements, who may pin, and whose media survives are
// all decided by the database. This file asks and reports; it does not
// enforce. Where it hides a control, that is a courtesy to save somebody
// pressing a button that would be refused.

import { supabase } from "./supabase";

export type Channel = "announcements" | "questions" | "wins";

export const CHANNELS: { value: Channel; label: string; blurb: string }[] = [
  {
    value: "announcements",
    label: "Announcements",
    blurb: "News and updates from the team.",
  },
  {
    value: "questions",
    label: "Ask a Question",
    blurb: "Ask the group. Somebody has usually been there before.",
  },
  {
    value: "wins",
    label: "Share a Win",
    blurb: "Something went well. Say so.",
  },
];

export interface Author {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_editor: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  edited_at: string | null;
  author: Author | null;
  hearts: number;
  hearted: boolean;
}

export interface Post {
  id: string;
  community_id: string;
  channel: Channel;
  author_id: string;
  content: string;
  media_url: string | null;
  is_pinned: boolean;
  created_at: string;
  edited_at: string | null;
  author: Author | null;
  hearts: number;
  hearted: boolean;
  comments: Comment[];
}

/**
 * Authors, fetched separately.
 *
 * profiles is filtered by row for the directory, so a member of another
 * community would come back empty here. The team can read every profile, and
 * ordinary members only ever see posts from their own space, so in practice
 * every author of every post they can see is a profile they can read. Where
 * one is missing the post still renders, attributed to "A member", rather
 * than vanishing.
 */
const fetchAuthors = async (ids: string[]): Promise<Map<string, Author>> => {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, title, avatar_url, is_admin, is_editor")
    .in("id", unique);

  return new Map((data ?? []).map((a) => [a.id as string, a as Author]));
};

/** Every post in one space and channel, pinned first, newest next. */
export const listPosts = async (
  communityId: string,
  channel: Channel,
): Promise<Post[]> => {
  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("community_id", communityId)
    .eq("channel", channel)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not read the space:", error.message);
    return [];
  }

  const postIds = (posts ?? []).map((p) => p.id as string);
  if (postIds.length === 0) return [];

  const [{ data: comments }, { data: reactions }, { data: session }] =
    await Promise.all([
      supabase
        .from("community_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at"),
      supabase
        .from("community_reactions")
        .select("member_id, post_id, comment_id"),
      supabase.auth.getSession(),
    ]);

  const me = session?.session?.user?.id ?? null;

  const authors = await fetchAuthors([
    ...(posts ?? []).map((p) => p.author_id as string),
    ...(comments ?? []).map((c) => c.author_id as string),
  ]);

  /*
    Counted from the rows rather than from a stored total. A running count on
    the post would need keeping in step with every insert and delete, and the
    day it slipped nobody would notice, because a wrong number looks exactly
    like a right one.
  */
  const heartsFor = (key: "post_id" | "comment_id", id: string) => {
    const rows = (reactions ?? []).filter((r) => r[key] === id);
    return {
      hearts: rows.length,
      hearted: me ? rows.some((r) => r.member_id === me) : false,
    };
  };

  const commentsByPost = new Map<string, Comment[]>();
  for (const c of comments ?? []) {
    const list = commentsByPost.get(c.post_id as string) ?? [];
    list.push({
      ...(c as Omit<Comment, "author" | "hearts" | "hearted">),
      author: authors.get(c.author_id as string) ?? null,
      ...heartsFor("comment_id", c.id as string),
    });
    commentsByPost.set(c.post_id as string, list);
  }

  return (posts ?? []).map((p) => ({
    ...(p as Omit<Post, "author" | "hearts" | "hearted" | "comments">),
    author: authors.get(p.author_id as string) ?? null,
    ...heartsFor("post_id", p.id as string),
    comments: commentsByPost.get(p.id as string) ?? [],
  }));
};

export const createPost = async (
  communityId: string,
  channel: Channel,
  content: string,
  mediaUrl?: string,
) => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return { error: "Not signed in." };

  const { error } = await supabase.from("community_posts").insert({
    community_id: communityId,
    channel,
    author_id: me,
    content: content.trim(),
    media_url: mediaUrl?.trim() || null,
  });

  return { error: error?.message ?? null };
};

export const editPost = async (id: string, content: string) => {
  const { error } = await supabase
    .from("community_posts")
    .update({ content: content.trim() })
    .eq("id", id);
  return { error: error?.message ?? null };
};

export const deletePost = async (id: string) => {
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  return { error: error?.message ?? null };
};

export const setPinned = async (id: string, pinned: boolean) => {
  const { error } = await supabase
    .from("community_posts")
    .update({ is_pinned: pinned })
    .eq("id", id);
  return { error: error?.message ?? null };
};

export const createComment = async (
  postId: string,
  content: string,
  mediaUrl?: string,
) => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return { error: "Not signed in." };

  const { error } = await supabase.from("community_comments").insert({
    post_id: postId,
    author_id: me,
    content: content.trim(),
    media_url: mediaUrl?.trim() || null,
  });
  return { error: error?.message ?? null };
};

export const deleteComment = async (id: string) => {
  const { error } = await supabase.from("community_comments").delete().eq("id", id);
  return { error: error?.message ?? null };
};

/** Heart, or unheart. One row per person per thing, so this is a toggle. */
export const toggleHeart = async (
  target: { postId?: string; commentId?: string },
  currentlyHearted: boolean,
) => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return { error: "Not signed in." };

  if (currentlyHearted) {
    let q = supabase.from("community_reactions").delete().eq("member_id", me);
    q = target.postId
      ? q.eq("post_id", target.postId)
      : q.eq("comment_id", target.commentId ?? "");
    const { error } = await q;
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from("community_reactions").insert({
    member_id: me,
    post_id: target.postId ?? null,
    comment_id: target.commentId ?? null,
  });
  return { error: error?.message ?? null };
};

/**
 * How to show a media link.
 *
 * Decided from the file extension, because that is all we know: the URL is
 * pasted in by hand and never inspected. An unrecognised link becomes a plain
 * link rather than an empty player, which is the honest failure.
 */
export const mediaKind = (url: string | null): "video" | "image" | "link" | null => {
  if (!url) return null;
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(clean)) return "image";
  return "link";
};

export const authorName = (a: Author | null): string =>
  a ? [a.first_name, a.last_name].filter(Boolean).join(" ") || "A member" : "A member";

export const authorInitials = (a: Author | null): string =>
  a ? `${a.first_name?.[0] ?? ""}${a.last_name?.[0] ?? ""}` || "?" : "?";

/**
 * Who is in this space, for the @ menu.
 *
 * Only names that the database will actually match. Offering somebody the
 * composer cannot notify would be worse than offering nobody: they would type
 * the name, see it accepted, and assume the person had been told.
 *
 * The team can read every profile, so this is filtered to the space rather
 * than to what the reader happens to be able to see.
 */
/**
 * Who is in this space.
 *
 * The free community holds no rows: everyone with no paid community is in it.
 * So its membership is everybody who is not in one of the others, and that
 * has to be worked out rather than read.
 *
 * Used by the @ menu and by the directory, so the two can never disagree
 * about who is in a room.
 */
export const spaceMemberIds = async (communityId: string): Promise<string[]> => {
  /*
    Asked of the database, not worked out here.

    A member may only read their own row of member_communities, so computing
    this in the browser gave a member a list containing only themselves: the @
    menu offered them their own name and nobody else, while the team saw
    everybody. The database can answer safely because it can check first
    whether the caller may read that space at all.
  */
  const { data, error } = await supabase.rpc("space_member_ids", {
    p_community: communityId,
  });

  if (error) {
    console.error("Could not read the space's members:", error.message);
    return [];
  }

  return (data ?? []).map((row: unknown) =>
    typeof row === "string" ? row : (row as { space_member_ids: string }).space_member_ids,
  );
};

/**
 * Who may be mentioned here.
 *
 * Only names the database will actually notify. Offering somebody the
 * composer cannot notify is worse than offering nobody: the writer would type
 * the name, see it accepted, and assume the person had been told.
 */
export const spaceMembers = async (communityId: string): Promise<Author[]> => {
  const ids = await spaceMemberIds(communityId);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, title, avatar_url, is_admin, is_editor")
    .in("id", ids);

  return (data ?? []) as Author[];
};

export interface DirectoryMember extends Author {
  location: string | null;
  bio: string | null;
}

/**
 * The directory for one space.
 *
 * Filtered to that community explicitly rather than left to row level
 * security. The policy answers "may I see this person", which for an admin is
 * everybody, so relying on it showed the same list under every community.
 */
export const communityDirectory = async (
  communityId: string,
): Promise<DirectoryMember[]> => {
  const ids = await spaceMemberIds(communityId);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, title, avatar_url, is_admin, is_editor, location, bio, show_in_directory",
    )
    .in("id", ids)
    .order("first_name");

  /* A member who opted out is hidden from everyone, including the team.
     Being listed is their decision, not an administrative one. */
  return ((data ?? []) as (DirectoryMember & { show_in_directory: boolean })[])
    .filter((m) => m.show_in_directory)
    .map(({ show_in_directory: _drop, ...m }) => m);
};
