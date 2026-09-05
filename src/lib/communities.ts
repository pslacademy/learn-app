// src/lib/communities.ts
//
// The one place any screen asks a community question.
//
// Everything here is for display only. It decides what to draw, never what a
// member may have. The database refuses regardless, so a person editing these
// values in the console changes what their own screen shows and gains nothing:
// the lesson rows, the video URLs, the events and the resources simply do not
// come back.
//
// No component may compare a community slug as a string literal. If a screen
// finds itself writing `slug === "ypa"`, it has taken a wrong turn: ask this
// module instead, and let the database be the authority.

import { supabase } from "./supabase";

export interface Community {
  id: string;
  slug: string;
  name: string;
  is_free: boolean;
  sort_order: number;
}

/**
 * A short-lived cache.
 *
 * Filled from the server's answer, not from anything the browser decided.
 * Short enough that a community bought minutes ago appears without a reload,
 * long enough that a listing does not ask the same question once per card.
 */
const TTL_MS = 60 * 1000;

let communitiesCache: { at: number; rows: Community[] } | null = null;
let memberCache: { at: number; ids: string[] } | null = null;
let courseCache: { at: number; map: Map<string, string[]> } | null = null;

/** Call after anything that could change what a member holds, such as a sync. */
export const clearCommunityCache = () => {
  communitiesCache = null;
  memberCache = null;
  courseCache = null;
};

/** Every active community, for labels. Includes ones the member is not in. */
export const allCommunities = async (): Promise<Community[]> => {
  if (communitiesCache && Date.now() - communitiesCache.at < TTL_MS) {
    return communitiesCache.rows;
  }

  const { data, error } = await supabase
    .from("communities")
    .select("id, slug, name, is_free, sort_order")
    .order("sort_order");

  if (error) {
    console.error("Could not read communities:", error.message);
    return communitiesCache?.rows ?? [];
  }

  const rows = (data ?? []) as Community[];
  communitiesCache = { at: Date.now(), rows };
  return rows;
};

/**
 * The communities this member is in.
 *
 * Asks the database's own function rather than reading member_communities
 * directly, so the free community is included by exactly the same rule the
 * policies use. Two implementations of "which communities" would eventually
 * disagree, and the disagreement would show up as a member seeing a course
 * they cannot open.
 */
export const memberCommunityIds = async (): Promise<string[]> => {
  if (memberCache && Date.now() - memberCache.at < TTL_MS) {
    return memberCache.ids;
  }

  const { data, error } = await supabase.rpc("my_community_ids");

  if (error) {
    console.error("Could not read your communities:", error.message);
    return memberCache?.ids ?? [];
  }

  // The function returns a set of uuids, which arrives as an array of values.
  const ids = (data ?? []).map((row: unknown) =>
    typeof row === "string" ? row : (row as { my_community_ids: string }).my_community_ids,
  );

  memberCache = { at: Date.now(), ids };
  return ids;
};

/** The member's own communities, with names, in display order. */
export const myCommunities = async (): Promise<Community[]> => {
  const [all, mine] = await Promise.all([allCommunities(), memberCommunityIds()]);
  const held = new Set(mine);
  return all.filter((c) => held.has(c.id));
};

/** A community's display name. Falls back to the id rather than to a blank. */
export const communityName = async (id: string): Promise<string> => {
  const all = await allCommunities();
  return all.find((c) => c.id === id)?.name ?? id;
};

/**
 * May this member open this course?
 *
 * Used to decide whether to draw a card, never to decide whether to send the
 * video. A course the member does not own is simply absent from their
 * listing: no lock icon, no teaser, no upgrade prompt.
 */
export const canAccessCourse = async (courseId: string): Promise<boolean> => {
  if (!courseCache || Date.now() - courseCache.at >= TTL_MS) {
    const { data, error } = await supabase
      .from("course_communities")
      .select("course_id, community_id");

    if (error) {
      console.error("Could not read course communities:", error.message);
      return false;
    }

    const map = new Map<string, string[]>();
    for (const row of data ?? []) {
      const list = map.get(row.course_id) ?? [];
      list.push(row.community_id);
      map.set(row.course_id, list);
    }
    courseCache = { at: Date.now(), map };
  }

  const needed = courseCache.map.get(courseId);

  // A course attached to no community is reachable by nobody. That is the
  // safe direction: a half-built course is invisible rather than briefly
  // open to everyone.
  if (!needed || needed.length === 0) return false;

  const mine = new Set(await memberCommunityIds());
  return needed.some((id) => mine.has(id));
};

/**
 * May this member see this event?
 *
 * An event with no communities named is for all members, which includes the
 * free community, because everyone signed in is in it. An event naming a
 * community that no longer exists is hidden, never shown: an unrecognised
 * value must never widen access.
 */
export const canAccessEvent = async (event: {
  community_ids?: string[] | null;
}): Promise<boolean> => {
  const named = event.community_ids ?? [];
  if (named.length === 0) return true;

  const mine = new Set(await memberCommunityIds());
  return named.some((id) => mine.has(id));
};
