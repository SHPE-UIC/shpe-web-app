# SHPE @ UIC — member app

Events, check-ins, and announcements for the UIC chapter of the Society of
Hispanic Professional Engineers.

Members sign in with their UIC email, browse upcoming events, and check in by
scanning a QR code an officer displays. Officers create events and post
announcements from inside the app.

| | |
|---|---|
| **App** | https://shpe-web-app.vercel.app |
| **API** | https://shpe-api.onrender.com |

Everything runs on free tiers, and nothing expires on its own.

---

## Contents

- [How it fits together](#how-it-fits-together)
- [Repository layout](#repository-layout)
- [Running it locally](#running-it-locally)
- [How the pieces work](#how-the-pieces-work)
- [Checks](#checks)
- [Deploying a change](#deploying-a-change)
- [What is not built yet](#what-is-not-built-yet)
- [Further reading](#further-reading)

---

## How it fits together

```
Google Calendar ─┐
  (board)        ├──► Render ─────────► Neon Postgres
Admin screens ───┘    Express + Drizzle
  (in-app)              │
                        ▼
                     Vercel
                Expo web export
```

| Piece | Runs on | Why there |
|---|---|---|
| Database | **Neon**, via the Vercel Marketplace | Render's own free Postgres expires after 30 days. Neon's does not. |
| API | **Render** | Free web service. Sleeps when idle — see [DEPLOYMENT.md](docs/DEPLOYMENT.md). |
| App | **Vercel** | Static Expo web export served from a CDN. |

The app is Expo, so the same code also builds for iOS and Android. Only the web
build is deployed today.

**Tech:** Expo SDK 54 · Expo Router · React Native 0.81 · React 19 · TypeScript
(strict) · Express 5 · Drizzle ORM · PostgreSQL 17 · Vitest

---

## Repository layout

```
backend/src/
  index.ts            entry point: starts the server and the calendar sync loop
  app.ts              Express app: CORS, routes, error handling, health checks
  env.ts              every environment variable, validated on import
  roles.ts            the three membership levels and the checks over them
  validation.ts       registration and login input rules
  audit.ts            records officer changes; never fails the operation
  syncOnce.ts         entry point for a one-shot calendar sync

  routes/             one file per resource
  middleware/         requireAuth, requireBoard, requireTop8, error handling
  auth/               token signing/verification, the public user shape
  db/                 Drizzle schema, client, migrator
  calendar/           Google Calendar sync and the merge rule
  checkin/            the check-in time window

frontend/
  app/                screens; the file tree is the route tree (Expo Router)
    (tabs)/           home, events, check-in, profile, dashboard (board+)
    admin/            event and announcement editors, attendance,
                      member roster, and the level picker
    organizer/        the rotating check-in QR code
  components/         shared UI
  lib/                data fetching, API client, roles, formatting, storage
  contexts/           AuthContext
  constants/theme.ts  the single source of colours, radii, and shadows
  __tests__/          screen tests — never under app/, see Checks below
  jest.config.js      jest-expo setup and native-module mocks
  jest.setup.ts

drizzle/              generated SQL migrations (committed)
docs/                 deployment and permissions
```

Screens never call `fetch` directly. Each resource has a module in
`frontend/lib/` exposing a hook — `useUpcomingEvents`, `useAnnouncements`,
`useMyCheckIns`, and the dashboard's `useAdminOverview`, `useMembers`,
`useRecentActivity` — and every request goes through `lib/api/client.ts`, which
attaches the session token and turns error responses into typed `ApiError`s.

`roles.ts` exists twice on purpose, once each side. The server's copy decides
what is allowed; the app's decides what to render.

---

## Running it locally

You need **Node 22+** and a Postgres database. Docker gives you one in a
command; alternatively point at your Neon database.

### 1. Database

```bash
docker run -d --name shpe-pg -e POSTGRES_USER=shpe -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=shpe -p 55432:5432 postgres:17-alpine
```

### 2. API

```bash
cp example.env .env
```

Set two values in `.env`:

- `DATABASE_URL` — `postgresql://shpe:devpass@localhost:55432/shpe` for the
  container above
- `JWT_SECRET` — any long random string:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

Then:

```bash
npm install && npm run db:migrate && npm start
```

The API listens on port 5000. `curl localhost:5000/healthz/db` should return
`{"ok":true,...}` — that confirms it is running *and* reached the database.

### 3. App

In a second terminal:

```bash
cd frontend && cp example.env .env && npm install && npx expo start -c
```

`frontend/.env` needs `EXPO_PUBLIC_API_URL=http://localhost:5000`. Press `w` for
web, or scan the QR code with Expo Go.

> The `EXPO_PUBLIC_` prefix is required — Expo ignores any other name, and the
> app then fails at its first API call with no explanation. Values are baked in
> at build time, so restart with `-c` after changing them.

### 4. Make yourself a Top 8

Registering gives you a Member account (`role = 0`). Levels are `0` member,
`1` board member, `2` top 8 — and only a Top 8 can change levels, so the first
one is a database step:

```sql
UPDATE users SET role = 2 WHERE email = 'you@uic.edu';
```

It takes effect on your next request — no need to sign out. From there you can
promote and demote everyone else in the app.

---

## How the pieces work

### Accounts and sessions

Registration is restricted to `@uic.edu` addresses, checked on the server rather
than only in the form. Passwords are hashed with bcrypt. Signing in returns a
JWT that the app stores in `expo-secure-store` on native and `localStorage` on
web, since SecureStore has no web implementation.

`requireAuth` re-reads the member's row on every request instead of trusting the
token's claims, so promoting or deleting an account takes effect immediately
rather than whenever the token expires.

**Three levels**, stored as the integer `users.role` and ordered so every check
is "this level or above": `0` member, `1` board member, `2` top 8. Board members
run events and announcements; a Top 8 additionally sets other people's level,
from Dashboard → View members. Two server-side refusals keep the chapter from
locking itself out: nobody can change their own level, and the number of Top 8s
can never reach zero. See [PERMISSIONS.md](docs/PERMISSIONS.md).

### Events, from two directions

Events come from **Google Calendar** or from an **officer using the app**, and
both can be true of the same event.

Officers colour an event in Google Calendar, and the colour sets its category
and point value ([`eventTags.ts`](backend/src/calendar/eventTags.ts)). The sync
pulls changes into Postgres.

When an officer edits a synced event in the app, that specific field is recorded
in `events.overridden_fields` and stops tracking the calendar. Everything they
leave alone keeps updating. It is per-field on purpose: locking the whole row
would mean one corrected typo freezes the event's *time* against every later
calendar change, which is how someone ends up somewhere at the wrong hour.

Events created in the app have no calendar id, so the sync never touches them.

### Check-in

A QR code carries a **signed token that expires in 60 seconds**, not an event
id. An id would be a bare string anyone could read off a projected screen and
reuse from home; the organizer screen re-renders the code as it expires.

**The camera runs only on that tab.** Tab screens stay mounted once visited, and
`expo-camera` has no imperative stop — unmounting `CameraView` is what releases
the device. Leaving the tab unmounts it and clears any result, so returning
gives a fresh scanner.

A scan is refused unless the event is running — from 30 minutes before it starts
until it ends — and the unique index on `(user_id, event_id)` rejects a second
scan. Each check-in stores a **snapshot** of the event's point value, so
re-tagging an event later cannot change what someone already earned.

### The dashboard

Board members and the Top 8 get a fifth tab, reporting chapter-wide engagement:
membership and event totals, cumulative check-ins and points, participation
rate, and attendance per event with a drill-down to who came.

**Recent activity** is the audit trail: every create, edit, and delete of an
event or announcement, plus every level change, recorded with who did it and —
for an edit — exactly which fields they touched. The actor's email and the
thing's name are snapshotted into each row, so an entry still reads after either
is deleted. A failed audit write never fails the operation it describes.

It reports **no demographics**. Age, sex at birth, and gender are collected at
signup and deliberately not selected by any admin endpoint — see
[PERMISSIONS.md](docs/PERMISSIONS.md).

### Announcements

An announcement with no `published_at` is a draft: hidden from members, visible
to officers with a Draft chip. A `published_at` in the future is a scheduled
post and stays hidden until it passes.

---

## Checks

```bash
npm run typecheck && npm test
```

```bash
cd frontend && npm test && npx tsc --noEmit && npx expo lint
```

The backend has 82 tests covering the logic where correctness actually bites:
timezone handling for all-day events, the calendar merge rule, the check-in
window boundaries, UIC email matching, and token verification.

The frontend has 47, under `jest-expo`: the date conversion behind the event
form, relative-time and accent derivation, the API client's token handling and
error mapping, and render tests for the login screen, the `ComingSoon` gating,
and the camera lifecycle below.

Frontend test files live in `__tests__/`, `lib/`, and `components/` — **never
under `app/`**, where Expo Router would treat them as routes and pull the test
library into the shipped bundle.

---

## Deploying a change

Vercel and Render both build `main` on the deployment repository, so a change
has to reach two remotes:

```bash
git push origin free-deploy && git push personal free-deploy:main
```

Both services deploy automatically. The Render build runs the migrations, so a
change whose schema cannot be applied fails the deploy rather than starting
against the wrong tables.

**The two do not land together.** Vercel builds in about 45 seconds, Render in
75 or more, so for roughly a minute the app is newer than the API. On a release
that adds an endpoint, a new screen can call something that is not there yet —
the app says *"the server is still catching up"* and it resolves itself. On a
release people are waiting for, let Render go green before pointing them at it.

[DEPLOYMENT.md](docs/DEPLOYMENT.md) explains why there are two remotes, covers
the setup that is still outstanding, and has a troubleshooting table.

---

## What is not built yet

Stated plainly, so nothing here is mistaken for broken:

- **The first Top 8 is a SQL step.** Everything after it is done in the app.
- **RSVP, notifications, privacy settings, Google sign-in.** Laid out in the
  design but never built. Each is visibly disabled and badged *Coming soon* in
  the app rather than left looking broken — grep `ComingSoon` for the list.
- **Password reset and account deletion.**

Two deployment steps are also still outstanding — an uptime pinger, and turning
on the calendar sync. Both are in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Further reading

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — hosting, outstanding setup,
  free-tier limits, troubleshooting
- **[docs/PERMISSIONS.md](docs/PERMISSIONS.md)** — the full endpoint matrix and
  where each rule is enforced
- **[docs/superpowers/specs/](docs/superpowers/specs/)** — design notes,
  including why this stack replaced an earlier Firebase plan
