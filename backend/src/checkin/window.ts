/**
 * Whether an event is currently accepting check-ins.
 *
 * Separate from the route and pure, because the interesting cases are all
 * boundaries and they should be testable without a database or a clock.
 */

export type CheckinWindow =
  | { open: true }
  | { open: false; reason: 'too_early' | 'too_late'; opensAt: Date; closesAt: Date };

export type CheckinWindowEvent = {
  startsAt: Date;
  endsAt: Date;
};

/**
 * Members turn up before the doors open, so scanning is allowed for a grace
 * period ahead of the start time. It closes at the end: an event that has
 * finished should not still be collecting attendance.
 */
export function checkinWindow(
  event: CheckinWindowEvent,
  now: Date,
  earlyMinutes: number,
): CheckinWindow {
  const opensAt = new Date(event.startsAt.getTime() - earlyMinutes * 60 * 1000);
  const closesAt = event.endsAt;

  if (now < opensAt) return { open: false, reason: 'too_early', opensAt, closesAt };
  if (now > closesAt) return { open: false, reason: 'too_late', opensAt, closesAt };
  return { open: true };
}

/** Wording a member sees when a scan is refused on timing. */
export function describeClosedWindow(window: Extract<CheckinWindow, { open: false }>): string {
  const time = (d: Date) =>
    d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return window.reason === 'too_early'
    ? `Check-in for this event opens at ${time(window.opensAt)}.`
    : `Check-in for this event closed at ${time(window.closesAt)}.`;
}
