import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { events, syncState } from '../db/schema';
import { env } from '../env';
import { calendarOwnedFields, type GoogleEvent } from './eventMapping';
import { fetchCalendarChanges, SyncTokenExpiredError } from './googleCalendar';
import { mergeCalendarEvent } from './merge';

const SYNC_KEY = 'googleCalendar';

export type SyncStats = {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
};

async function applyEvent(
  event: GoogleEvent,
  timeZone: string | null | undefined,
  stats: SyncStats,
): Promise<void> {
  // Deletions arrive as cancelled events. The source filter is what stops a
  // calendar deletion from removing an event an admin created in the app —
  // those have no googleCalendarEventId, so they cannot match anyway, but the
  // filter states the intent rather than relying on that.
  if (event.status === 'cancelled') {
    const removed = await db
      .delete(events)
      .where(
        and(
          eq(events.googleCalendarEventId, event.id),
          eq(events.source, 'google_calendar'),
        ),
      )
      .returning({ id: events.id });

    stats.deleted += removed.length;
    return;
  }

  const incoming = calendarOwnedFields(event, timeZone);

  // An event whose dates will not parse would poison a NOT NULL column. Skip it
  // rather than failing the whole sync over one malformed entry.
  if (Number.isNaN(incoming.startsAt.getTime()) || Number.isNaN(incoming.endsAt.getTime())) {
    console.warn(`[calendar-sync] skipping ${event.id}: unparseable start or end`);
    return;
  }

  const [existing] = await db
    .select({
      id: events.id,
      tag: events.tag,
      points: events.points,
      overriddenFields: events.overriddenFields,
    })
    .from(events)
    .where(eq(events.googleCalendarEventId, event.id))
    .limit(1);

  if (!existing) {
    await db.insert(events).values({
      googleCalendarEventId: event.id,
      source: 'google_calendar',
      createdBy: 'google-calendar-sync',
      ...incoming,
    });
    stats.created += 1;
    return;
  }

  const update = mergeCalendarEvent(incoming, existing);

  // Every field is overridden by an admin, so there is nothing for the calendar
  // to say. Skip the write rather than bumping updatedAt for no reason.
  if (Object.keys(update).length === 0) {
    stats.unchanged += 1;
    return;
  }

  await db
    .update(events)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(events.id, existing.id));
  stats.updated += 1;
}

/**
 * Pull calendar changes into Postgres. Uses the stored incremental syncToken
 * when there is one, so a run with no calendar activity costs a single API call.
 */
export async function syncCalendar({ forceFullSync = false } = {}) {
  const calendarId = env.googleCalendarId;
  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID is not set, so there is no calendar to sync');
  }

  const [state] = await db.select().from(syncState).where(eq(syncState.key, SYNC_KEY)).limit(1);
  let token = forceFullSync ? undefined : state?.nextSyncToken ?? undefined;

  let changes;
  try {
    changes = await fetchCalendarChanges(calendarId, token);
  } catch (err) {
    if (!(err instanceof SyncTokenExpiredError)) throw err;
    // The token is too old to describe the delta. Start over.
    console.warn('[calendar-sync] syncToken expired, running a full sync');
    token = undefined;
    changes = await fetchCalendarChanges(calendarId, undefined);
  }

  const stats: SyncStats = { created: 0, updated: 0, unchanged: 0, deleted: 0 };
  for (const event of changes.events) {
    await applyEvent(event, changes.timeZone, stats);
  }

  const record = {
    key: SYNC_KEY,
    nextSyncToken: changes.nextSyncToken ?? null,
    lastSyncedAt: new Date(),
    lastResult: stats,
  };
  await db.insert(syncState).values(record).onConflictDoUpdate({
    target: syncState.key,
    set: record,
  });

  return { ...stats, fullSync: !token, seen: changes.events.length };
}

let running = false;

/** Runs a sync, skipping if the previous one is still in flight. */
export async function runSyncSafely(options?: { forceFullSync?: boolean }) {
  if (running) {
    console.log('[calendar-sync] previous run still in progress, skipping');
    return null;
  }

  running = true;
  try {
    const result = await syncCalendar(options);
    console.log('[calendar-sync]', result);
    return result;
  } catch (err) {
    console.error('[calendar-sync] failed:', err instanceof Error ? err.message : err);
    throw err;
  } finally {
    running = false;
  }
}

export function startCalendarSyncLoop() {
  if (!env.googleCalendarId) {
    console.log('[calendar-sync] GOOGLE_CALENDAR_ID is not set, sync loop not started');
    return null;
  }

  const minutes = env.calendarSyncIntervalMinutes;

  runSyncSafely().catch(() => {});
  const timer = setInterval(() => {
    runSyncSafely().catch(() => {});
  }, minutes * 60 * 1000);

  // Do not hold the event loop open on shutdown.
  timer.unref();
  console.log(`[calendar-sync] polling every ${minutes} minute(s)`);
  return timer;
}
