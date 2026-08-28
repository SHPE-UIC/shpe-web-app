# SHPE @ UIC

Mobile app for the UIC chapter of the Society of Hispanic Professional Engineers.
Built with Expo (React Native) and Firebase.

For the implementation snapshot, verification results, known gaps, and next
work, see [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

Events are **not entered in the app**. Officers add them to the chapter Google
Calendar, and a sync job copies them into Firestore, where the app reads them
live. See [Adding events](#adding-events-for-officers) below.

```
Google Calendar  ──►  sync job  ──►  Firestore  ──►  Expo app
"SHPE @ UIC"          every 30min                    (live, no refresh)
```

---

## Repo layout

This repo contains **two separate npm packages**. They each have their own
`package.json`, `node_modules`, and `.env` — installing one does not install
the other.

| Path | What it is |
|---|---|
| [`frontend/`](frontend/) | The Expo app. This is the actual product. |
| [`backend/`](backend/) | Node scripts: the Google Calendar → Firestore sync. Run on a schedule, not as a always-on server. |
| [`.github/workflows/`](.github/workflows/) | The scheduled sync job. |

Root `package.json` covers `backend/`. `frontend/package.json` covers the app.

---

## Setup

### Prerequisites

- **Node 20 or newer** (developed on 22)
- A phone with [Expo Go](https://expo.dev/go), or an iOS/Android simulator
- Access to the `shpe-webapp` Firebase project

### 1. Install dependencies

Both trees, separately:

```bash
npm install            # backend
cd frontend
npm install            # the app
```

### 2. Configure the app

Create **`frontend/.env`** — copy [`frontend/example.env`](frontend/example.env)
and fill in the real values from Firebase Console → Project settings → Your apps.

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

The **`EXPO_PUBLIC_` prefix is required.** Expo ignores any other variable name,
and a misnamed key fails silently — the app starts and then errors on the first
Firestore call. These values are baked into the app bundle, which is expected
for Firebase web config; Firestore rules are what actually protect the data.

### 3. Run it

```bash
cd frontend
npx expo start
```

Scan the QR code with Expo Go, or press `i` / `a` for a simulator.

> **After changing `.env`, always restart with `npx expo start -c`.** Environment
> values are inlined at build time, so a warm cache keeps serving the old ones.

That's everything needed to work on the UI. The sections below are only for
working on the calendar sync.

---

## Adding events (for officers)

Create the event in the **SHPE @ UIC** Google Calendar. Within 30 minutes it
appears in the app for everyone — no deploy, no app update.

**1. Fill in the event normally.** These fields carry over:

| In Google Calendar | Shows in the app as |
|---|---|
| Title | Event name |
| Date and time | Date badge and time range |
| Location | Location |
| Description | "About This Event" |

**2. Set the event color.** This is the important one — **the color decides the
category and how many points the event is worth.**

| Color | Category | Points |
|---|---|---|
| Blueberry | GBM | 3 |
| Tangerine | Career | 3 |
| Tomato | Career | 3 |
| Basil | Volunteer | 3 |
| Sage | Volunteer | 3 |
| Peacock | Workshop | 2 |
| Banana | Fundraiser | 2 |
| Lavender | Social | 1 |
| Grape | Social | 1 |
| Flamingo | Study | 1 |
| Graphite | Other | 0 |
| *(no color set)* | Event | 1 |

Leaving the color at the calendar default gives you a generic "Event" worth 1
point, so it's worth picking one deliberately.

To change these categories or point values, edit
[`backend/config/eventTags.js`](backend/config/eventTags.js).

### Things worth knowing

- **Editing an event updates the app.** Change the title, time, or location and
  the change syncs on the next run.
- **Deleting an event removes it from the app**, within 30 minutes.
- **Recoloring changes the points.** If someone manually overrode an event's
  points in Firestore, that override survives ordinary edits — but recoloring
  the event resets points to the new color's value.
- **Past events disappear automatically.** The app only lists events that
  haven't ended yet, so there's no cleanup to do.
- **The calendar is public.** Titles, descriptions, and locations are readable
  by anyone with the link, and the sync copies them verbatim into the app. Don't
  put anything internal in the description.
- **All-day events** show as "All Day" rather than a time range.

---

## The calendar sync

### How it runs

[`.github/workflows/calendar-sync.yml`](.github/workflows/calendar-sync.yml)
runs every 30 minutes on GitHub Actions. Nothing needs to be deployed or kept
awake — the app talks to Firestore directly, so there's no server in the request
path.

To run it by hand: **Actions → Calendar sync → Run workflow.** Tick **full** to
ignore the stored sync token and re-import everything from the last 30 days.

> Scheduled workflows only run from the **default branch**. On a feature branch
> the job won't appear in the Actions tab at all.

### Running it locally

Needs root `.env` (see [`example.env`](example.env)) plus a service account key:

```
GOOGLE_CALENDAR_ID=5181cd695daacda195419f54943289d80830f2df1dc992e614a30c8a34cee147@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./serviceAccountKey.json
```

Get the key from Firebase Console → Project settings → Service accounts →
Generate new private key. Then, one time in Google Cloud Console, enable the
**Google Calendar API** and share the calendar with the key's `client_email`
("See all event details").

```bash
npm run sync          # incremental
npm run sync:full     # re-import from scratch
npm run backend       # Express server, exposes POST /api/sync/calendar
```

Both `.env` files and `serviceAccountKey.json` are gitignored. Never commit them.

### How it works

Google's API returns a **sync token** — pass it back on the next call and you
get only what changed since, including deletions. A run with no calendar
activity is a single API call.

| File | Role |
|---|---|
| [`backend/syncOnce.js`](backend/syncOnce.js) | Entry point for the scheduled job |
| [`backend/calendarSync.js`](backend/calendarSync.js) | Sync token state, merge rules |
| [`backend/googleCalendar.js`](backend/googleCalendar.js) | Calendar API + pagination |
| [`backend/eventMapping.js`](backend/eventMapping.js) | Google event → app schema |
| [`backend/config/eventTags.js`](backend/config/eventTags.js) | Color → category → points |

---

## Data model

`events/{googleCalendarEventId}` in Firestore:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Event title |
| `description` | string | |
| `location` | string | |
| `tag` | string | From the event color |
| `points` | number | From the tag; survives manual override |
| `date` | string | `"01/15/2026"` |
| `startsAt` / `endsAt` | string | `"6:00 PM"`, or `"All Day"` |
| `startAt` / `endAt` | timestamp | Real instants, for future queries |
| `allDay` | boolean | |
| `googleCalendarEventId` | string | |
| `createdAt` / `updatedAt` | timestamp | |

The app reads these through [`frontend/lib/events.ts`](frontend/lib/events.ts),
which exposes two hooks:

- `useUpcomingEvents()` — live list, past events filtered out, soonest first
- `useEvent(id)` — one event, so the detail screen works from a deep link

Both use Firestore's `onSnapshot`, so edits appear without a refresh.

> **Known limitation:** because `date` and `startsAt` are display strings,
> Firestore can't sort or filter them — `useUpcomingEvents` downloads the whole
> collection and filters on the device. Fine at club scale; switch the query to
> the `startAt` timestamp if the collection grows into the thousands.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| App shows "Couldn't load events" | Firestore rules deny reads, or `frontend/.env` is missing/misnamed |
| Firebase config values are `undefined` | Variables not prefixed `EXPO_PUBLIC_`, or Metro cache is stale — `npx expo start -c` |
| Sync reports `created: 0, seen: 0` | No upcoming events on the calendar |
| Sync fails with `403` | Calendar API not enabled, or calendar not shared with the service account |
| `Service account key not found` | `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` is wrong, or the Actions secret `GOOGLE_SERVICE_ACCOUNT_JSON` is missing |
| Event added but not in the app | Wait for the next 30-minute run, or trigger one manually; check the event hasn't already ended |
