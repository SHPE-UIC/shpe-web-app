/**
 * Whether an event still takes RSVPs — and cancellations.
 *
 * Both close when the event starts. An RSVP is a headcount for planning food
 * and rooms, so once the doors open the list officers see should be what
 * members said beforehand, not rewritten by a change of mind at the door.
 */
export function rsvpOpen(event: { startsAt: Date }, now: Date): boolean {
  return now < event.startsAt;
}
