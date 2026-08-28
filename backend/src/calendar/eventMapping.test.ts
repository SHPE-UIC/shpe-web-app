import { describe, expect, it } from 'vitest';
import { calendarOwnedFields, readInstant, zonedMidnight } from './eventMapping';

const CHICAGO = 'America/Chicago';

describe('zonedMidnight', () => {
  // The bug this exists to prevent: parsing a bare calendar day against the
  // server's clock. Render runs in UTC, so the naive version would place
  // 1 January at 00:00Z — six in the evening on 31 December in Chicago.
  it('resolves a calendar day to midnight in the given zone, not the server zone', () => {
    const midnight = zonedMidnight(2026, 1, 1, CHICAGO);
    // Chicago is UTC-6 in January.
    expect(midnight.toISOString()).toBe('2026-01-01T06:00:00.000Z');
  });

  it('accounts for daylight saving, which shifts the offset by an hour', () => {
    // July is UTC-5 in Chicago.
    expect(zonedMidnight(2026, 7, 1, CHICAGO).toISOString()).toBe('2026-07-01T05:00:00.000Z');
  });

  it('lands on the correct side of a spring-forward transition', () => {
    // US DST begins 8 March 2026. Midnight that day is still UTC-6.
    expect(zonedMidnight(2026, 3, 8, CHICAGO).toISOString()).toBe('2026-03-08T06:00:00.000Z');
    // The next day is UTC-5.
    expect(zonedMidnight(2026, 3, 9, CHICAGO).toISOString()).toBe('2026-03-09T05:00:00.000Z');
  });

  it('handles a zone on the other side of UTC', () => {
    expect(zonedMidnight(2026, 1, 1, 'Europe/Madrid').toISOString()).toBe(
      '2025-12-31T23:00:00.000Z',
    );
  });
});

describe('readInstant', () => {
  it('takes a timed event at face value, since RFC 3339 is unambiguous', () => {
    const at = readInstant({ dateTime: '2026-01-15T18:00:00-06:00' }, CHICAGO);
    expect(at.toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('prefers the edge timezone over the calendar default', () => {
    const at = readInstant({ date: '2026-01-01', timeZone: 'Europe/Madrid' }, CHICAGO);
    expect(at.toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });

  it('returns an invalid date rather than throwing on a malformed edge', () => {
    expect(Number.isNaN(readInstant(null, CHICAGO).getTime())).toBe(true);
    expect(Number.isNaN(readInstant({}, CHICAGO).getTime())).toBe(true);
    expect(Number.isNaN(readInstant({ date: 'nonsense' }, CHICAGO).getTime())).toBe(true);
  });
});

describe('calendarOwnedFields', () => {
  it('maps a timed event, deriving tag and points from the colour', () => {
    const fields = calendarOwnedFields(
      {
        id: 'evt-1',
        summary: '  General Meeting  ',
        description: '  Monthly GBM  ',
        location: '  EIB 124  ',
        colorId: '9', // Blueberry -> GBM, 3 points
        start: { dateTime: '2026-01-15T18:00:00-06:00' },
        end: { dateTime: '2026-01-15T19:00:00-06:00' },
      },
      CHICAGO,
    );

    expect(fields.name).toBe('General Meeting');
    expect(fields.description).toBe('Monthly GBM');
    expect(fields.location).toBe('EIB 124');
    expect(fields.tag).toBe('GBM');
    expect(fields.points).toBe(3);
    expect(fields.allDay).toBe(false);
    expect(fields.startsAt.toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('falls back to the default tag when the event has no colour', () => {
    const fields = calendarOwnedFields(
      {
        id: 'evt-2',
        summary: 'Untitled',
        start: { dateTime: '2026-01-15T18:00:00-06:00' },
        end: { dateTime: '2026-01-15T19:00:00-06:00' },
      },
      CHICAGO,
    );
    expect(fields.tag).toBe('Event');
    expect(fields.points).toBe(1);
  });

  it('supplies a name for an event that has none', () => {
    const fields = calendarOwnedFields(
      { id: 'evt-3', start: { date: '2026-01-01' }, end: { date: '2026-01-02' } },
      CHICAGO,
    );
    expect(fields.name).toBe('Untitled event');
    expect(fields.description).toBe('');
  });

  // Google reports an all-day end date as exclusive. Keeping that exclusive
  // instant is what lets the upcoming-events filter (ends_at >= now) keep
  // showing the event for the whole day it runs, instead of dropping it at
  // 00:00 on the morning of.
  describe('all-day events', () => {
    const allDay = calendarOwnedFields(
      { id: 'evt-4', summary: 'Study Night', start: { date: '2026-01-01' }, end: { date: '2026-01-02' } },
      CHICAGO,
    );

    it('is flagged as all day', () => {
      expect(allDay.allDay).toBe(true);
    });

    it('starts at local midnight on the day itself', () => {
      expect(allDay.startsAt.toISOString()).toBe('2026-01-01T06:00:00.000Z');
    });

    it('ends at the exclusive boundary, a full day later', () => {
      expect(allDay.endsAt.toISOString()).toBe('2026-01-02T06:00:00.000Z');
      expect(allDay.endsAt.getTime() - allDay.startsAt.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('is still upcoming during the day it runs', () => {
      const middayOfTheEvent = new Date('2026-01-01T18:00:00.000Z');
      expect(allDay.endsAt.getTime() >= middayOfTheEvent.getTime()).toBe(true);
    });
  });
});
