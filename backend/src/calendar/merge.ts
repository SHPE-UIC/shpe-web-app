import type { CalendarOwnedFields } from './eventMapping';

/**
 * Fields the Google Calendar sync is allowed to write.
 *
 * `points` is deliberately absent: it is derived from `tag` rather than read
 * from the calendar, and it follows its own rule below.
 */
export const CALENDAR_OWNED_FIELDS = [
  'name',
  'description',
  'location',
  'tag',
  'startsAt',
  'endsAt',
  'allDay',
] as const;

export type CalendarOwnedField = (typeof CALENDAR_OWNED_FIELDS)[number];

/** Fields an admin may override in-app, which is the calendar-owned set plus points. */
export const OVERRIDABLE_FIELDS = [...CALENDAR_OWNED_FIELDS, 'points'] as const;
export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

export function isOverridableField(name: string): name is OverridableField {
  return (OVERRIDABLE_FIELDS as readonly string[]).includes(name);
}

export type ExistingEvent = {
  tag: string;
  points: number;
  overriddenFields: string[];
};

export type EventUpdate = Partial<CalendarOwnedFields>;

/**
 * Decide what a calendar sync should write over an event that already exists.
 *
 * The rule, in one sentence: the calendar owns every field except the ones an
 * admin has explicitly edited in the app.
 *
 * Overrides are tracked per field rather than as a single "manually edited"
 * flag. A whole-row lock would mean that correcting one typo'd location freezes
 * the event's *time* against every future calendar change — the failure most
 * likely to send someone to a room at the wrong hour.
 *
 * Pure on purpose: this is the logic worth testing, and it should not need a
 * database to exercise.
 */
export function mergeCalendarEvent(
  incoming: CalendarOwnedFields,
  existing: ExistingEvent | null,
): EventUpdate {
  // Brand new event: the calendar is the only source there is.
  if (!existing) {
    return { ...incoming };
  }

  const overridden = new Set(existing.overriddenFields);
  const update: EventUpdate = {};

  if (!overridden.has('name')) update.name = incoming.name;
  if (!overridden.has('description')) update.description = incoming.description;
  if (!overridden.has('location')) update.location = incoming.location;
  if (!overridden.has('startsAt')) update.startsAt = incoming.startsAt;
  if (!overridden.has('endsAt')) update.endsAt = incoming.endsAt;
  if (!overridden.has('allDay')) update.allDay = incoming.allDay;

  if (!overridden.has('tag')) {
    update.tag = incoming.tag;

    // Points follow the tag, but only when the tag actually changed.
    //
    // Recolouring an event in Calendar should revalue it. An unrelated edit —
    // fixing a typo in the description — must not, or it would silently revert
    // an officer's deliberate point adjustment.
    if (incoming.tag !== existing.tag && !overridden.has('points')) {
      update.points = incoming.points;
    }
  }

  return update;
}
