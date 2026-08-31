// Pure translation from a Google Calendar event into the row shape the app
// reads. No database or network involved, so this is safe to unit test.

import { tagForColorId } from './eventTags';

/** Used when neither the event nor the calendar declares a zone. */
export const DEFAULT_TIME_ZONE = 'America/Chicago';

/** The shape of a Google Calendar event, narrowed to what we actually read. */
export type GoogleEventEdge = {
  date?: string | null;
  dateTime?: string | null;
  timeZone?: string | null;
};

export type GoogleEvent = {
  id: string;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  colorId?: string | null;
  start?: GoogleEventEdge | null;
  end?: GoogleEventEdge | null;
};

/**
 * How far `instant` sits from UTC in `timeZone`, in milliseconds.
 *
 * Derived by formatting the instant into the zone and reading the wall-clock
 * fields back, which is the only way to get a zone offset without shipping a
 * timezone library.
 */
function offsetMsAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asIfUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour'),
    pick('minute'),
    pick('second'),
  );
  return asIfUtc - instant.getTime();
}

/**
 * The instant at which a given calendar day begins in a given timezone.
 *
 * The naive version — `new Date(year, month - 1, day)` — resolves against the
 * *server's* timezone, which in a container is UTC. An all-day event on 1 January
 * would be stored as midnight UTC, which is six in the evening on 31 December
 * in Chicago. The app would show it on the wrong day.
 */
export function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day);

  // Offset is itself a function of the instant, so guess once and refine. The
  // two differ only across a DST boundary, where the first guess lands on the
  // wrong side of the transition.
  const guess = new Date(wallClock - offsetMsAt(new Date(wallClock), timeZone));
  return new Date(wallClock - offsetMsAt(guess, timeZone));
}

/**
 * Resolve one edge of an event to a real instant.
 *
 * Google reports timed events as `dateTime` (an RFC 3339 instant, unambiguous)
 * and all-day events as `date` (a bare calendar day, which needs a zone).
 */
export function readInstant(
  edge: GoogleEventEdge | null | undefined,
  calendarTimeZone?: string | null,
): Date {
  if (!edge) return new Date(NaN);

  if (edge.date) {
    const [year, month, day] = edge.date.split('-').map(Number);
    if (!year || !month || !day) return new Date(NaN);
    return zonedMidnight(year, month, day, edge.timeZone ?? calendarTimeZone ?? DEFAULT_TIME_ZONE);
  }

  return edge.dateTime ? new Date(edge.dateTime) : new Date(NaN);
}

export type CalendarOwnedFields = {
  name: string;
  description: string;
  location: string;
  tag: string;
  points: number;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
};

/**
 * The fields the calendar owns. Anything not returned here — notably an
 * admin's in-app edits — is never touched by the sync.
 */
export function calendarOwnedFields(
  event: GoogleEvent,
  calendarTimeZone?: string | null,
): CalendarOwnedFields {
  const allDay = Boolean(event.start?.date);
  const { tag, points } = tagForColorId(event.colorId);

  // Google reports an all-day event's `end.date` as exclusive: an event on
  // 1 January ends on the 2nd. That exclusive midnight *is* the correct end
  // instant, so it is stored as-is rather than rolled back a day. Rolling it
  // back would make startsAt equal endsAt, and the upcoming-events filter
  // (ends_at >= now) would drop the event at midnight of the very day it runs.
  return {
    name: (event.summary ?? 'Untitled event').trim(),
    description: (event.description ?? '').trim(),
    location: (event.location ?? '').trim(),
    tag,
    points,
    startsAt: readInstant(event.start, calendarTimeZone),
    endsAt: readInstant(event.end, calendarTimeZone),
    allDay,
  };
}
