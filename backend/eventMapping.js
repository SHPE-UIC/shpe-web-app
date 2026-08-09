// Pure translation from a Google Calendar event into the field shape the app
// reads. No Firebase or network involved, so this is safe to unit test.

/**
 * Google reports timed events as `dateTime` (an RFC 3339 instant) and all-day
 * events as `date` (a bare calendar day). The bare day must not go through a
 * timezone conversion — parsing "2026-01-01" as an instant yields UTC midnight,
 * which is the previous evening in Chicago.
 *
 * @param isAllDayEnd all-day `end.date` is exclusive, so step back a day.
 */
export function readDateTime(edge, timeZone, isAllDayEnd = false) {
  if (edge?.date) {
    const [year, month, day] = edge.date.split('-').map(Number);
    const at = new Date(year, month - 1, day - (isAllDayEnd ? 1 : 0));
    return { date: formatLocalDate(at), time: 'All Day', at };
  }

  const at = new Date(edge.dateTime);
  const zone = edge.timeZone ?? timeZone ?? 'America/Chicago';
  return {
    date: new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(at),
    time: new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(at),
    at,
  };
}

function formatLocalDate(d) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
}

/**
 * Fields the calendar owns outright — overwritten on every sync. Anything not
 * returned here (notably `points` once an officer has adjusted it) survives.
 */
export function calendarOwnedFields(ev, timeZone) {
  const allDay = Boolean(ev.start?.date);
  const start = readDateTime(ev.start, timeZone);
  const end = readDateTime(ev.end, timeZone, allDay);

  return {
    name: (ev.summary ?? 'Untitled event').trim(),
    description: (ev.description ?? '').trim(),
    location: (ev.location ?? '').trim(),
    googleCalendarEventId: ev.id,

    // Display strings, matching the schema the app already reads.
    date: start.date,
    startsAt: allDay ? 'All Day' : start.time,
    endsAt: allDay ? 'All Day' : end.time,
    allDay,

    // Real instants alongside them, so the client can eventually query on
    // startAt instead of downloading the whole collection and filtering.
    startAtDate: start.at,
    endAtDate: end.at,
  };
}
