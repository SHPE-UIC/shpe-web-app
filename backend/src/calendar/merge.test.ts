import { describe, expect, it } from 'vitest';
import type { CalendarOwnedFields } from './eventMapping';
import { isOverridableField, mergeCalendarEvent } from './merge';

const incoming: CalendarOwnedFields = {
  name: 'General Meeting',
  description: 'Monthly GBM',
  location: 'EIB 124',
  tag: 'GBM',
  points: 3,
  startsAt: new Date('2026-01-15T18:00:00.000Z'),
  endsAt: new Date('2026-01-15T19:00:00.000Z'),
  allDay: false,
};

describe('a calendar event that is new to us', () => {
  it('is taken wholesale, points included', () => {
    expect(mergeCalendarEvent(incoming, null)).toEqual(incoming);
  });
});

describe('a calendar event an admin has not touched', () => {
  const existing = { tag: 'GBM', points: 3, overriddenFields: [] };

  it('has every calendar-owned field refreshed', () => {
    const update = mergeCalendarEvent(incoming, existing);
    expect(update.name).toBe('General Meeting');
    expect(update.location).toBe('EIB 124');
    expect(update.startsAt).toEqual(incoming.startsAt);
    expect(update.allDay).toBe(false);
  });

  it('leaves points alone while the tag is unchanged', () => {
    // An officer may have adjusted points by hand. An unrelated calendar edit
    // must not quietly revert that.
    const update = mergeCalendarEvent(incoming, { tag: 'GBM', points: 99, overriddenFields: [] });
    expect(update.points).toBeUndefined();
  });

  it('revalues the event when the tag actually changes', () => {
    // Recolouring an event in Calendar is how officers change what it is worth.
    const update = mergeCalendarEvent(incoming, { tag: 'Social', points: 1, overriddenFields: [] });
    expect(update.tag).toBe('GBM');
    expect(update.points).toBe(3);
  });
});

describe('a calendar event with admin overrides', () => {
  it('keeps an overridden field and still updates the rest', () => {
    const update = mergeCalendarEvent(incoming, {
      tag: 'GBM',
      points: 3,
      overriddenFields: ['location'],
    });

    expect(update.location).toBeUndefined();      // the admin's correction survives
    expect(update.name).toBe('General Meeting');   // everything else still tracks
    expect(update.startsAt).toEqual(incoming.startsAt);
  });

  // The reason overrides are per-field. If one typo fix locked the whole row,
  // the event's time would stop tracking the calendar and someone would show up
  // at the wrong hour.
  it('does not let a location override freeze the event time', () => {
    const update = mergeCalendarEvent(incoming, {
      tag: 'GBM',
      points: 3,
      overriddenFields: ['location'],
    });
    expect(update.startsAt).toEqual(incoming.startsAt);
    expect(update.endsAt).toEqual(incoming.endsAt);
  });

  it('will not revalue an event whose tag is overridden', () => {
    const update = mergeCalendarEvent(incoming, {
      tag: 'Social',
      points: 1,
      overriddenFields: ['tag'],
    });
    expect(update.tag).toBeUndefined();
    expect(update.points).toBeUndefined();
  });

  it('honours a points override even when the tag changes', () => {
    const update = mergeCalendarEvent(incoming, {
      tag: 'Social',
      points: 42,
      overriddenFields: ['points'],
    });
    expect(update.tag).toBe('GBM');          // tag still tracks the calendar
    expect(update.points).toBeUndefined();   // but the admin's value stands
  });

  it('writes nothing when every field is overridden', () => {
    const update = mergeCalendarEvent(incoming, {
      tag: 'GBM',
      points: 3,
      overriddenFields: [
        'name',
        'description',
        'location',
        'tag',
        'startsAt',
        'endsAt',
        'allDay',
        'points',
      ],
    });
    expect(update).toEqual({});
  });

  it('ignores an unrecognised override name rather than blocking everything', () => {
    const update = mergeCalendarEvent(incoming, {
      tag: 'GBM',
      points: 3,
      overriddenFields: ['nonsense'],
    });
    expect(update.name).toBe('General Meeting');
  });
});

describe('isOverridableField', () => {
  it('accepts the calendar-owned fields and points', () => {
    expect(isOverridableField('location')).toBe(true);
    expect(isOverridableField('points')).toBe(true);
    expect(isOverridableField('startsAt')).toBe(true);
  });

  // Guards the PATCH route: an admin must not be able to mark arbitrary columns
  // as overridden, least of all identity ones.
  it('rejects anything else', () => {
    expect(isOverridableField('id')).toBe(false);
    expect(isOverridableField('source')).toBe(false);
    expect(isOverridableField('googleCalendarEventId')).toBe(false);
    expect(isOverridableField('overriddenFields')).toBe(false);
  });
});
