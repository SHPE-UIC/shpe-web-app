import { describe, expect, it } from 'vitest';
import { rsvpOpen } from './window';

const startsAt = new Date('2026-10-05T18:00:00Z');
const event = { startsAt };

/**
 * RSVPs are a headcount for planning, so they close when the event starts.
 * After that the list officers see is what members said beforehand, and a
 * change of mind at the door no longer rewrites it.
 */
describe('rsvpOpen', () => {
  it('is open before the event starts', () => {
    expect(rsvpOpen(event, new Date('2026-10-05T17:59:59Z'))).toBe(true);
  });

  it('closes the instant it starts', () => {
    expect(rsvpOpen(event, startsAt)).toBe(false);
  });

  it('stays closed once it is under way', () => {
    expect(rsvpOpen(event, new Date('2026-10-05T19:00:00Z'))).toBe(false);
  });
});
