// src/lib/calendar.ts
//
// Adding an event to somebody's calendar.
//
// The previous version worked correctly only for people in the same timezone
// as whoever created the event. It read "2026-08-26T10:30:00" with no zone,
// which JavaScript interprets as the *viewer's* local time, and the event's
// own stored timezone was never used. A member in London adding a 10:30
// Sydney session got it nine hours late; a member in New York got it on the
// wrong day.
//
// Everything here is a pure function so it can be tested against several
// timezones without a browser, which is the only way to be sure.

import type { AcademyEvent } from "./events";
import { ruleFor, nextOccurrence, type RecurrenceRule } from "./recurrence";

/**
 * A wall-clock time in a named zone, as a real instant.
 *
 * "10:30 on 26 August in Australia/Sydney" is a different instant from
 * "10:30 on 26 August" wherever the reader happens to be sitting.
 *
 * Works by asking Intl what that instant looks like in the target zone and
 * correcting by the difference. No library needed, and it handles daylight
 * saving because the offset is resolved for that specific date.
 */
export const zonedToUtc = (
  dateStr: string,
  timeStr: string,
  timeZone?: string,
): Date | null => {
  if (!dateStr || !timeStr) return null;

  // No zone recorded: fall back to the viewer's own, which is what the old
  // behaviour was, rather than guessing at one.
  if (!timeZone) {
    const local = new Date(`${dateStr}T${timeStr}:00`);
    return isNaN(local.getTime()) ? null : local;
  }

  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  if (isNaN(naive.getTime())) return null;

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(naive)) parts[p.type] = p.value;

    // Some environments render midnight as hour 24.
    const hour = Number(parts.hour) % 24;

    const asZone = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hour,
      Number(parts.minute),
      Number(parts.second),
    );
    return new Date(naive.getTime() - (asZone - naive.getTime()));
  } catch {
    // An unknown zone name should not stop somebody adding the event.
    const local = new Date(`${dateStr}T${timeStr}:00`);
    return isNaN(local.getTime()) ? null : local;
  }
};

/** The UTC stamp both iCalendar and the web calendars want. */
export const stampUtc = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export const eventTimes = (
  event: AcademyEvent,
): { start: Date; end: Date } | null => {
  const tz = event.timezone;
  const start = zonedToUtc(event.startDate, event.startTime, tz);
  if (!start) return null;

  const end = event.endTime
    ? zonedToUtc(event.startDate || event.startDate, event.endTime, tz)
    : null;

  return {
    start,
    // A session with no finish time is assumed to run an hour.
    end: end && end > start ? end : new Date(start.getTime() + 60 * 60 * 1000),
  };
};

/**
 * What goes in the calendar's Location field, and what the event's link is.
 *
 * These were previously two unrelated decisions, and they disagreed. Location
 * was "Zoom - https://us02web.zoom.us/j/..." while URL was whatever page the
 * member happened to be on, which was always the academy's events page. Google
 * ignores URL and shows the location, so it looked right there; Apple Calendar
 * prefers URL, so members opening an event saw a link back to the events page
 * where the Zoom link should have been.
 *
 * Now there is one answer. The joinable link is the event's link everywhere:
 * it is the Location, it is the URL, and it is the CONFERENCE property that
 * Apple and Google turn into a Join button. A venue, when there is one as well,
 * is written into the description rather than competing with the link.
 */
const meetingLink = (event: AcademyEvent): string =>
  (event.joinUrl || "").trim();

const venue = (event: AcademyEvent): string => (event.location || "").trim();

/** The Location field: the joinable link when there is one, else the venue. */
export const locationFor = (event: AcademyEvent): string =>
  meetingLink(event) || venue(event);

/**
 * The description, with the venue added when the Location field has been given
 * over to the meeting link, so nothing is lost.
 *
 * A venue that only names the platform ("Zoom", "Online") adds nothing next to
 * the link itself, so it is left out.
 */
const PLATFORM_ONLY = /^(zoom|online|virtual|zoom meeting|online event|webinar)$/i;

export const descriptionFor = (event: AcademyEvent): string => {
  const body = (event.description || "").trim();
  const place = venue(event);
  const needsVenue = meetingLink(event) && place && !PLATFORM_ONLY.test(place);
  if (!needsVenue) return body;
  return body ? `${body}\n\nWhere: ${place}` : `Where: ${place}`;
};

const ICAL_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * The recurrence rule, in the form calendars understand.
 *
 * The old version knew only the four preset names and produced nothing at all
 * for anything else, so a custom rule was added to somebody's calendar as a
 * single one-off meeting.
 */
export const buildRRule = (event: AcademyEvent): string => {
  const rule: RecurrenceRule | null = ruleFor(event);
  if (!rule) return "";

  const parts: string[] = [];
  const interval = Math.max(1, Math.floor(rule.interval || 1));

  if (rule.freq === "day") parts.push("FREQ=DAILY");
  else if (rule.freq === "week") {
    parts.push("FREQ=WEEKLY");
    const days = rule.weekdays?.length ? rule.weekdays : [];
    if (days.length) {
      parts.push(`BYDAY=${days.map((d) => ICAL_DAY[d]).join(",")}`);
    }
  } else if (rule.freq === "month") {
    parts.push("FREQ=MONTHLY");
    if (rule.monthMode === "weekday") {
      const ord = rule.ordinal ?? 1;
      // 5 means "last", which iCalendar writes as -1.
      const prefix = ord === 5 ? -1 : ord;
      parts.push(`BYDAY=${prefix}${ICAL_DAY[rule.weekday ?? 1]}`);
    } else {
      const day = Number(event.startDate?.slice(8, 10));
      if (day) parts.push(`BYMONTHDAY=${day}`);
    }
  } else parts.push("FREQ=YEARLY");

  if (interval > 1) parts.push(`INTERVAL=${interval}`);

  if (rule.endMode === "after" && rule.count) {
    parts.push(`COUNT=${Math.max(1, rule.count)}`);
  } else if (rule.endMode === "on" && rule.endDate) {
    const until = zonedToUtc(rule.endDate, "23:59", event.timezone);
    if (until) parts.push(`UNTIL=${stampUtc(until)}`);
  }

  return parts.join(";");
};

/**
 * Escape a value for an iCalendar text field.
 *
 * A raw newline ends the property, so an unescaped description does not merely
 * look wrong — it breaks the structure of the file from that point on. The
 * academy's event descriptions are several paragraphs long, so every .ics
 * produced before this was malformed.
 */
const icsText = (raw?: string): string =>
  (raw ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/** Fold to 75 octets, as the specification requires. */
const fold = (line: string): string => {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) out.push(" " + rest);
  return out.join("\r\n");
};

/**
 * A valid .ics file.
 *
 * The previous one had no UID, no DTSTAMP and no PRODID, used bare newlines
 * instead of CRLF, and did not escape its text fields. Apple Calendar is
 * forgiving enough that it mostly worked; Outlook is not.
 */
export const buildIcs = (event: AcademyEvent, url: string): string | null => {
  const times = eventTimes(event);
  if (!times) return null;

  const link = meetingLink(event);
  // The event's own link if it has one; the page it was added from only as a
  // fallback, so Apple never shows the events page where a Zoom link belongs.
  const eventUrl = link || url;

  const uid = `${event.id || stampUtc(times.start)}@eia.peoplebuilders.com.au`;
  const rrule = buildRRule(event);

  // A URI property is not a text property: it is not escaped, but a stray
  // newline would still end the line, so those are stripped.
  const uri = (raw: string): string => raw.replace(/[\r\n]/g, "").trim();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//People Builders//Emotional Intelligence Academy//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stampUtc(new Date())}`,
    `DTSTART:${stampUtc(times.start)}`,
    `DTEND:${stampUtc(times.end)}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(descriptionFor(event))}`,
    `LOCATION:${icsText(locationFor(event))}`,
    `URL:${uri(eventUrl)}`,
    // RFC 7986. Apple Calendar and Google both render this as a Join button
    // rather than plain text, which is what a member actually wants at 9:59.
    ...(link ? [`CONFERENCE;VALUE=URI;FEATURE=VIDEO;LABEL=Join:${uri(link)}`] : []),
    ...(rrule ? [`RRULE:${rrule}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(fold).join("\r\n") + "\r\n";
};

export const googleUrl = (event: AcademyEvent): string | null => {
  const times = eventTimes(event);
  if (!times) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title || "Event",
    dates: `${stampUtc(times.start)}/${stampUtc(times.end)}`,
    details: descriptionFor(event),
    location: locationFor(event),
  });
  const rrule = buildRRule(event);
  if (rrule) params.set("recur", `RRULE:${rrule}`);
  // Tell Google the zone as well, so the entry reads sensibly for the member.
  if (event.timezone) params.set("ctz", event.timezone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const outlookUrl = (event: AcademyEvent): string | null => {
  const times = eventTimes(event);
  if (!times) return null;
  // Outlook wants ISO instants, and it handles the member's own zone itself.
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title || "Event",
    startdt: times.start.toISOString(),
    enddt: times.end.toISOString(),
    body: descriptionFor(event),
    location: locationFor(event),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

export const yahooUrl = (event: AcademyEvent): string | null => {
  const times = eventTimes(event);
  if (!times) return null;
  const params = new URLSearchParams({
    v: "60",
    view: "d",
    type: "20",
    title: event.title || "Event",
    st: stampUtc(times.start),
    et: stampUtc(times.end),
    desc: descriptionFor(event),
    in_loc: locationFor(event),
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
};

/** Hand the member an .ics file. Used for Apple Calendar and as a fallback. */
export const downloadIcs = (event: AcademyEvent, url: string): boolean => {
  const ics = buildIcs(event, url);
  if (!ics) return false;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.setAttribute("download", `${(event.title || "event").replace(/\s+/g, "_")}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Release the object URL, which otherwise leaks for the life of the page.
  setTimeout(() => window.URL.revokeObjectURL(href), 1000);
  return true;
};
