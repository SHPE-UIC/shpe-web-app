import { google } from 'googleapis';
import type { GoogleEvent } from './eventMapping';
import { loadServiceAccount } from './serviceAccount';

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

/** How far back a full sync reaches. Older events are never worth importing. */
const FULL_SYNC_LOOKBACK_DAYS = 30;

export class SyncTokenExpiredError extends Error {}

export type CalendarChanges = {
  events: GoogleEvent[];
  nextSyncToken?: string | null;
  timeZone?: string | null;
};

/**
 * Built lazily so that importing this module does not require credentials.
 * The API boots fine without calendar sync configured, and the sync itself is
 * where a missing key should be reported.
 */
function calendarClient() {
  const auth = new google.auth.GoogleAuth({
    // null credentials mean Application Default Credentials: the Cloud Run
    // runtime service account, whose email the calendar is shared with.
    credentials: loadServiceAccount() ?? undefined,
    scopes: CALENDAR_SCOPES,
  });
  return google.calendar({ version: 'v3', auth });
}

/**
 * Fetch changed events, following pagination to the end.
 *
 * With a syncToken Google returns only what changed since the last call —
 * including deletions, which arrive as `status: 'cancelled'`. Without one it
 * returns everything from FULL_SYNC_LOOKBACK_DAYS onward. The two modes take
 * different parameters: the API rejects a request sending both a syncToken and
 * filters like timeMin.
 */
export async function fetchCalendarChanges(
  calendarId: string,
  syncToken?: string | null,
): Promise<CalendarChanges> {
  const calendar = calendarClient();

  const baseParams = syncToken
    ? { calendarId, syncToken }
    : {
        calendarId,
        timeMin: new Date(
          Date.now() - FULL_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        // Expands recurring events into individual dated instances. This must
        // stay consistent between calls or the syncToken is rejected.
        singleEvents: true,
      };

  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null | undefined;
  let timeZone: string | null | undefined;

  do {
    let res;
    try {
      res = await calendar.events.list({ ...baseParams, pageToken, maxResults: 250 });
    } catch (err) {
      // 410 means the token is too old to describe the delta; the caller must
      // discard it and run a full sync instead.
      const status = (err as { code?: number; response?: { status?: number } }).code
        ?? (err as { response?: { status?: number } }).response?.status;
      if (status === 410) throw new SyncTokenExpiredError('Calendar syncToken expired');
      throw err;
    }

    events.push(...((res.data.items ?? []) as GoogleEvent[]));
    pageToken = res.data.nextPageToken ?? undefined;
    nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
    timeZone = res.data.timeZone ?? timeZone;
  } while (pageToken);

  return { events, nextSyncToken, timeZone };
}
