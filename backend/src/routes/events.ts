import { and, asc, eq, gte } from 'drizzle-orm';
import { Router } from 'express';
import { recordAudit } from '../audit';
import { signCheckinToken } from '../auth/tokens';
import { isOverridableField, type OverridableField } from '../calendar/merge';
import { db } from '../db';
import { events, rsvps, type Event } from '../db/schema';
import { requireBoard, requireAuth } from '../middleware/auth';
import { badRequest, notFoundError } from '../middleware/errors';
import { rsvpOpen } from '../rsvp/window';

export type PublicEvent = {
  id: string;
  name: string;
  description: string;
  location: string;
  tag: string;
  points: number;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  source: string;
};

/** Named explicitly so a column added later cannot leak through by accident. */
export function toPublicEvent(event: Event): PublicEvent {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    location: event.location,
    tag: event.tag,
    points: event.points,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    allDay: event.allDay,
    source: event.source,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Express 5 types a route param as string | string[]; the :id route only ever
 * produces one value, so narrow it in one place.
 *
 * The shape is checked here rather than left to Postgres: querying a uuid
 * column with "foo" raises 22P02, which would surface as a 500. Any crawler
 * hitting /api/events/whatever would look like a server fault.
 */
function eventId(req: { params: Record<string, string | string[]> }): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : raw ?? '';
  if (!UUID.test(id)) throw notFoundError('That event does not exist', 'event_not_found');
  return id;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseInstant(value: unknown, field: string): Date {
  const at = new Date(str(value));
  if (Number.isNaN(at.getTime())) {
    throw badRequest(`${field} must be an ISO 8601 date-time`, `${field}_invalid`);
  }
  return at;
}

function parsePoints(value: unknown): number {
  const points = Number(value);
  if (!Number.isInteger(points) || points < 0 || points > 100) {
    throw badRequest('Points must be a whole number between 0 and 100', 'points_invalid');
  }
  return points;
}

export const eventRoutes = Router();

/** Every event route requires a signed-in member. */
eventRoutes.use(requireAuth);

eventRoutes.get('/', async (req, res) => {
  // Filtering and ordering happen in SQL. The Firestore version had to download
  // every document and filter in the client, because it stored dates as display
  // strings rather than instants.
  const rows = await (req.query.upcoming === '1'
    ? db.select().from(events).where(gte(events.endsAt, new Date())).orderBy(asc(events.startsAt))
    : db.select().from(events).orderBy(asc(events.startsAt)));

  res.json({ events: rows.map(toPublicEvent) });
});

/** The event with an id already checked by eventId(), or a 404. */
async function findEvent(id: string): Promise<Event> {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) throw notFoundError('That event does not exist', 'event_not_found');
  return event;
}

/** The caller's own RSVP to one event — never anyone else's. */
function ownRsvp(userId: string, id: string) {
  return and(eq(rsvps.userId, userId), eq(rsvps.eventId, id));
}

eventRoutes.get('/:id', async (req, res) => {
  const id = eventId(req);
  // Both need only the id, so they run together rather than one after the other.
  const [event, [rsvp]] = await Promise.all([
    findEvent(id),
    db.select({ id: rsvps.id }).from(rsvps).where(ownRsvp(req.currentUser!.id, id)).limit(1),
  ]);

  // Only the caller's own answer. How many others are going, and who, is for
  // officers — see /api/admin/events/:id/attendance.
  res.json({ event: toPublicEvent(event), rsvp: { going: Boolean(rsvp) } });
});

function refuseIfStarted(event: Event) {
  if (!rsvpOpen(event, new Date())) {
    throw badRequest('RSVPs for this event closed when it started.', 'rsvp_closed');
  }
}

/**
 * RSVP to an event. First-person only, like a check-in: the member comes from
 * the session, and nothing in the body can name someone else.
 *
 * Idempotent. The unique index on (event_id, user_id) turns a second tap into
 * a no-op rather than a duplicate — checking first would race two taps.
 *
 * The start time is the only gate, because every event is visible to every
 * member today. If events ever gain a hidden, draft, or cancelled state, this
 * route and DELETE below must refuse those too, or a member could RSVP by id
 * to an event they were never shown.
 */
eventRoutes.put('/:id/rsvp', async (req, res) => {
  const event = await findEvent(eventId(req));
  refuseIfStarted(event);

  await db
    .insert(rsvps)
    .values({ userId: req.currentUser!.id, eventId: event.id })
    .onConflictDoNothing();

  res.json({ rsvp: { going: true } });
});

/** Take an RSVP back. Also idempotent: cancelling twice is not an error. */
eventRoutes.delete('/:id/rsvp', async (req, res) => {
  const event = await findEvent(eventId(req));
  refuseIfStarted(event);

  await db.delete(rsvps).where(ownRsvp(req.currentUser!.id, event.id));

  res.json({ rsvp: { going: false } });
});

/**
 * A short-lived code for the organizer screen to display.
 *
 * Admin-only, because anyone who can mint one can let people check in without
 * being present. The token carries the event id and expires in
 * CHECKIN_TOKEN_TTL_SECONDS, so the organizer screen re-fetches on that cadence
 * and a photograph of the projected code stops working almost immediately.
 */
eventRoutes.get('/:id/checkin-token', requireBoard, async (req, res) => {
  const event = await findEvent(eventId(req));

  const { token, expiresIn } = signCheckinToken(event.id);
  res.json({ token, expiresIn, event: toPublicEvent(event) });
});

eventRoutes.post('/', requireBoard, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = str(body.name);
  if (!name) throw badRequest('Name is required', 'name_required');

  const startsAt = parseInstant(body.startsAt, 'startsAt');
  const endsAt = parseInstant(body.endsAt, 'endsAt');
  if (endsAt < startsAt) throw badRequest('An event cannot end before it starts', 'ends_before_starts');

  const [created] = await db
    .insert(events)
    .values({
      // No googleCalendarEventId, which is what keeps the calendar sync from
      // ever touching this row.
      source: 'manual',
      name,
      description: str(body.description),
      location: str(body.location),
      tag: str(body.tag) || 'Event',
      points: body.points === undefined ? 0 : parsePoints(body.points),
      startsAt,
      endsAt,
      allDay: body.allDay === true,
      createdBy: req.currentUser!.email,
    })
    .returning();

  await recordAudit({
    actor: req.currentUser!,
    action: 'create',
    entity: 'event',
    entityId: created!.id,
    entityLabel: created!.name,
  });

  res.status(201).json({ event: toPublicEvent(created!) });
});

eventRoutes.patch('/:id', requireBoard, async (req, res) => {
  const existing = await findEvent(eventId(req));

  const body = (req.body ?? {}) as Record<string, unknown>;
  const update: Partial<typeof events.$inferInsert> = {};
  const edited: OverridableField[] = [];

  const note = (field: OverridableField) => {
    if (isOverridableField(field)) edited.push(field);
  };

  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) throw badRequest('Name cannot be empty', 'name_required');
    update.name = name;
    note('name');
  }
  if (body.description !== undefined) {
    update.description = str(body.description);
    note('description');
  }
  if (body.location !== undefined) {
    update.location = str(body.location);
    note('location');
  }
  if (body.tag !== undefined) {
    update.tag = str(body.tag) || 'Event';
    note('tag');
  }
  if (body.points !== undefined) {
    update.points = parsePoints(body.points);
    note('points');
  }
  if (body.startsAt !== undefined) {
    update.startsAt = parseInstant(body.startsAt, 'startsAt');
    note('startsAt');
  }
  if (body.endsAt !== undefined) {
    update.endsAt = parseInstant(body.endsAt, 'endsAt');
    note('endsAt');
  }
  if (body.allDay !== undefined) {
    update.allDay = body.allDay === true;
    note('allDay');
  }

  if (edited.length === 0) throw badRequest('No editable fields were provided', 'nothing_to_update');

  const startsAt = update.startsAt ?? existing.startsAt;
  const endsAt = update.endsAt ?? existing.endsAt;
  if (endsAt < startsAt) throw badRequest('An event cannot end before it starts', 'ends_before_starts');

  // Record the edit so the calendar sync leaves these fields alone from now on.
  // Only meaningful for calendar-sourced events: nothing syncs over a manual
  // one, so there is nothing to protect it from.
  if (existing.source === 'google_calendar') {
    update.overriddenFields = Array.from(new Set([...existing.overriddenFields, ...edited]));
  }

  const [updated] = await db
    .update(events)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(events.id, existing.id))
    .returning();

  // `edited` is already the exact set of fields this request changed, built
  // above for overridden_fields. No second diff needed.
  await recordAudit({
    actor: req.currentUser!,
    action: 'update',
    entity: 'event',
    entityId: updated!.id,
    entityLabel: updated!.name,
    changedFields: edited,
  });

  res.json({ event: toPublicEvent(updated!) });
});

eventRoutes.delete('/:id', requireBoard, async (req, res) => {
  // Return the name too: once the row is gone the audit entry is the only place
  // it survives, and a log of bare uuids answers nothing.
  const removed = await db
    .delete(events)
    .where(eq(events.id, eventId(req)))
    .returning({ id: events.id, name: events.name });

  if (removed.length === 0) throw notFoundError('That event does not exist', 'event_not_found');

  await recordAudit({
    actor: req.currentUser!,
    action: 'delete',
    entity: 'event',
    entityId: removed[0]!.id,
    entityLabel: removed[0]!.name,
  });

  // A calendar-sourced event deleted here comes back on the next sync, since
  // the calendar still lists it. Deleting it in Google Calendar is what makes
  // that permanent.
  res.status(204).end();
});
