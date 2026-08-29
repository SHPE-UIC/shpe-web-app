# SHPE @ UIC — member app

Events, check-ins, and announcements for the UIC chapter of the Society of
Hispanic Professional Engineers.

Members sign in with their UIC email, browse upcoming events, and check in by
scanning a QR code an officer displays. Officers create events and post
announcements from inside the app.

| | |
|---|---|
| **App** | `https://<project>.web.app` (Firebase Hosting) |
| **API** | `https://shpe-api-<hash>-uc.a.run.app` (Cloud Run) |

Everything runs in one Google Cloud project, provisioned entirely by the
Terraform in [`infra/`](infra/). The only meaningful cost is the database
(~$10–13/mo); everything else scales to zero.

> **Migrating?** The legacy Vercel/Render/Neon deployment stays live until the
> cutover runbook in [migration.md](migration.md) is executed.

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
Google Calendar ──► Cloud Scheduler ─┐
  (board)                            ├──► Cloud Run ────► Cloud SQL
Admin screens ───────────────────────┘    Express + Drizzle   Postgres 17
  (in-app)                                  ▲    ▲
                                   ID token │    │ Admin SDK
                                            │    ▼
Firebase Hosting ◄────── members ──► Firebase Authentication
  Expo web export
```

| Piece | Runs on | Why there |
|---|---|---|
| Database | **Cloud SQL for PostgreSQL** | Reached only through the managed socket — public IP, zero authorized networks, IAM-gated. |
| API | **Cloud Run** | The Docker image at the repo root; scales to zero, wakes in seconds. |
| App | **Firebase Hosting** | Static Expo web export served from a CDN, SPA rewrite in `firebase.json`. |
| Identity | **Firebase Authentication** | Owns passwords and sessions; the member rows and roles stay in Postgres. |
| Everything | **Terraform** ([`infra/`](infra/)) | The whole project is code; CI deploys keylessly via Workload Identity Federation. |

The app is Expo, so the same code also builds for iOS and Android. Only the web
build is deployed today.

**Tech:** Expo SDK 54 · Expo Router · React Native 0.81 · React 19 · TypeScript
(strict) · Express 5 · Drizzle ORM · PostgreSQL 17 · Firebase Auth · Vitest ·
Terraform

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
  auth/               Firebase Admin wrapper, QR-token signing, the public user shape
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
  lib/                data fetching, API client, Firebase auth, roles, formatting
  contexts/           AuthContext
  constants/theme.ts  the single source of colours, radii, and shadows
  __tests__/          screen tests — never under app/, see Checks below
  jest.config.js      jest-expo setup and native-module mocks
  jest.setup.ts

drizzle/              generated SQL migrations (committed)
infra/                Terraform for the whole GCP project (see infra/README.md)
scripts/              one-shot operational scripts (Firebase user import)
Dockerfile            the Cloud Run image: production deps + tsx, no build step
firebase.json         Firebase Hosting config and the SPA rewrite
.github/workflows/    CI on every push; build → migrate → deploy on main
docs/                 deployment and permissions
```

Screens never call `fetch` directly. Each resource has a module in
`frontend/lib/` exposing a hook — `useUpcomingEvents`, `useAnnouncements`,
`useMyCheckIns`, and the dashboard's `useAdminOverview`, `useMembers`,
`useRecentActivity` — and every request goes through `lib/api/client.ts`, which
attaches the Firebase ID token and turns error responses into typed `ApiError`s.

`roles.ts` exists twice on purpose, once each side. The server's copy decides
what is allowed; the app's decides what to render.

---

## Running it locally

You need **Node 22+**, a Postgres database, and the Firebase Auth emulator.
Docker gives you Postgres in a command.

### 1. Database

```bash
docker run -d --name shpe-pg -e POSTGRES_USER=shpe -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=shpe -p 55432:5432 postgres:17-alpine
```

### 2. Firebase Auth emulator

Sessions come from Firebase, so local development runs the Auth emulator —
no real Firebase project, tenant, or credentials involved:

```bash
npx firebase-tools emulators:start --only auth --project demo-shpe
```

### 3. API

```bash
cp example.env .env
```

Set these in `.env`:

- `DATABASE_URL` — `postgresql://shpe:devpass@localhost:55432/shpe` for the
  container above
- `CHECKIN_TOKEN_SECRET` — any long random string:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and `GCLOUD_PROJECT=demo-shpe`
  so the Admin SDK talks to the emulator

Then:

```bash
npm install && npm run db:migrate && npm start
```

The API listens on port 5000. `curl localhost:5000/healthz/db` should return
`{"ok":true,...}` — that confirms it is running *and* reached the database.

### 4. App

In a second terminal:

```bash
cd frontend && cp example.env .env && npm install && npx expo start -c
```

`frontend/.env` needs `EXPO_PUBLIC_API_URL=http://localhost:5000` and
`EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR=http://127.0.0.1:9099` (the placeholder
Firebase values from `example.env` are fine with the emulator). Press `w` for
web, or scan the QR code with Expo Go.

> The `EXPO_PUBLIC_` prefix is required — Expo ignores any other name, and the
> app then fails at its first API call with no explanation. Values are baked in
> at build time, so restart with `-c` after changing them.

### 5. Make yourself a Top 8

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

**Firebase Authentication owns credentials; Postgres owns membership.**
Registration is a backend endpoint: it enforces the `@uic.edu` rule, creates
the Firebase user through the Admin SDK, and inserts the member row under the
same id. Client-side Firebase signup is disabled at the platform level
(`infra/firebase.tf`), which is what makes that rule enforceable — there is no
way to get an account except through the endpoint that checks it.

Signing in happens between the app and Firebase directly. The SDK persists the
session and refreshes ID tokens by itself; every API request carries the
current ID token, which `requireAuth` verifies with the Admin SDK before
re-reading the member's row — so promoting or deleting an account takes effect
immediately rather than whenever a token expires. Roles never enter tokens.

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

The backend has 94 tests covering the logic where correctness actually bites:
timezone handling for all-day events, the calendar merge rule, the check-in
window boundaries, UIC email matching, QR-token verification, the Firebase
auth middleware, the registration flow's rollback, and the DSN → TLS mapping.

The frontend has 49, under `jest-expo`: the date conversion behind the event
form, relative-time and accent derivation, the API client's token handling and
error mapping, and render tests for the login screen, the `ComingSoon` gating,
and the camera lifecycle below.

Frontend test files live in `__tests__/`, `lib/`, and `components/` — **never
under `app/`**, where Expo Router would treat them as routes and pull the test
library into the shipped bundle.

---

## Deploying a change

Push to `main` and GitHub Actions does the rest, in order: build the Docker
image, push it to Artifact Registry, **run the migrations as a Cloud Run job**
(a schema that cannot apply fails the pipeline before any new code serves
traffic), deploy the API, then build and deploy the web app. The web deploy
waits for the API deliberately, so the app is never newer than the server it
calls.

The workflow authenticates through Workload Identity Federation — there are no
service-account keys anywhere, in CI or otherwise.

[DEPLOYMENT.md](docs/DEPLOYMENT.md) covers the architecture, first-time
project setup, and a troubleshooting table.

---

## What is not built yet

Stated plainly, so nothing here is mistaken for broken:

- **The first Top 8 is a SQL step.** Everything after it is done in the app.
- **RSVP, notifications, privacy settings, Google sign-in.** Laid out in the
  design but never built. Each is visibly disabled and badged *Coming soon* in
  the app rather than left looking broken — grep `ComingSoon` for the list.
  (Google sign-in has a real constraint now: platform-level signup is disabled
  to protect the `@uic.edu` rule, so federated sign-in needs pre-linked
  accounts or a blocking function first.)
- **Password reset and account deletion.** Firebase Auth makes password-reset
  email an achievable next step.
- **The production cutover.** The GCP stack is fully coded but the legacy
  hosting still serves members until [migration.md](migration.md) is executed.

---

## Further reading

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — hosting, outstanding setup,
  free-tier limits, troubleshooting
- **[docs/PERMISSIONS.md](docs/PERMISSIONS.md)** — the full endpoint matrix and
  where each rule is enforced
- **[docs/superpowers/specs/](docs/superpowers/specs/)** — design notes,
  including why this stack replaced an earlier Firebase plan
