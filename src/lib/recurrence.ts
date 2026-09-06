// src/lib/recurrence.ts
//
// When does a repeating event happen?
//
// Modelled on the recurrence editor everyone already knows from Google
// Calendar: repeat every N days/weeks/months/years, on chosen weekdays, ending
// never, on a date, or after a number of occurrences.
//
// Kept in its own file with no React in it, because date arithmetic is the
// kind of code that looks right and is not. Everything here is a pure
// function of a rule, a start, and a "now", so it can be tested without a
// browser — and it is.

export type Freq = "day" | "week" | "month" | "year";
export type MonthMode = "day" | "weekday";
export type EndMode = "never" | "on" | "after";

export interface RecurrenceRule {
  /** Repeat every N of `freq`. Always at least 1. */
  interval: number;
  freq: Freq;
  /** freq = week: which days, 0 Sunday to 6 Saturday. Empty means the start's own day. */
  weekdays?: number[];
  /** freq = month: by date in the month, or by nth weekday. */
  monthMode?: MonthMode;
  /** monthMode = weekday: 1 to 4, or 5 meaning last. */
  ordinal?: number;
  /** monthMode = weekday: 0 Sunday to 6 Saturday. */
  weekday?: number;
  endMode: EndMode;
  /** endMode = on: the last date it may fall on, inclusive. */
  endDate?: string;
  /** endMode = after: how many occurrences in total. */
  count?: number;
}

export interface RecurringLike {
  startDate?: string;
  startTime?: string;
  isRecurring?: boolean;
  recurrence?: RecurrenceRule | null;
  /** Superseded by `recurrence`; still read so older events keep working. */
  recurrencePattern?: string;
  recurrenceOrdinal?: number | null;
  recurrenceWeekday?: number | null;
}

export const WEEKDAYS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 0, short: "S", label: "Sunday" },
];

export const ORDINALS = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: 5, label: "Last" },
];

const ORDINAL_WORD: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "last",
};

export const DEFAULT_RULE: RecurrenceRule = {
  interval: 1,
  freq: "week",
  weekdays: [],
  monthMode: "day",
  endMode: "never",
};

export const startOf = (e: RecurringLike): Date | null => {
  if (!e.startDate || !e.startTime) return null;
  const d = new Date(`${e.startDate}T${e.startTime}:00`);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * The nth given weekday of a month, or the last one when ordinal is 5.
 *
 * Returns null when that occurrence does not exist, which only happens for a
 * 5th weekday in a short month. Callers move to the next month rather than
 * inventing a date.
 */
export const nthWeekdayOfMonth = (
  year: number,
  month: number,
  weekday: number,
  ordinal: number,
): Date | null => {
  if (ordinal === 5) {
    // Day 0 of the next month is the last day of this one.
    const last = new Date(year, month + 1, 0);
    const back = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - back);
  }
  const first = new Date(year, month, 1);
  const forward = (weekday - first.getDay() + 7) % 7;
  const d = new Date(year, month, 1 + forward + (ordinal - 1) * 7);
  return d.getMonth() === month ? d : null;
};

/**
 * Older events stored a pattern name and, for Custom, an ordinal and weekday.
 * Read them as a rule so nothing has to be migrated and nothing breaks.
 */
export const ruleFor = (e: RecurringLike): RecurrenceRule | null => {
  if (!e.isRecurring) return null;
  if (e.recurrence) return { ...DEFAULT_RULE, ...e.recurrence };

  const pattern = (e.recurrencePattern || "Weekly").toLowerCase();
  if (pattern === "daily") return { interval: 1, freq: "day", endMode: "never" };
  if (pattern === "weekly") return { interval: 1, freq: "week", weekdays: [], endMode: "never" };
  if (pattern === "bi-weekly" || pattern === "fortnightly") {
    return { interval: 2, freq: "week", weekdays: [], endMode: "never" };
  }
  if (pattern === "monthly") {
    return { interval: 1, freq: "month", monthMode: "day", endMode: "never" };
  }
  if (pattern === "custom") {
    return {
      interval: 1,
      freq: "month",
      monthMode: "weekday",
      ordinal: e.recurrenceOrdinal ?? 1,
      weekday: e.recurrenceWeekday ?? 1,
      endMode: "never",
    };
  }
  return { interval: 1, freq: "week", weekdays: [], endMode: "never" };
};

const atTimeOf = (day: Date, start: Date): Date => {
  const d = new Date(day);
  d.setHours(start.getHours(), start.getMinutes(), 0, 0);
  return d;
};

const endBoundary = (rule: RecurrenceRule): Date | null => {
  if (rule.endMode !== "on" || !rule.endDate) return null;
  const d = new Date(`${rule.endDate}T23:59:59`);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Every occurrence, in order, from the start.
 *
 * Stops at the rule's own end, or at `max`, whichever comes first. `max`
 * exists so an endless rule can never be asked for an endless list.
 */
export const occurrences = (
  e: RecurringLike,
  max = 500,
): Date[] => {
  const start = startOf(e);
  if (!start) return [];
  const rule = ruleFor(e);
  if (!rule) return [start];

  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const limit = rule.endMode === "after" ? Math.max(1, rule.count || 1) : max;
  const until = endBoundary(rule);
  const out: Date[] = [];

  const push = (d: Date): boolean => {
    if (d < start) return true; // before the series began
    if (until && d > until) return false; // series has ended
    out.push(d);
    return out.length < limit;
  };

  if (rule.freq === "day") {
    const cursor = new Date(start);
    while (out.length < limit) {
      if (!push(new Date(cursor))) break;
      cursor.setDate(cursor.getDate() + interval);
      if (until && cursor > until) break;
      if (out.length >= max) break;
    }
    return out;
  }

  if (rule.freq === "week") {
    const days = rule.weekdays?.length ? [...rule.weekdays].sort((a, b) => a - b) : [start.getDay()];
    // Anchor on the Sunday of the start's week, so intervals step whole weeks
    // regardless of which day the series began on.
    const anchor = new Date(start);
    anchor.setDate(anchor.getDate() - anchor.getDay());
    anchor.setHours(0, 0, 0, 0);

    for (let block = 0; out.length < limit && block < max; block++) {
      const weekStart = new Date(anchor);
      weekStart.setDate(weekStart.getDate() + block * interval * 7);
      if (until && weekStart > until) break;
      let stop = false;
      for (const wd of days) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + wd);
        if (!push(atTimeOf(day, start))) {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
    return out;
  }

  if (rule.freq === "month") {
    for (let block = 0; out.length < limit && block < max; block++) {
      const month = new Date(start.getFullYear(), start.getMonth() + block * interval, 1);
      if (until && month > until) break;

      let day: Date | null;
      if (rule.monthMode === "weekday") {
        day = nthWeekdayOfMonth(
          month.getFullYear(),
          month.getMonth(),
          rule.weekday ?? start.getDay(),
          rule.ordinal ?? 1,
        );
      } else {
        // By date. A 31st in a short month simply does not occur, rather than
        // silently landing on the 1st of the next one.
        const wanted = start.getDate();
        const candidate = new Date(month.getFullYear(), month.getMonth(), wanted);
        day = candidate.getMonth() === month.getMonth() ? candidate : null;
      }
      if (!day) continue;
      if (!push(atTimeOf(day, start))) break;
    }
    return out;
  }

  // Yearly.
  for (let block = 0; out.length < limit && block < max; block++) {
    const d = new Date(start);
    d.setFullYear(d.getFullYear() + block * interval);
    // 29 February in a common year does not occur.
    if (d.getMonth() !== start.getMonth()) continue;
    if (until && d > until) break;
    if (!push(d)) break;
  }
  return out;
};

/**
 * The next time this happens, on or after `now`.
 *
 * Returns null when the series has finished — which is the point of end
 * conditions, and what tells the Events page to stop listing it.
 */
export const nextOccurrence = (
  e: RecurringLike,
  now: Date = new Date(),
): Date | null => {
  const start = startOf(e);
  if (!start) return null;
  if (!e.isRecurring) return start;
  return occurrences(e).find((d) => d >= now) ?? null;
};

/** How often this repeats, in words. */
export const describeRecurrence = (e: RecurringLike): string => {
  const rule = ruleFor(e);
  if (!rule) return "";
  const start = startOf(e);
  const n = Math.max(1, Math.floor(rule.interval || 1));
  const unit = rule.freq;
  const every = n === 1 ? `every ${unit}` : `every ${n} ${unit}s`;

  let main = `Repeats ${every}`;

  if (rule.freq === "week") {
    const days = rule.weekdays?.length ? rule.weekdays : start ? [start.getDay()] : [];
    if (days.length) {
      const names = [...days]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? "")
        .filter(Boolean);
      main += ` on ${names.join(", ")}`;
    }
  }

  if (rule.freq === "month" && rule.monthMode === "weekday") {
    const ord = ORDINAL_WORD[rule.ordinal ?? 1] ?? "first";
    const wd = WEEKDAYS.find((w) => w.value === (rule.weekday ?? 1))?.label ?? "Monday";
    main += ` on the ${ord} ${wd}`;
  }

  if (rule.endMode === "on" && rule.endDate) {
    main += `, until ${new Date(`${rule.endDate}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  if (rule.endMode === "after" && rule.count) {
    main += `, ${rule.count} time${rule.count === 1 ? "" : "s"}`;
  }

  return main;
};
