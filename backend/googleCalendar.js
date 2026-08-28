import { google } from 'googleapis';
import { loadServiceAccount } from './serviceAccount.js';

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// The same service account key used for firebase-admin also authenticates to
// the Calendar API — the calendar just has to be shared with its email address.
const auth = new google.auth.GoogleAuth({
  credentials: loadServiceAccount(),
  scopes: CALENDAR_SCOPES,
});

const calendar = google.calendar({ version: 'v3', auth });

/** How far back a full sync reaches. Older events are never worth importing. */
const FULL_SYNC_LOOKBACK_DAYS = 30;

export class SyncTokenExpiredError extends Error {}

/**
 * Fetch changed events, following pagination to the end.
 *
 * With a syncToken Google returns only what changed since the last call —
 * including deletions, which arrive as `status: 'cancelled'`. Without one it
 * returns everything from FULL_SYNC_LOOKBACK_DAYS onward. The two modes take
 * different parameters: the API rejects a request that sends both syncToken
 * and filters like timeMin.
 *
 * @returns {Promise<{ events: object[], nextSyncToken: string, timeZone: string }>}
 */
export async function fetchCalendarChanges(calendarId, syncToken) {
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

  const events = [];
  let pageToken;
  let nextSyncToken;
  let timeZone;

  do {
    let res;
    try {
      res = await calendar.events.list({ ...baseParams, pageToken, maxResults: 250 });
    } catch (err) {
      // 410 means the token is too old to describe the delta; caller must
      // discard it and run a full sync instead.
      if (err.code === 410 || err.response?.status === 410) {
        throw new SyncTokenExpiredError('Calendar syncToken expired');
      }
      throw err;
    }

    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken;
    nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
    timeZone = res.data.timeZone ?? timeZone;
  } while (pageToken);

  return { events, nextSyncToken, timeZone };
}
