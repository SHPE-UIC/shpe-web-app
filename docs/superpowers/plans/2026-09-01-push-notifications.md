# Push Notifications (FCM Web Push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members opt in to browser push and receive event reminders (the evening before, the morning of, toggled separately) and a notification when an officer publishes an announcement marked *Notify members*.

**Architecture:** Firebase Cloud Messaging web push. The browser holds a registration token; the API stores it against the member and sends through the Admin SDK on the runtime service account — no keys, same ADC pattern as Firebase Auth. Sends are driven by Cloud Scheduler hitting a secret-gated endpoint, copying the shape of the existing calendar sync rather than inventing a second mechanism. A `notifications_sent` ledger with a unique index makes every sweep idempotent, which is what lets Scheduler retry freely and what stops a member being pinged twice about one event.

**Tech Stack:** `firebase-admin/messaging` (already a dependency), `firebase/messaging` (new frontend dep, part of the installed `firebase` package), a static service worker in `frontend/public/`, Drizzle migration `0009`, Terraform (`google_cloud_scheduler_job`, Secret Manager, one IAM role, one API enablement).

**Spec:** Decisions confirmed by the maintainer 2026-09-01:
1. **Web push only**, accepting that mobile Safari delivers nothing unless the member installs the app to their home screen. The app tells them so rather than failing silently.
2. **Two event toggles**, independent: *the day before* and *the day of*.
3. **Announcements notify only when the officer ticks a box.** Default off. A scheduled announcement notifies when it publishes, not when it is written.

## Global Constraints

- Production is live. Migrations run through the `shpe-migrate` Cloud Run job on deploy; a migration that cannot apply stops the pipeline before new code serves traffic.
- **Nothing may send twice.** Cloud Scheduler is at-least-once and retries. Every send is guarded by a unique index, not by hoping the job runs once.
- **Nothing may send to a member who did not ask for it.** No token, no send — and the preference is checked at send time, not at subscribe time.
- Terraform is applied by hand, never by CI. A `.tf` change is inert until someone runs `terraform apply`.
- Cloud Run env vars belong to Terraform. Never `gcloud run services update`.
- Existing suites stay green: `npm run typecheck && npm test` (root), `cd frontend && npx tsc --noEmit && npm test`.
- Frontend test files never live under `frontend/app/` — Expo Router would treat them as routes.
- All reminder windows are computed in **America/Chicago**, the chapter's timezone and the one the calendar sync already uses. A UTC day boundary would send the evening-before reminder at the wrong time for half the year.

---

### Task 1: Schema — subscriptions, preferences, and the send ledger

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `drizzle/0009_push_notifications.sql` (via `npm run db:generate`, then read it before committing)

**Interfaces:**

```ts
export const NOTIFICATION_KINDS = ['event_day_before', 'event_day_of', 'announcement'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

// users gains three columns:
//   notifyEventDayBefore boolean not null default true
//   notifyEventDayOf     boolean not null default true
//   notifyAnnouncements  boolean not null default true
//
// announcements gains two:
//   notify     boolean not null default false   -- the officer's checkbox
//   notifiedAt timestamptz                      -- set when the sweep has handled it
```

Preferences default to **true** because they cost nothing until a member grants browser permission and a token exists. Defaulting them off would mean every member has to flip two switches after already agreeing to a permission prompt — two ways to say yes to one decision.

`push_subscriptions`: `id`, `userId` (cascade), `token` (unique), `userAgent`, `createdAt`, `lastSeenAt`. Unique on `token` alone, not `(userId, token)` — a token identifies one browser profile, and if a second member signs in there the row must move, not duplicate.

`notifications_sent`: `id`, `userId` (cascade), `kind`, `subjectId` (event or announcement id), `createdAt`, with **`uniqueIndex('notifications_sent_once_idx').on(userId, kind, subjectId)`**. That index is the whole idempotency story; nothing else in this plan protects against a double send.

- [ ] **Step 1: Write the failing test** — `backend/src/db/schema.test.ts` (new): assert `NOTIFICATION_KINDS` is exported and that the inferred `NewPushSubscription` requires `userId` and `token`. Type-level, but it fails to compile until the table exists.
- [ ] **Step 2: Run to verify failure** — `npx vitest run backend/src/db/schema.test.ts`.
- [ ] **Step 3: Implement** the tables and columns in `schema.ts`, with the reasoning above kept as comments on the unique indexes.
- [ ] **Step 4: Generate the migration** — `npm run db:generate`, then **read the SQL**. Drizzle will emit the `users` columns as `NOT NULL DEFAULT true`, which backfills existing rows correctly; confirm it did, and that it did not try to recreate an existing index.
- [ ] **Step 5: Apply locally** — `npm run db:migrate` against the docker Postgres, then `npm test`.

---

### Task 2: Backend — the messaging adapter and token hygiene

**Files:**
- Create: `backend/src/push/messaging.ts`, `backend/src/push/messaging.test.ts`

**Interfaces:**

```ts
export type PushMessage = { title: string; body: string; url?: string };
export type SendResult = { sent: number; failed: number; staleTokens: string[] };
export function sendToTokens(tokens: string[], message: PushMessage): Promise<SendResult>;
```

The important behaviour is not sending — it is **pruning**. FCM answers per token, and `messaging/registration-token-not-registered` means that browser is gone for good. If those rows are never deleted the table grows forever and every future send wastes a slot on a dead device. `sendToTokens` returns the stale tokens; the caller deletes them in one statement.

Batch through `sendEachForMulticast`, 500 tokens per call (the API's limit). Initialise lazily on ADC exactly like `auth/firebase.ts` — no key file, no new env var.

- [ ] **Step 1: Write the failing tests** — mock `firebase-admin/messaging`; assert a mixed response (2 ok, 1 `not-registered`, 1 other error) yields `{ sent: 2, failed: 2, staleTokens: [thatOne] }`, and that a 700-token list makes two calls.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** — `npx vitest run backend/src/push/messaging.test.ts`.

---

### Task 3: Backend — when a reminder is due

**Files:**
- Create: `backend/src/push/window.ts`, `backend/src/push/window.test.ts`

**Interfaces:**

```ts
/** The America/Chicago calendar day containing `instant`, as a UTC half-open range. */
export function chicagoDayRange(instant: Date): { start: Date; end: Date };
export function reminderRange(kind: 'event_day_before' | 'event_day_of', now: Date):
  { start: Date; end: Date };
```

Pure functions, no database — the same split `checkin/window.ts` already uses, and the reason that module is trustworthy. `event_day_of` is "events starting during today in Chicago"; `event_day_before` is "events starting during tomorrow in Chicago".

- [ ] **Step 1: Write the failing tests** — cover both DST transitions (2026-03-08 and 2026-11-01), an event at 23:30 Chicago being *tomorrow* and not today, and midnight UTC not being a day boundary in Chicago.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** Prefer `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'` over hand-rolled offsets; check whether `calendar/eventMapping.ts` already has a helper worth reusing before writing a second one.
- [ ] **Step 4: Verify.**

---

### Task 4: Backend — the dispatch sweep

**Files:**
- Create: `backend/src/push/dispatch.ts`, `backend/src/push/dispatch.test.ts`

**Interfaces:**

```ts
export function dispatchEventReminders(kind, now: Date): Promise<DispatchSummary>;
export function dispatchAnnouncements(now: Date): Promise<DispatchSummary>;
export type DispatchSummary = { considered: number; recipients: number; sent: number; skipped: number };
```

For each due event: select members whose relevant preference is true, who have at least one subscription, and who have **no** `notifications_sent` row for `(kind, eventId)`. Insert the ledger rows **before** sending, in the same transaction as the recipient selection, using `ON CONFLICT DO NOTHING` and taking only the rows that actually inserted as the send list. Inserting after the send would let a crash between the two re-send to everyone; inserting first means the worst case is a notification silently lost, which is the better failure.

Announcements: those with `notify = true`, `publishedAt <= now`, and `notifiedAt IS NULL`. Set `notifiedAt` as part of the same sweep so the query stays small forever rather than rescanning history.

- [ ] **Step 1: Write the failing tests** against a mocked `db` in the style of `routes/auth.test.ts`: a member with the preference off is skipped; a member with no token is skipped; a second run over the same event sends nothing; a stale token returned by `sendToTokens` is deleted.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**

---

### Task 5: Backend — routes

**Files:**
- Create: `backend/src/routes/notifications.ts`, `backend/src/routes/notifications.test.ts`
- Modify: `backend/src/app.ts` (mount `/api/notifications`), `backend/src/env.ts` (`NOTIFY_SECRET`), `example.env`

**Interfaces:**

| Endpoint | Guard | Purpose |
|---|---|---|
| `POST /api/notifications/subscriptions` | `requireAuth` | Register this browser's token. Upsert on token; reassign `userId` if it moved. |
| `DELETE /api/notifications/subscriptions` | `requireAuth` | Unregister, on sign-out or toggle-off. |
| `GET /api/notifications/preferences` | `requireAuth` | The three booleans. |
| `PUT /api/notifications/preferences` | `requireAuth` | Update them. |
| `POST /api/notifications/dispatch` | `x-notify-secret` | The sweep. Body `{ kind }`. |

**`NOTIFY_SECRET` is a new secret, not a reuse of `SYNC_SECRET`.** The existing secret's documented blast radius is "can trigger a calendar sync" — an idempotent read. Widening it to "can push a message to every member's phone" is a different risk, and the separation costs about fifteen lines of Terraform copied from the job next to it.

Follow `routes/sync.ts` for the header check, including its rule that an unset secret leaves the endpoint open locally.

- [ ] **Step 1: Write the failing tests** — each authenticated route refuses without a token; dispatch refuses a wrong or missing header; registering the same token twice yields one row; registering a token already owned by another member moves it.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** — `npx vitest run backend/src/routes/notifications.test.ts`.

---

### Task 6: Backend — the announcement checkbox

**Files:**
- Modify: `backend/src/routes/announcements.ts`, `backend/src/routes/announcements.test.ts` (new file if absent)

`POST` and `PATCH` accept `notify: boolean`, board-only like the rest of the write path. Setting `notify` on an already-published announcement whose `notifiedAt` is set must **not** re-notify — the ledger would stop the duplicate anyway, but the intent should be refused at the route with a clear code rather than relying on a unique index to absorb it.

- [ ] **Step 1: Write the failing tests** — `notify` defaults false; a member cannot set it; re-flagging an already-notified announcement is refused.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**

---

### Task 7: Terraform — API, IAM, secret, three scheduler jobs

**Files:**
- Modify: `infra/apis.tf`, `infra/iam.tf`, `infra/secrets.tf`, `infra/run.tf`, `infra/scheduler.tf`

- Enable `fcm.googleapis.com`.
- Grant the runtime service account the Firebase Messaging sender role. **Verify the exact role id against `gcloud iam roles list` before applying** — `roles/firebasemessaging.admin` is the expected one, and a wrong guess here fails at apply, not at plan.
- `random_password.notify_secret` → Secret Manager → Cloud Run env `NOTIFY_SECRET`, mirroring `sync_secret` exactly.
- Three jobs, all `America/Chicago`:

| Job | Schedule | Body |
|---|---|---|
| `shpe-notify-day-before` | `0 18 * * *` | `{"kind":"event_day_before"}` |
| `shpe-notify-day-of` | `0 8 * * *` | `{"kind":"event_day_of"}` |
| `shpe-notify-announcements` | `*/15 * * * *` | `{"kind":"announcement"}` |

Fixed local times rather than rolling windows: "the evening before" and "the morning of" are what the feature promises, and a member should not get a 3am reminder because a sweep drifted.

- [ ] **Step 1: Write the resources.**
- [ ] **Step 2:** `terraform plan` — confirm it adds exactly these and modifies only the Cloud Run env block.
- [ ] **Step 3:** Hand the `terraform apply` to the maintainer; it is never run by CI.
- [ ] **Step 4:** Confirm `terraform plan` is clean afterwards.

---

### Task 8: Manual — Web Push certificate

**Not scriptable.** Firebase console → Project settings → **Cloud Messaging** → Web configuration → **Generate key pair**. That public VAPID key is what `getToken` needs.

- [ ] **Step 1:** Generate the key pair.
- [ ] **Step 2:** Add `EXPO_PUBLIC_FIREBASE_VAPID_KEY` as a **repository variable** on `communicationsshpeuic/shpe-web-app` (it is public-by-design, like the other `EXPO_PUBLIC_FIREBASE_*` values).
- [ ] **Step 3:** Add it to `.github/workflows/deploy.yml` alongside the existing `EXPO_PUBLIC_*` exports — **the bundle inlines these at export time, so a missing variable produces a build that silently cannot subscribe.**
- [ ] **Step 4:** Document it in `frontend/example.env`.

---

### Task 9: Frontend — service worker and the push client

**Files:**
- Create: `frontend/public/firebase-messaging-sw.js`, `frontend/lib/push.ts`, `frontend/lib/push.test.ts`
- Modify: `frontend/lib/firebase.ts` (export the messaging instance lazily)

The service worker must be served from the **origin root** as `/firebase-messaging-sw.js`. Expo copies `frontend/public/` into `dist/` verbatim; the SPA rewrite in `firebase.json` only catches paths with no matching file, so a real file at that path wins. **Verify this in the exported `dist/` before deploying** — if the rewrite swallows it, push registration fails with an opaque error and nothing in the UI explains why.

The worker cannot read `EXPO_PUBLIC_*` (it is not part of the bundle), so its Firebase config is written literally in the file. Those four values are already public identifiers.

```ts
export function isPushSupported(): boolean;   // Notification + serviceWorker + PushManager present
export function isIosWithoutPwa(): boolean;   // iOS Safari, not in standalone display mode
export async function enablePush(): Promise<'enabled' | 'denied' | 'unsupported'>;
export async function disablePush(): Promise<void>;
```

`isIosWithoutPwa` exists to drive honest copy rather than to gate anything: on iOS outside an installed PWA the permission prompt cannot even be shown, and a member who taps a dead switch will conclude the app is broken.

- [ ] **Step 1: Write the failing tests** — `isPushSupported` false when `PushManager` is absent; `enablePush` returns `'unsupported'` without calling `getToken`; a denied permission returns `'denied'` and posts nothing to the API.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** — `cd frontend && npx jest lib/push.test.ts`.

---

### Task 10: Frontend — settings screen and the composer checkbox

**Files:**
- Create: `frontend/app/notification-settings.tsx`
- Modify: `frontend/app/(tabs)/profile.tsx` (the Notifications row stops being `ComingSoon` and navigates here), `frontend/app/_layout.tsx` (register the route), `frontend/app/admin/announcement.tsx` (Notify members checkbox), `frontend/lib/api/types.ts`

The screen: an **Enable on this device** control, then the three switches, disabled until a token exists. On iOS without the PWA, replace the control with a short instruction to use Share → Add to Home Screen and reopen from there — the one place this feature admits its limit, and the difference between a member thinking "not for my phone yet" and "this app is broken".

Sign-out must call `disablePush()`; otherwise the next person to use that browser inherits the subscription. Wire it into `AuthContext.logout` beside the `signOut` call.

- [ ] **Step 1: Write the failing tests** — the switches render disabled with no token; toggling calls `PUT /api/notifications/preferences`; the iOS-without-PWA branch renders the install hint instead of the enable button.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** — `cd frontend && npm test && npx tsc --noEmit`.

---

### Task 11: Docs sweep

- [ ] `docs/PERMISSIONS.md` — five endpoints into the matrix; `POST /api/notifications/dispatch` joins the calendar sync as a 🔑 secret-gated row with no role at all. Note that preferences and subscriptions are own-row only.
- [ ] `docs/ARCHITECTURE.md` — a *How a notification gets sent* section with a sequence diagram: Scheduler → API → Postgres (ledger insert) → FCM → browser, and the ledger-before-send ordering called out.
- [ ] `docs/DEPLOYMENT.md` — the VAPID key manual step and the three scheduler jobs.
- [ ] `README.md` — a **Notifications** subsection under *How the pieces work*, including the iOS caveat in plain words.
- [ ] `docs/TODO.md` — tick **Notifications** off *Deferred features*; leave RSVP and privacy settings.
- [ ] `example.env` and `frontend/example.env` — `NOTIFY_SECRET`, `EXPO_PUBLIC_FIREBASE_VAPID_KEY`.

---

## Verification (end-to-end, after deploy)

- [ ] **Subscribe.** Desktop Chrome, profile → Notifications → Enable. Permission prompt appears; a row lands in `push_subscriptions`.
- [ ] **Announcement.** Publish one with *Notify members* ticked. Within 15 minutes a notification arrives; `announcements.notifiedAt` is set; `notifications_sent` has one row per subscribed member.
- [ ] **No double send.** Fire `shpe-notify-announcements` manually twice more. Nothing further arrives, and no new ledger rows appear. *This is the test the whole ledger design exists for — do not skip it.*
- [ ] **Preference respected.** Turn off announcements, publish another. Nothing arrives, and no ledger row is written for that member.
- [ ] **Event reminder.** Create an event for tomorrow, fire `shpe-notify-day-before` manually, confirm one notification and correct copy.
- [ ] **Stale token pruning.** Unsubscribe in browser settings without using the app, fire a send, confirm the row is deleted rather than retried forever.
- [ ] **iOS honesty.** Open the site in mobile Safari: the install hint shows and no dead switch is offered. Add to Home Screen, reopen, confirm the enable flow works from there.
- [ ] **Sign-out hygiene.** Sign out, confirm the subscription row is gone.
