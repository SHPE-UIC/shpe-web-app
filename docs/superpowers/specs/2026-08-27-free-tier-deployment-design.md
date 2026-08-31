# Free-Tier Deployment Refactor: Vercel + Render + Neon

> **SUPERSEDED — 2026-08-30.** The stack this document designs was
> decommissioned: Vercel, Render, and Neon are gone, replaced by Cloud Run,
> Cloud SQL, and Firebase Hosting in a single GCP project. See
> [`migration.md`](../../../migration.md) for that move and
> [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) for the current shape.
>
> **Read nothing here as current design.** In particular this document
> describes self-hosted JWT sessions, bcrypt password hashes, a
> `tokenStore` backed by `expo-secure-store`, and `age`/`sex_at_birth`
> columns. Every one of those has since been removed — sessions are Firebase
> ID tokens, credentials live in Firebase Authentication, and the only
> demographic collected is gender.
>
> Kept for the record: the reasoning that moved this project off Firestore to
> Postgres, and the per-field calendar override rule, both of which carried
> forward intact.

**Branch to create:** `free-deploy` (from `stu`)
**Supersedes:** `docs/superpowers/specs/2026-08-17-firebase-integration-design.md` and its plan

---

## Context

The app on `main` is a finished UI shell with no data behind it. Login accepts a
hardcoded `test` / `password`. Events, announcements, and profile statistics are
literal arrays in the component files. The QR scanner shows an alert and records
nothing. `backend/server.js` is eighteen lines that respond `"Testing"` — and it
cannot start at all, because the root package declares `"type": "commonjs"` while
the file uses ESM `import`.

Two feature branches hold finished work that never merged, both built on Firebase:

- **`origin/Event-DB`** — Google Calendar → Firestore sync; the app reads events
  live via `onSnapshot`. Forks from `main`'s HEAD, so it merges clean.
- **`origin/auth`** — Firebase Authentication, `AuthContext`, a six-field
  registration form, UIC-email gating. Forks from *before* the design system
  existed, so its screens use a crimson/dark palette and none of `AuthLayout`,
  `PageHeader`, or `constants/theme`.

A previous spec planned to merge both onto Firebase. **This plan replaces that
direction.** The goal now is a deployment the club can run for free and keep
running after its current officers graduate: **Vercel** for the Expo web build,
**Render** for the Express API, **Neon Postgres** (provisioned through the Vercel
Marketplace) for data.

That choice removes Firebase entirely. Firestore becomes Postgres tables, and
Firebase Auth becomes JWT auth on the Render API — which is what the root
`package.json` was already provisioned for: `bcryptjs` and `jsonwebtoken` have
been declared, and unused, since the beginning.

### One correction worth stating plainly

There is no first-party "Vercel Postgres" to buy anymore. A database on Vercel
today is a Marketplace integration — `vercel install neon --plan free`. Billing
and environment variables still flow through the Vercel project, so it is a
Vercel database in every way that matters operationally, but the engine is Neon.
Nothing else in this plan depends on that distinction.

---

## Decisions

| Decision | Choice |
|---|---|
| Database | Neon Postgres, free plan, via Vercel Marketplace |
| Auth | Own JWT auth on the Render API (`bcryptjs` + `jsonwebtoken`) |
| DB access | Drizzle ORM + `drizzle-kit` migrations |
| Event authoring | **Both** Google Calendar sync **and** in-app admin CRUD |
| Firebase | Removed completely — no Firestore, no Firebase Auth, no `firebase-admin` |
| Realtime | Dropped. Fetch on focus + pull-to-refresh replaces `onSnapshot` |
| Feature order after deploy | Check-in recording → Announcements → Organizer QR |

### Consequence: the backend becomes TypeScript

Drizzle's entire value is schema-as-code producing inferred row types. That is
worthless from plain JavaScript. The backend is seven small files, so this is a
cheap conversion, and it is a precondition for the ORM choice rather than a
separate ambition. Render runs it with `tsx` — no build step, no `dist/` to keep
in sync.

### Consequence: `mongoose` goes, `bcryptjs` and `jsonwebtoken` stay

The superseded spec called for deleting all three as dead weight. Two of them are
now load-bearing. Only `mongoose` is removed.

---

## What gets salvaged, and how much

This is the part that makes the refactor cheap. **`origin/Event-DB`'s event
screens are already decoupled from Firestore.** `events.tsx` imports nothing but
`useUpcomingEvents`, `accentForTag`, `formatMonth`, `formatDay`, and
`formatTimeRange` — all from `lib/events.ts`. The Firestore calls live entirely
inside that one module.

So the screens port **verbatim**, and only `lib/events.ts`'s internals change.

| Source | File | Action |
|---|---|---|
| `Event-DB` | `frontend/app/(tabs)/events.tsx` | **Verbatim** — filters, loading, error, empty states all reusable |
| `Event-DB` | `frontend/app/(tabs)/events-info/[id].tsx` | **Verbatim** |
| `Event-DB` | `lib/events.ts` format helpers | **Verbatim** — `accentForTag`, `formatMonth`, `formatDay`, `formatDateLong`, `formatTimeRange` |
| `Event-DB` | `lib/events.ts` data layer | **Rewrite** — `onSnapshot` → REST + focus refetch |
| `Event-DB` | `backend/config/eventTags.js` | **Verbatim** (retyped) — colorId → tag → points |
| `Event-DB` | `backend/googleCalendar.js` | **Verbatim** (retyped) — no Firebase in it; pagination + syncToken + 410 handling |
| `Event-DB` | `backend/serviceAccount.js` | **Verbatim** (retyped) — still needed, now for Calendar API only |
| `Event-DB` | `backend/eventMapping.js` | **Trim** — drop the display-string fields, keep `readDateTime` and its all-day handling |
| `Event-DB` | `backend/calendarSync.js` | **Rewrite** — Firestore docs → SQL upserts + the dual-path merge rule |
| `Event-DB` | `backend/firebase.js` | **Delete** |
| `auth` | `frontend/utils/validation.ts` | **Verbatim** — `isUicEmail` |
| `auth` | `frontend/types/user.ts` | **Port** — drop the `firebase/firestore` Timestamp import |
| `auth` | `frontend/components/SegmentedControl.tsx` | **Port + restyle** — hardcoded to the old dark palette |
| `auth` | `frontend/app/register.tsx` | **Reference** for the signup wizard's field set; rewrite against `AuthLayout` |
| `auth` | `frontend/contexts/AuthContext.tsx` | **Reference** for shape; rewrite against the REST API |
| `auth` | `firestore.rules` | **Delete** — its authorization model moves into Express middleware |

Never merge `origin/auth` with git. It predates the design system and would
produce delete-vs-modify conflicts across every file the design introduced, then
resolve in `main`'s favor on nearly all of them. Copy from it instead. Credit
`adb3a9f3` and `7841a657` in the commit body and leave the branch in place as the
record.

### A simplification worth taking

The Firestore schema stored dates as **display strings** (`"01/15/2026"`,
`"6:00 PM"`), which forced `lib/events.ts` to carry a `parseEventDate` regex to
reconstruct `Date` objects, and forced `useUpcomingEvents` to download every
event document and filter client-side.

Postgres has `timestamptz`. Store real instants, and:

- `parseEventDate` is **deleted outright**
- filtering and sorting move into SQL — `WHERE ends_at >= now() ORDER BY starts_at`
- the client stops downloading past events entirely

---

## Architecture

```
Google Calendar ─┐
  (officers)     ├──► Render (Express + Drizzle) ──► Neon Postgres
Admin screens ───┘         │                            (free plan)
  (in-app)                 │
                           ▼
                    Vercel (Expo web static export)
                      EXPO_PUBLIC_API_URL ──► Render
```

### Backend layout

```
backend/
  src/
    index.ts                 express app + listen + sync loop
    app.ts                   middleware, route mounting, error handler
    db/index.ts              drizzle client over a node-postgres Pool
    db/schema.ts             all tables — the single source of row types
    middleware/auth.ts       requireAuth / requireAdmin
    routes/auth.ts
    routes/events.ts
    routes/checkIns.ts
    routes/announcements.ts
    calendar/eventTags.ts    ← Event-DB, verbatim
    calendar/googleCalendar.ts ← Event-DB, verbatim
    calendar/serviceAccount.ts ← Event-DB, verbatim
    calendar/eventMapping.ts ← Event-DB, trimmed
    calendar/sync.ts         ← Event-DB, rewritten for SQL
  syncOnce.ts                one-shot job entry point
drizzle.config.ts
drizzle/                     generated migrations, committed
```

### Frontend layout (additions)

```
frontend/lib/
  api/client.ts       fetch wrapper: base URL, JWT header, error unwrapping
  api/types.ts        DTOs mirroring API responses
  tokenStore.ts       SecureStore on native, localStorage on web
  events.ts           useUpcomingEvents / useEvent + Event-DB's format helpers
  announcements.ts
  checkIns.ts
frontend/contexts/AuthContext.tsx
frontend/vercel.json
```

**On sharing types:** Vercel builds with root directory `frontend`, so it installs
only `frontend/package.json` and cannot import from `backend/`. Sharing Drizzle's
inferred types across that boundary needs npm workspaces, which complicates both
deploy configs for a codebase students hand off yearly. Instead, `api/types.ts`
is hand-written to match the API contract, and the contract tests in Phase 3
catch drift. This is a deliberate trade of compile-time coupling for deploy
simplicity — worth revisiting if the API grows past ~15 endpoints.

---

## Database schema

`backend/src/db/schema.ts`, migrations generated by `drizzle-kit generate`.

```
users
  id             uuid pk default gen_random_uuid()
  email          text not null            -- unique index on lower(email)
  password_hash  text not null
  name           text not null
  age            integer
  sex_at_birth   text                     -- 'Male' | 'Female'
  gender         text
  school_level   text                     -- Freshman | Sophomore | Junior | Senior | Graduate
  member_id      text
  is_admin       boolean not null default false
  created_at     timestamptz not null default now()

events
  id                        uuid pk default gen_random_uuid()
  google_calendar_event_id  text unique              -- null for manually created events
  source                    text not null            -- 'google_calendar' | 'manual'
  name                      text not null
  description               text not null default ''
  location                  text not null default ''
  tag                       text not null default 'Event'
  points                    integer not null default 0
  starts_at                 timestamptz not null
  ends_at                   timestamptz not null
  all_day                   boolean not null default false
  overridden_fields         text[] not null default '{}'
  created_by                text
  created_at                timestamptz not null default now()
  updated_at                timestamptz not null default now()
  -- index on (ends_at, starts_at) for the upcoming-events query

check_ins
  id          uuid pk default gen_random_uuid()
  user_id     uuid not null references users(id) on delete cascade
  event_id    uuid not null references events(id) on delete cascade
  points      integer not null                -- snapshot of events.points at scan time
  created_at  timestamptz not null default now()
  unique (user_id, event_id)

announcements
  id            uuid pk default gen_random_uuid()
  title         text not null
  body          text not null
  accent        text
  author_id     uuid references users(id)
  published_at  timestamptz
  created_at    timestamptz not null default now()

sync_state
  key              text pk                   -- 'googleCalendar'
  next_sync_token  text
  last_synced_at   timestamptz
  last_result      jsonb
```

`check_ins.points` is a **snapshot, not a join.** If an officer later recolors an
event and its point value changes, already-recorded attendance must not silently
revalue. This is what makes the profile statistics defensible later.

---

## The dual-path conflict rule

Choosing both authoring paths creates the one genuinely new design problem in
this refactor: what happens when the calendar sync runs over an event an admin
edited in the app.

The rule, implemented as a pure `mergeCalendarEvent()` function so it can be
unit-tested without a database:

1. **`source = 'manual'` events are never touched by the sync.** The sync matches
   only on `google_calendar_event_id`, which manual events do not have.
2. **For `source = 'google_calendar'` events**, the sync overwrites every
   calendar-owned field (`name`, `description`, `location`, `starts_at`,
   `ends_at`, `all_day`, `tag`) **except** those listed in `overridden_fields`.
3. **`PATCH /api/events/:id` appends each edited field name to
   `overridden_fields`.** An admin correcting a typo'd location in the app keeps
   that correction through the next sync; everything else still tracks Calendar.
4. **`points` follows `tag`, but only when `tag` actually changes** — preserving
   `Event-DB`'s original intent, that recoloring an event revalues it while an
   unrelated calendar edit does not.
5. **Cancellation deletes only `source = 'google_calendar'` rows.**

`overridden_fields` is deliberately per-field rather than a single "manually
edited" boolean. A whole-row lock would mean one typo fix freezes the event's
time against all future calendar changes — the failure mode most likely to make
someone show up at the wrong hour.

---

## API surface

```
GET    /healthz                        uptime pinger target

POST   /api/auth/register              UIC email gate, bcrypt, returns JWT
POST   /api/auth/login
GET    /api/auth/me                    rehydrate session on app boot

GET    /api/events?upcoming=1          ends_at >= now(), sorted
GET    /api/events/:id
POST   /api/events                     admin — source='manual'
PATCH  /api/events/:id                 admin — records overridden_fields
DELETE /api/events/:id                 admin

GET    /api/events/:id/checkin-token   admin — short-lived signed QR payload
POST   /api/check-ins                  { token } — verify, then record
GET    /api/check-ins/me

GET    /api/announcements
POST   /api/announcements              admin
PATCH  /api/announcements/:id          admin
DELETE /api/announcements/:id          admin

POST   /api/sync/calendar              x-sync-secret header
```

### Session handling

A single JWT with a 7-day expiry, stored through `lib/tokenStore.ts` —
`expo-secure-store` on native, `localStorage` on web, because SecureStore has no
web implementation and the primary deployment target *is* web. `GET /api/auth/me`
rehydrates on boot.

Access/refresh token rotation is the more correct design and the upgrade path is
open, but it is deliberately not built here: it roughly doubles the auth surface
for a members-only club app, and this codebase changes hands every year.

### Organizer QR must not encode a raw event id

The obvious design — QR contains the event id, scanner posts it — means anyone
who screenshots the projected code can check in from home, permanently. Instead:

- `GET /api/events/:id/checkin-token` returns a JWT scoped to that event with a
  **60-second expiry**
- the organizer screen re-fetches and re-renders every 60 seconds
- `POST /api/check-ins` verifies signature and expiry, confirms the event is
  currently running, and rejects duplicates via the `unique (user_id, event_id)`
  constraint

---

## Free-tier constraints to design around

These are real limits, not caveats to discover in production:

- **Render free web services sleep after ~15 minutes idle**, and a cold start
  takes up to about a minute. Landing on the login screen and waiting 50 seconds
  is the single worst experience this stack can produce.
  **Mitigation:** an external uptime pinger (UptimeRobot or cron-job.org, both
  free) hitting `/healthz` every 10 minutes. `Event-DB`'s `server.js` already has
  the `/healthz` endpoint, added for exactly this.
- **Render free tier allows 750 instance-hours/month.** A month is ~730 hours, so
  keeping *one* service always awake fits — with no room for a second.
- **Do not use GitHub Actions for the keep-alive ping.** On a private repo a
  10-minute ping is ~4,300 billed minutes against a 2,000-minute allowance. The
  30-minute calendar sync workflow costs ~1,440 and does fit, which is what
  `Event-DB`'s workflow comment already worked out.
- **Better: run the calendar sync in-process on Render.**
  `startCalendarSyncLoop()` already exists, and once the pinger keeps the service
  awake, the loop runs reliably. The `/api/sync/calendar` endpoint and the
  GitHub workflow stay as a manual/fallback trigger.
- **Neon free plan** is 0.5 GB with scale-to-zero. Ample here; expect a sub-second
  delay on the first query after idle.
- **Render's own free Postgres expires after 30 days.** This is the reason the
  database lives on Neon and not on Render.

---

## Deployment configuration

**Vercel** — root directory `frontend`, build `npx expo export --platform web`,
output directory `dist`.

`frontend/app.json` changes `web.output` from `"static"` to `"single"`. Static
output emits one HTML file per known route, which breaks the dynamic
`events-info/[id]` route on refresh and deep links. Single-page output plus a
`vercel.json` rewrite of `/(.*)` → `/index.html` handles dynamic routes cleanly.
The SEO cost of SPA mode is irrelevant for a members-only app behind a login.

**Render** — root directory is the repo root, build `npm install`, start
`npx tsx backend/src/index.ts`.

### Environment variables

| Where | Variable |
|---|---|
| Render | `DATABASE_URL` (from Neon), `JWT_SECRET`, `CORS_ORIGINS`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `CALENDAR_SYNC_INTERVAL_MINUTES`, `SYNC_SECRET`, `CHECKIN_TOKEN_TTL_SECONDS` |
| Vercel | `EXPO_PUBLIC_API_URL` |

`example.env` and `frontend/example.env` are rewritten to match. The
`EXPO_PUBLIC_` prefix is load-bearing — Expo silently ignores any other name, and
every `.env` change needs `npx expo start -c` because values are inlined at build
time.

CORS on the API reads `CORS_ORIGINS` as a comma-separated allowlist, so Vercel
preview deployments can be added without a code change.

---

## Phases

Each phase is independently verifiable. **Phase 2 deploys deliberately early** —
proving the three-provider pipeline against a health check is far cheaper than
discovering a CORS or cold-start problem after six phases of feature work.

| # | Phase | Verified by |
|---|---|---|
| 0 | Branch `free-deploy`; backend → TypeScript; drop `mongoose`; fix the ESM/CommonJS mismatch; supersede the Firebase docs | `npx tsc --noEmit` passes in both roots |
| 1 | Provision Neon; `db/schema.ts`; generate and apply migrations | Tables exist; `drizzle-kit` reports no pending changes |
| 2 | Express skeleton — CORS, error handler, `/healthz`. **Deploy all three providers.** | Vercel-hosted app loads; its `/healthz` fetch succeeds against Render |
| 3 | Auth API + `tokenStore` + `AuthContext` + login/signup wizard + `AuthGate` | Register a real `@uic.edu` account; force-quit; session survives |
| 4 | Events API + calendar sync port + merge rule + admin CRUD + port `Event-DB`'s two screens | Calendar edit appears in-app after a sync; an admin field edit survives the next sync |
| 5 | Check-in recording — QR token issue/verify, duplicate rejection, event-window check | Scan records a row; second scan is rejected; expired token is rejected |
| 6 | Announcements — table, admin authoring, home feed, See all screen | `home.tsx`'s hardcoded array is gone |
| 7 | Organizer QR generation — officer screen, 60-second rotation | Displayed code scans successfully; the same code fails 90 seconds later |

Phase 3 precedes all feature work because `requireAuth` gates every endpoint
added in phases 4 through 7.

### Explicitly out of scope

**Real profile statistics.** Not selected, and it stays hardcoded at `12` / `240`
with an explicit `TODO`. Phase 5 lays the entire foundation for it — `check_ins`
rows carry a point snapshot — so it becomes a small query when it is wanted. It
must not be reported as working in the meantime.

Also out: Google SSO (the button stays visible and disabled, labeled coming
soon), password reset, and push notifications.

---

## Testing

The repository has no test infrastructure on any branch. Building out React
Native component testing is its own project and is not attempted. Tests target
the pure logic, where the real correctness risk lives.

**Backend — Vitest** (TypeScript with no config, unlike Jest):

- `eventTags` — colorId → tag → points, including the no-color default
- `eventMapping` — Google event → row shape; all-day events must not shift a day
  across the timezone boundary
- `mergeCalendarEvent` — the dual-path rule: overridden fields survive,
  non-overridden fields update, `points` follows `tag` only on change, manual
  events are untouched
- check-in token — valid, expired, wrong-event, and tampered-signature cases

**Frontend — `jest-expo`:**

- `isUicEmail` — accepts `a@uic.edu`; rejects `a@uic.edu.evil.com` and
  `a@fake-uic.edu`; handles whitespace and case
- `api/client` — attaches the JWT, unwraps error envelopes

Screens and database integration are covered by the manual acceptance checks
below. Stating this plainly so the coverage is not overread.

---

## Verification

**Static**

```bash
npx tsc --noEmit && npx vitest run
```

```bash
cd frontend && npx tsc --noEmit && npx expo lint && npx jest
```

**Database**

```bash
npx drizzle-kit generate && npx drizzle-kit migrate
```

**Local end-to-end** — Render API locally against Neon, Expo web against it:

```bash
npx tsx backend/src/index.ts
```

```bash
cd frontend && npx expo start -c --web
```

**Manual acceptance**

- Registering a `@uic.edu` account through both wizard steps creates a `users`
  row with all six profile fields and `is_admin = false`
- A non-UIC email is rejected at step 1; a duplicate email returns to step 1 with
  entered state intact
- A signed-out deep link to `/(tabs)/home` redirects to login; force-quit and
  reopen preserves the session
- Editing an event in Google Calendar and triggering a sync updates the app
- Editing that event's location in the admin screen, then syncing again, keeps
  the admin's location and updates everything else
- A scan records a check-in; scanning again is rejected; a 90-second-old QR is
  rejected
- Profile still shows `12` / `240` — **expected**, and not to be reported as
  working

**Deployed**

- The Vercel URL loads and reaches the Render API with no CORS error
- A hard refresh on `/events-info/<id>` resolves rather than 404ing (confirms the
  SPA rewrite)
- After 20 minutes idle, the first request is slow but succeeds; with the pinger
  configured, it is not slow
