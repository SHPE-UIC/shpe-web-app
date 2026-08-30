import { describe, expect, it } from 'vitest';
import { checkinWindow, describeClosedWindow } from './window';

const event = {
  startsAt: new Date('2026-09-05T23:00:00.000Z'),
  endsAt: new Date('2026-09-06T00:00:00.000Z'),
};
const GRACE = 30;

const at = (iso: string) => checkinWindow(event, new Date(iso), GRACE);

describe('checkinWindow', () => {
  it('is open during the event', () => {
    expect(at('2026-09-05T23:30:00.000Z').open).toBe(true);
  });

  it('is open during the grace period before it starts', () => {
    expect(at('2026-09-05T22:45:00.000Z').open).toBe(true);
  });

  it('is closed before the grace period begins', () => {
    const window = at('2026-09-05T22:00:00.000Z');
    expect(window.open).toBe(false);
    expect(window.open === false && window.reason).toBe('too_early');
  });

  it('is closed once the event has finished', () => {
    const window = at('2026-09-06T00:30:00.000Z');
    expect(window.open).toBe(false);
    expect(window.open === false && window.reason).toBe('too_late');
  });

  // Boundaries, because these are where an off-by-one actually bites: someone
  // scanning at the exact moment doors open, or as the event ends.
  describe('boundaries', () => {
    it('opens exactly on the grace boundary', () => {
      expect(at('2026-09-05T22:30:00.000Z').open).toBe(true);
      expect(at('2026-09-05T22:29:59.999Z').open).toBe(false);
    });

    it('closes exactly at the end time', () => {
      expect(at('2026-09-06T00:00:00.000Z').open).toBe(true);
      expect(at('2026-09-06T00:00:00.001Z').open).toBe(false);
    });
  });

  it('honours a zero grace period', () => {
    const window = checkinWindow(event, new Date('2026-09-05T22:59:59.000Z'), 0);
    expect(window.open).toBe(false);
    expect(checkinWindow(event, new Date('2026-09-05T23:00:00.000Z'), 0).open).toBe(true);
  });

  // An all-day event spans an exclusive midnight-to-midnight range, so it must
  // stay open all day rather than only at the instant it starts.
  it('stays open across an all-day event', () => {
    const allDay = {
      startsAt: new Date('2026-09-05T05:00:00.000Z'),
      endsAt: new Date('2026-09-06T05:00:00.000Z'),
    };
    expect(checkinWindow(allDay, new Date('2026-09-05T18:00:00.000Z'), GRACE).open).toBe(true);
  });
});

describe('describeClosedWindow', () => {
  it('tells a member when check-in opens', () => {
    const window = at('2026-09-05T22:00:00.000Z');
    expect(window.open).toBe(false);
    if (!window.open) expect(describeClosedWindow(window)).toMatch(/opens at/);
  });

  it('tells a member when check-in closed', () => {
    const window = at('2026-09-06T00:30:00.000Z');
    expect(window.open).toBe(false);
    if (!window.open) expect(describeClosedWindow(window)).toMatch(/closed at/);
  });
});
