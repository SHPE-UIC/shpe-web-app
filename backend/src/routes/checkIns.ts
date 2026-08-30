import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { verifyCheckinToken } from '../auth/tokens';
import { checkinWindow, describeClosedWindow } from '../checkin/window';
import { db } from '../db';
import { isUniqueViolation } from '../db/errors';
import { checkIns, events } from '../db/schema';
import { env } from '../env';
import { requireAuth } from '../middleware/auth';
import { badRequest, conflict, notFoundError } from '../middleware/errors';

export const checkInRoutes = Router();

checkInRoutes.use(requireAuth);

/**
 * Record attendance from a scanned QR code.
 *
 * The body carries a signed token rather than an event id. An id would be a
 * bare string anyone could read off a projected screen and reuse from home for
 * the rest of the event; the token expires in a minute and the organizer screen
 * re-renders it on that cadence.
 */
checkInRoutes.post('/', async (req, res) => {
  const token = (req.body as { token?: unknown } | null)?.token;
  if (typeof token !== 'string' || !token) {
    throw badRequest('That QR code could not be read', 'token_required');
  }

  // Throws 401 with qr_expired or qr_invalid, and refuses a session token.
  const { eventId } = verifyCheckinToken(token);

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw notFoundError('That event no longer exists', 'event_not_found');

  const window = checkinWindow(event, new Date(), env.checkinEarlyMinutes);
  if (!window.open) {
    throw badRequest(describeClosedWindow(window), `checkin_${window.reason}`);
  }

  try {
    const [created] = await db
      .insert(checkIns)
      .values({
        userId: req.currentUser!.id,
        eventId: event.id,
        // Snapshot, not a join: recolouring the event later changes what it is
        // worth going forward, and must not revalue attendance already taken.
        points: event.points,
      })
      .returning();

    res.status(201).json({
      checkIn: {
        id: created!.id,
        eventId: event.id,
        eventName: event.name,
        points: created!.points,
        createdAt: created!.createdAt.toISOString(),
      },
    });
  } catch (err) {
    // The unique index on (user_id, event_id) is what actually rejects a second
    // scan — checking first would still race two taps against each other.
    if (isUniqueViolation(err)) {
      throw conflict(`You are already checked in to ${event.name}.`, 'already_checked_in');
    }
    throw err;
  }
});

/** The signed-in member's own attendance, newest first. */
checkInRoutes.get('/me', async (req, res) => {
  const rows = await db
    .select({
      id: checkIns.id,
      eventId: checkIns.eventId,
      eventName: events.name,
      points: checkIns.points,
      createdAt: checkIns.createdAt,
    })
    .from(checkIns)
    .innerJoin(events, eq(checkIns.eventId, events.id))
    .where(eq(checkIns.userId, req.currentUser!.id))
    .orderBy(desc(checkIns.createdAt));

  res.json({
    checkIns: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    totals: {
      events: rows.length,
      points: rows.reduce((sum, row) => sum + row.points, 0),
    },
  });
});
