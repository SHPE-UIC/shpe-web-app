import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarOwnedFields, readDateTime } from './eventMapping.js';

describe('readDateTime', () => {
  it('treats an all-day date as a local calendar day, not a UTC instant', () => {
    const result = readDateTime({ date: '2026-01-01' }, 'America/Chicago');
    assert.equal(result.date, '01/01/2026');
    assert.equal(result.time, 'All Day');
  });

  it('steps back a day for an exclusive all-day end date', () => {
    const result = readDateTime({ date: '2026-01-02' }, 'America/Chicago', true);
    assert.equal(result.date, '01/01/2026');
  });

  it('formats a timed event in the calendar timezone', () => {
    const result = readDateTime({ dateTime: '2026-01-15T18:00:00-06:00' }, 'America/Chicago');
    assert.equal(result.date, '01/15/2026');
    assert.equal(result.time, '6:00 PM');
  });

  it('prefers the edge timezone over the calendar default', () => {
    const result = readDateTime(
      { dateTime: '2026-01-15T18:00:00-06:00', timeZone: 'UTC' },
      'America/Chicago',
    );
    assert.equal(result.time, '12:00 AM');
  });
});

describe('calendarOwnedFields', () => {
  it('marks an all-day event and blanks its time range', () => {
    const fields = calendarOwnedFields(
      {
        id: 'abc',
        summary: '  Study Night  ',
        start: { date: '2026-02-12' },
        end: { date: '2026-02-13' },
      },
      'America/Chicago',
    );

    assert.equal(fields.allDay, true);
    assert.equal(fields.startsAt, 'All Day');
    assert.equal(fields.endsAt, 'All Day');
    assert.equal(fields.name, 'Study Night');
    assert.equal(fields.date, '02/12/2026');
    assert.equal(fields.googleCalendarEventId, 'abc');
  });

  it('defaults a missing summary and blanks missing text fields', () => {
    const fields = calendarOwnedFields(
      {
        id: 'xyz',
        start: { dateTime: '2026-01-15T18:00:00-06:00' },
        end: { dateTime: '2026-01-15T19:00:00-06:00' },
      },
      'America/Chicago',
    );

    assert.equal(fields.name, 'Untitled event');
    assert.equal(fields.description, '');
    assert.equal(fields.location, '');
    assert.equal(fields.allDay, false);
    assert.equal(fields.startsAt, '6:00 PM');
    assert.equal(fields.endsAt, '7:00 PM');
  });

  it('does not return points, so an officer override survives a sync', () => {
    const fields = calendarOwnedFields(
      {
        id: 'abc',
        summary: 'General Meeting',
        start: { dateTime: '2026-01-15T18:00:00-06:00' },
        end: { dateTime: '2026-01-15T19:00:00-06:00' },
      },
      'America/Chicago',
    );

    assert.equal('points' in fields, false);
  });
});
