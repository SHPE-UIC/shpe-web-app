import { asc, desc, eq, lt, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { recordAudit } from '../audit';
import { auditLog, checkIns, events, users } from '../db/schema';
import { requireAuth, requireBoard, requireTop8 } from '../middleware/auth';
import { badRequest, conflict, forbidden, notFoundError } from '../middleware/errors';
import { ROLE, isRole, roleLabel } from '../roles';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function routeId(req: { params: Record<string, string | string[]> }): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : raw ?? '';
  if (!UUID.test(id)) throw notFoundError('Not found', 'not_found');
  return id;
}

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireBoard);

/**
 * Headline numbers for the dashboard.
 *
 * Deliberately excludes the demographic column. Gender is collected at signup
 * but is not engagement data, and putting it on a screen every officer can
 * open is a privacy cost with no analytical return. See docs/PERMISSIONS.md.
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
      board: sql<number>`count(*) filter (where ${users.role} >= ${ROLE.BOARD})::int`,
      topEight: sql<number>`count(*) filter (where ${users.role} >= ${ROLE.TOP8})::int`,
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
 * and attendance. No gender.
 */
adminRoutes.get('/members', async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      schoolLevel: users.schoolLevel,
      memberId: users.memberId,
      role: users.role,
      createdAt: users.createdAt,
      eventsAttended: sql<number>`count(${checkIns.id})::int`,
      pointsEarned: sql<number>`coalesce(sum(${checkIns.points}), 0)::int`,
    })
    .from(users)
    .leftJoin(checkIns, eq(checkIns.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(sql`count(${checkIns.id})`), asc(users.name));

  res.json({
    members: rows.map((row) => ({
      ...row,
      roleLabel: roleLabel(row.role),
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

/**
 * Set another member's level. Top 8 only.
 *
 * Two refusals stand between this and a chapter locked out of its own admin
 * tools, because nothing short of SQL against the database could undo either:
 *
 *  - you cannot change your own level, which is the likely mis-tap
 *  - the number of top 8s can never reach zero
 *
 * Both are enforced here rather than in the UI, which only hides the controls.
 */
adminRoutes.patch('/members/:id/role', requireTop8, async (req, res) => {
  const targetId = routeId(req);
  const role = (req.body as { role?: unknown } | null)?.role;

  if (!isRole(role)) {
    throw badRequest('Role must be 0 (member), 1 (board member), or 2 (top 8)', 'role_invalid');
  }

  if (targetId === req.currentUser!.id) {
    throw forbidden(
      'You cannot change your own level. Ask another top 8 to do it.',
      'cannot_change_own_role',
    );
  }

  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) throw notFoundError('That member does not exist', 'member_not_found');

  if (target.role === role) {
    throw badRequest(`${target.name} is already a ${roleLabel(role)}.`, 'role_unchanged');
  }

  // Demoting the last top 8 would leave nobody able to promote anyone, and no
  // endpoint could recover it.
  if (target.role === ROLE.TOP8 && role < ROLE.TOP8) {
    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*) filter (where ${users.role} >= ${ROLE.TOP8})::int` })
      .from(users);

    if (remaining <= 1) {
      throw conflict(
        'This is the only Top 8. Promote someone else first, or the chapter would have nobody who can manage levels.',
        'last_top8',
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, targetId))
    .returning();

  void recordAudit({
    actor: req.currentUser!,
    action: 'update',
    entity: 'member',
    entityId: updated!.id,
    entityLabel: updated!.name,
    changedFields: [`role: ${roleLabel(target.role)} to ${roleLabel(role)}`],
  });

  res.json({
    member: {
      id: updated!.id,
      name: updated!.name,
      email: updated!.email,
      role: updated!.role,
      roleLabel: roleLabel(updated!.role),
    },
  });
});
