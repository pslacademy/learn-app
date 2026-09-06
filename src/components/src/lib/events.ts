// src/lib/events.ts
//
// Events, and therefore replays.
//
// A replay is an event that has happened and has a recording. One record, one
// place to correct a title, one audience. Splitting them would mean entering
// every session twice and then having two versions of it that disagree.
//
// What comes back is what the member is allowed to receive. An event for a
// community they are not in never arrives, so nothing here filters for
// access: the database already did.

import { supabase } from "./supabase";
import type { Resource } from "./courses";
import {
  nextOccurrence,
  describeRecurrence,
  type RecurrenceRule,
  type RecurringLike,
} from "./recurrence";

export interface AcademyEvent extends RecurringLike {
  id: string;
  title: string;
  description: string | null;
  /** ISO date, e.g. 2026-09-26. */
  startDate: string;
  /** 24 hour, e.g. 09:30. */
  startTime: string;
  endTime: string | null;
  /** IANA name. The session's own timezone, not the member's. */
  timezone: string;
  location: string | null;
  eventType: string | null;
  imageUrl: string | null;
  /** Shown from five minutes before the start, never earlier. */
  joinUrl: string | null;
  isRecurring: boolean;
  /** undefined rather than null, to match RecurringLike. */
  recurrencePattern?: string;
  recurrence: RecurrenceRule | null;
  /** Set once the session has been recorded. This is what makes it a replay. */
  recordingUrl: string | null;
  resources: Resource[];
  isPublished: boolean;
  /** Empty means every signed-in member. */
  communityIds: string[];
}

type Row = Record<string, unknown>;

const fromRow = (r: Row, communityIds: string[]): AcademyEvent => ({
  id: r.id as string,
  title: r.title as string,
  description: (r.description as string) ?? null,
  startDate: r.start_date as string,
  // Postgres returns time as HH:MM:SS; the interface only ever wants HH:MM.
  startTime: String(r.start_time ?? "").slice(0, 5),
  endTime: r.end_time ? String(r.end_time).slice(0, 5) : null,
  timezone: (r.timezone as string) ?? "Australia/Sydney",
  location: (r.location as string) ?? null,
  eventType: (r.event_type as string) ?? null,
  imageUrl: (r.image_url as string) ?? null,
  joinUrl: (r.join_url as string) ?? null,
  isRecurring: Boolean(r.is_recurring),
  recurrencePattern: (r.recurrence_pattern as string) ?? undefined,
  recurrence: (r.recurrence as RecurrenceRule) ?? null,
  recordingUrl: (r.recording_url as string) ?? null,
  resources: Array.isArray(r.resources) ? (r.resources as Resource[]) : [],
  isPublished: Boolean(r.is_published),
  communityIds,
});

export const listEvents = async (): Promise<AcademyEvent[]> => {
  const [{ data, error }, { data: links }] = await Promise.all([
    supabase.from("events").select("*").order("start_date"),
    supabase.from("event_communities").select("event_id, community_id"),
  ]);

  if (error) {
    console.error("Could not read events:", error.message);
    return [];
  }

  const byEvent = new Map<string, string[]>();
  for (const l of links ?? []) {
    const list = byEvent.get(l.event_id) ?? [];
    list.push(l.community_id);
    byEvent.set(l.event_id, list);
  }

  return (data ?? []).map((r) => fromRow(r as Row, byEvent.get(r.id) ?? []));
};

/**
 * When does this event next happen?
 *
 * A one-off has its start date and that is all. A recurring one always has a
 * next time, which is why a monthly session created two years ago is still
 * upcoming rather than long past.
 */
export const displayDate = (event: AcademyEvent): Date | null =>
  event.isRecurring ? nextOccurrence(event) : startOf(event);

const startOf = (event: AcademyEvent): Date | null => {
  if (!event.startDate || !event.startTime) return null;
  const d = new Date(`${event.startDate}T${event.startTime}:00`);
  return isNaN(d.getTime()) ? null : d;
};

/** Still to come. A recurring event always is. */
export const isUpcoming = (event: AcademyEvent): boolean => {
  if (event.isRecurring) return true;
  const start = startOf(event);
  return start ? start.getTime() >= Date.now() : false;
};

/**
 * A replay: it has happened, and it was recorded.
 *
 * A recurring session counts once its most recent occurrence has passed,
 * because the recording is of that occurrence.
 */
export const isReplay = (event: AcademyEvent): boolean =>
  Boolean(event.recordingUrl);

/**
 * May the join link be shown yet?
 *
 * Five minutes before, matching EI Academy. Earlier than that and members
 * gather in an empty room; later and the punctual ones are locked out.
 */
export const isWithinJoinWindow = (event: AcademyEvent): boolean => {
  const start = displayDate(event);
  if (!start) return false;
  return Date.now() >= start.getTime() - 5 * 60_000;
};

export const recurrenceLabel = (event: AcademyEvent): string | null => {
  if (!event.isRecurring) return null;
  return event.recurrence
    ? describeRecurrence(event)
    : (event.recurrencePattern ?? "Repeats");
};

/**
 * The session's own time, and the member's, when they differ.
 *
 * A session at 9:30 Sydney is at 9:30 Sydney whatever month it is, which is
 * why the date and time are stored with a timezone beside them rather than as
 * an instant. Showing only the member's time hides the fact that a London
 * member is joining at 11:30 at night; showing only Sydney's makes them work
 * it out. So both, and the second only when it is genuinely different.
 */
export const formatTimes = (
  event: AcademyEvent,
  memberTimezone: string | null,
): { eventTime: string; memberTime: string | null } => {
  const start = displayDate(event);
  if (!start) return { eventTime: "", memberTime: null };

  const inZone = (tz: string) =>
    new Intl.DateTimeFormat("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(start);

  const eventTime = event.endTime
    ? `${event.startTime} – ${event.endTime}`
    : event.startTime;

  if (!memberTimezone || memberTimezone === event.timezone) {
    return { eventTime, memberTime: null };
  }

  try {
    const theirs = inZone(memberTimezone);
    const dayHere = new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      timeZone: event.timezone,
    }).format(start);
    const dayThere = new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      timeZone: memberTimezone,
    }).format(start);

    // Say so when it lands on a different day for them, which is the whole
    // reason somebody misses a session.
    const suffix = dayHere === dayThere ? "" : " the day before";
    return { eventTime, memberTime: `${theirs}${suffix} your time` };
  } catch (_) {
    return { eventTime, memberTime: null };
  }
};
