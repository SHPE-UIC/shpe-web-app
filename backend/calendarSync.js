import { Timestamp } from 'firebase-admin/firestore';
import { tagForColorId } from './config/eventTags.js';
import { calendarOwnedFields } from './eventMapping.js';
import { db } from './firebase.js';
import { fetchCalendarChanges, SyncTokenExpiredError } from './googleCalendar.js';

const SYNC_STATE_DOC = 'sync/googleCalendar';
const EVENTS_COLLECTION = 'events';

async function applyEvent(ev, timeZone, stats) {
  const ref = db.collection(EVENTS_COLLECTION).doc(ev.id);

  if (ev.status === 'cancelled') {
    await ref.delete();
    stats.deleted += 1;
    return;
  }

  const existing = await ref.get();
  const { tag, points } = tagForColorId(ev.colorId);
  const { startAtDate, endAtDate, ...fields } = calendarOwnedFields(ev, timeZone);
  const payload = {
    ...fields,
    tag,
    startAt: Timestamp.fromDate(startAtDate),
    endAt: Timestamp.fromDate(endAtDate),
    updatedAt: Timestamp.now(),
  };

  // Points follow the tag, but only when the tag is actually being set for the
  // first time or changed. That way recoloring an event updates its worth,
  // while a manual override in Firestore survives unrelated calendar edits.
  if (!existing.exists) {
    payload.points = points;
    payload.createdAt = Timestamp.now();
    payload.createdBy = 'google-calendar-sync';
    stats.created += 1;
  } else {
    if (existing.get('tag') !== tag) payload.points = points;
    stats.updated += 1;
  }

  await ref.set(payload, { merge: true });
}

/**
 * Pull calendar changes into Firestore. Uses an incremental syncToken when one
 * is stored, so a run with no calendar activity costs a single API call.
 */
export async function syncCalendar({ forceFullSync = false } = {}) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID is not set');

  const stateRef = db.doc(SYNC_STATE_DOC);
  const state = await stateRef.get();
  let syncToken = forceFullSync ? undefined : state.get('nextSyncToken');

  let changes;
  try {
    changes = await fetchCalendarChanges(calendarId, syncToken);
  } catch (err) {
    if (!(err instanceof SyncTokenExpiredError)) throw err;
    // Token too old to describe the delta — start over from scratch.
    console.warn('[calendar-sync] syncToken expired, running full sync');
    syncToken = undefined;
    changes = await fetchCalendarChanges(calendarId, undefined);
  }

  const stats = { created: 0, updated: 0, deleted: 0 };
  for (const ev of changes.events) {
    await applyEvent(ev, changes.timeZone, stats);
  }

  await stateRef.set(
    {
      nextSyncToken: changes.nextSyncToken ?? null,
      lastSyncedAt: Timestamp.now(),
      lastResult: stats,
    },
    { merge: true },
  );

  return { ...stats, fullSync: !syncToken, seen: changes.events.length };
}

let running = false;

/** Runs a sync, skipping if the previous one is still in flight. */
export async function runSyncSafely(options) {
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
    console.error('[calendar-sync] failed:', err.message);
    throw err;
  } finally {
    running = false;
  }
}

export function startCalendarSyncLoop() {
  const minutes = Number(process.env.CALENDAR_SYNC_INTERVAL_MINUTES ?? 15);

  runSyncSafely().catch(() => {});
  const timer = setInterval(() => {
    runSyncSafely().catch(() => {});
  }, minutes * 60 * 1000);

  // Don't hold the event loop open on shutdown.
  timer.unref();
  console.log(`[calendar-sync] polling every ${minutes} minute(s)`);
  return timer;
}
