import { asc, desc, eq, lt, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { auditLog, checkIns, events, users } from '../db/schema';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { notFoundError } from '../middleware/errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function routeId(req: { params: Record<string, string | string[]> }): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : raw ?? '';
  if (!UUID.test(id)) throw notFoundError('That event does not exist', 'event_not_found');
  return id;
}

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAdmin);

/**
 * Headline numbers for the dashboard.
 *
 * Deliberately excludes every demographic column. Age, sex at birth, and gender
 * are collected at signup but are not engagement data, and putting them on a
 * screen every officer can open is a privacy cost with no analytical return.
 * See docs/PERMISSIONS.md.
 */
adminRoutes.get('/overview', async (_req, res) => {
  const [eventStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      upcoming: sql<number>`count(*) filter (where ${events.endsAt} >= now())::int`,
      past: sql<number>`count(*) filter (where ${events.endsAt} < now())::int`,
      fromCalendar: sql<number>`count(*) filter (where ${events.source} = 'google_calendar')::int`,
    })
    .from(events);

  const [memberStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      officers: sql<number>`count(*) filter (where ${users.isAdmin})::int`,
      joinedLast30Days: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '30 days')::int`,
    })
    .from(users);

  const [checkInStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      uniqueAttendees: sql<number>`count(distinct ${checkIns.userId})::int`,
      pointsAwarded: sql<number>`coalesce(sum(${checkIns.points}), 0)::int`,
    })
    .from(checkIns);

  /**
   * Attendance averaged over events that have finished.
   *
   * Both halves must come from the same population. Dividing *all* check-ins by
   * the number of finished events counts attendance at events still in progress
   * against a denominator that excludes them, which inflates the average — it
   * read 3.0 in testing when the only finished event had nobody there.
   */
  const [finished] = await db
    .select({
      events: sql<number>`count(distinct ${events.id})::int`,
      checkIns: sql<number>`count(${checkIns.id})::int`,
    })
    .from(events)
    .leftJoin(checkIns, eq(checkIns.eventId, events.id))
    .where(lt(events.endsAt, sql`now()`));

  const totalMembers = memberStats?.total ?? 0;
  const finishedEvents = finished?.events ?? 0;
  const uniqueAttendees = checkInStats?.uniqueAttendees ?? 0;

  res.json({
    events: eventStats,
    members: memberStats,
    checkIns: checkInStats,

    // The numbers an officer can actually act on, rather than raw totals.
    engagement: {
      averageAttendance:
        finishedEvents > 0
          ? Math.round(((finished?.checkIns ?? 0) / finishedEvents) * 10) / 10
          : 0,

      /** So the app can say "no finished events yet" rather than showing 0. */
      finishedEvents,

      // Share of members who have ever checked in.
      participationRate:
        totalMembers > 0 ? Math.round((uniqueAttendees / totalMembers) * 100) : 0,

      neverAttended: Math.max(totalMembers - uniqueAttendees, 0),
    },
  });
});

/** Every event with its attendance, newest first. */
adminRoutes.get('/events', async (_req, res) => {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      tag: events.tag,
      points: events.points,
      source: events.source,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      // leftJoin so an event nobody attended still appears, with zero.
      attendees: sql<number>`count(${checkIns.id})::int`,
    })
    .from(events)
    .leftJoin(checkIns, eq(checkIns.eventId, events.id))
    .groupBy(events.id)
    .orderBy(desc(events.startsAt));

  res.json({
    events: rows.map((row) => ({
      ...row,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    })),
  });
});

/** Who checked in to one event. */
adminRoutes.get('/events/:id/attendance', async (req, res) => {
  const id = routeId(req);

  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) throw notFoundError('That event does not exist', 'event_not_found');

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      schoolLevel: users.schoolLevel,
      points: checkIns.points,
      checkedInAt: checkIns.createdAt,
    })
    .from(checkIns)
    .innerJoin(users, eq(checkIns.userId, users.id))
    .where(eq(checkIns.eventId, id))
    .orderBy(asc(checkIns.createdAt));

  res.json({
    event: {
      id: event.id,
      name: event.name,
      tag: event.tag,
      points: event.points,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    },
    attendance: rows.map((row) => ({
      ...row,
      checkedInAt: row.checkedInAt.toISOString(),
    })),
  });
});

/**
 * Recent officer changes, newest first.
 *
 * Reads the snapshot columns rather than joining users and events, so an entry
 * still makes sense after the officer or the thing they changed is deleted —
 * which is exactly when a log is worth having.
 */
adminRoutes.get('/activity', async (req, res) => {
  const requested = Number(req.query.limit);
  const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 200) : 50;

  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  res.json({
    activity: rows.map((row) => ({
      id: row.id,
      actorEmail: row.actorEmail,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      changedFields: row.changedFields,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

/**
 * The member roster, most engaged first.
 *
 * Note the select list: name, email, school level, member ID, role, join date,
 * and attendance. No age, sex at birth, or gender.
 */
adminRoutes.get('/members', async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      schoolLevel: users.schoolLevel,
      memberId: users.memberId,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      eventsAttended: sql<number>`count(${checkIns.id})::int`,
      pointsEarned: sql<number>`coalesce(sum(${checkIns.points}), 0)::int`,
    })
    .from(users)
    .leftJoin(checkIns, eq(checkIns.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(sql`count(${checkIns.id})`), asc(users.name));

  res.json({
    members: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
});
