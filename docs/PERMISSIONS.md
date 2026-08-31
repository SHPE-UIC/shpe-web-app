# Permissions

Who can do what, and where that is enforced.

## Roles

Three levels and one unauthenticated state, stored as `users.role` — an integer,
not a roles table. It is **ordered**, so every check in the app is "this level or
above" rather than a set membership test.

| Level | `role` | Who | How you get it |
|---|:--:|---|---|
| **Signed out** | — | Anyone with the URL | — |
| **Member** | `0` | Any `@uic.edu` account | Registering. The default. |
| **Board Member** | `1` | Runs the chapter day to day | Promoted by a Top 8. |
| **Top 8** | `2` | Everything a board member can do, plus setting other people's level | Promoted by another Top 8. **The first one is made by SQL** — see [Changing someone's level](#changing-someones-level). |

The names live in [`backend/src/roles.ts`](../backend/src/roles.ts) and are
mirrored in [`frontend/lib/roles.ts`](../frontend/lib/roles.ts), because both
the server's decisions and the app's rendering depend on them.

A fourth caller exists that is not a user at all: the **calendar sync**, which
authenticates with the `SYNC_SECRET` header rather than a session. It has no
role and can only trigger a sync.

### Registration is the only self-service path

Anyone with a `@uic.edu` address can create a Member account. There is no
approval step and no invite. The UIC domain check is the whole gate, and it is
enforced on the server, not just in the form — see `parseRegistration` in
[`backend/src/validation.ts`](../backend/src/validation.ts).

## The matrix

`—` means the endpoint does not exist for that role; the request is refused.

| Endpoint | Signed out | Member | Board | Top 8 |
|---|:--:|:--:|:--:|:--:|
| `POST /api/auth/register` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/auth/me` | — | ✅ own | ✅ own | ✅ own |
| `GET /api/events` | — | ✅ | ✅ | ✅ |
| `GET /api/events/:id` | — | ✅ | ✅ | ✅ |
| `POST /api/events` | — | — | ✅ | ✅ |
| `PATCH /api/events/:id` | — | — | ✅ | ✅ |
| `DELETE /api/events/:id` | — | — | ✅ | ✅ |
| `GET /api/events/:id/checkin-token` | — | — | ✅ | ✅ |
| `POST /api/check-ins` | — | ✅ self | ✅ self | ✅ self |
| `GET /api/check-ins/me` | — | ✅ own | ✅ own | ✅ own |
| `GET /api/announcements` | — | ✅ published | ✅ **all, incl. drafts** | ✅ **all, incl. drafts** |
| `POST /api/announcements` | — | — | ✅ | ✅ |
| `PATCH /api/announcements/:id` | — | — | ✅ | ✅ |
| `DELETE /api/announcements/:id` | — | — | ✅ | ✅ |
| `GET /api/admin/overview` | — | — | ✅ | ✅ |
| `GET /api/admin/events` | — | — | ✅ | ✅ |
| `GET /api/admin/events/:id/attendance` | — | — | ✅ | ✅ |
| `GET /api/admin/members` | — | — | ✅ | ✅ |
| `GET /api/admin/activity` | — | — | ✅ | ✅ |
| `PATCH /api/admin/members/:id/role` | — | — | — | ✅ |
| `POST /api/sync/calendar` | 🔑 secret | 🔑 secret | 🔑 secret | 🔑 secret |
| `GET /healthz`, `/healthz/db` | ✅ | ✅ | ✅ | ✅ | ✅ |

🔑 `POST /api/sync/calendar` ignores the session entirely. It is gated on the
`x-sync-secret` header matching `SYNC_SECRET`, so a signed-in officer without
the secret cannot trigger a sync, and a machine with the secret needs no
account. **If `SYNC_SECRET` is unset the endpoint is open** — that is deliberate
for local development and wrong in production, where Render generates one.

The health endpoints are public on purpose: the uptime pinger that keeps the
free-tier instance awake cannot authenticate.

## Rules that are not visible in the matrix

**Announcements have drafts.** An announcement with no `published_at` is hidden
from members and shown to officers with a Draft chip. A `published_at` in the
future is a scheduled post and stays hidden until it passes — that falls out of
the same `published_at <= now()` comparison rather than needing its own flag.

**Events have no draft state.** Every event is visible to every signed-in user
the moment it exists. An officer creating one is publishing it.

**Check-ins are first-person only.** `POST /api/check-ins` always records the
caller — the user id comes from the session, never from the request body, so
there is no way to check someone else in. `GET /api/check-ins/me` returns only
the caller's own rows.

**A check-in needs a live event and a fresh code.** Beyond being signed in, the
scan must carry a token an officer minted in the last 60 seconds, and the event
must be running (from 30 minutes before it starts until it ends). One check-in
per member per event, enforced by a unique index.

**Officers can see attendance, and a roster.** The dashboard (`/api/admin/*`)
reports chapter-wide engagement, per-event attendance including who checked in,
and a member roster.

**The roster carries no demographics.** `users` stores gender from signup, and
it is not selected by any admin endpoint. It is not engagement data, and putting
it on a screen every officer can open is a privacy cost with no analytical
return. The roster is limited to name, profile picture, email, school level,
member ID, role, join date, and attendance counts.

Age and sex at birth were collected until August 2026 and are now gone —
dropped from the schema, not merely hidden, at the Top 8's request.

Widening that is a deliberate decision, not a code change to make casually — if
the chapter has to report demographics to SHPE nationals, that belongs behind
its own view and its own entry here.

**Changes above member level are logged.** Every create, edit, and delete of an
event or announcement writes an `audit_log` row — who, what, which fields, and
when — as does every change to a member's level. An edit records only the fields
it actually changed, the same per-field precision the calendar override rule
needs. Board members and the Top 8 read it as Recent activity on the dashboard.

The actor's email and the entity's name are **snapshotted** into the row rather
than joined at read time, so an entry still makes sense after the officer or the
thing they changed is gone — which is exactly when a log is worth having.

Not logged, deliberately: member check-ins (already timestamped rows in
`check_ins`), the calendar sync (a machine, whose per-run stats land in
`sync_state`), and reads of any kind — including opening the roster or an
event's attendance. Logging
ordinary navigation would add steady write volume for little accountability
gain, and can be revisited if it is ever actually needed.

A failed audit write never fails the operation it describes. `recordAudit`
swallows and logs its own errors: an officer's edit succeeding but returning a
500 because the *log* insert failed would be the worse bug.

## Where each rule is enforced

Every rule above is enforced **on the server**. The app also hides controls
members cannot use, but that is presentation, not security: hiding a button
does not stop anyone calling the endpoint.

| Layer | What it does | File |
|---|---|---|
| `requireAuth` | Verifies the session token, then **loads the member row on every request** | [`middleware/auth.ts`](../backend/src/middleware/auth.ts) |

| `requireBoard` | Board and above; mounted per-route after `requireAuth` | same |
| `requireTop8` | Top 8 only — currently just level changes | same |

| Route bodies | Draft visibility, first-person check-ins, check-in window | `routes/*.ts` |
| App screens | Hides controls a level cannot use | `app/**` |

The row is re-read on every request rather than trusted from the token claims.
That is what makes demoting an officer or deleting an account take effect
immediately, instead of whenever their token happens to expire. Verified:
promoting a user in the database changes what the *same, unchanged* token can
do on the next request.

### Two token kinds, deliberately not interchangeable

Session tokens and check-in QR tokens are signed with the same secret, so each
verifier rejects the other's tokens explicitly. Without that, scanning a QR code
would hand the scanner a usable session. See `verifySession` and
`verifyCheckinToken` in [`backend/src/auth/tokens.ts`](../backend/src/auth/tokens.ts).

## Changing someone's level

A **Top 8** changes levels from inside the app: Dashboard → View members → tap a
member → pick a level. Every change is written to the audit trail.

Two refusals are enforced on the server, not just hidden in the UI, because
nothing short of SQL could undo either:

- **You cannot change your own level.** The likely mis-tap, and the only route
  to the situation below.
- **The number of Top 8s can never reach zero.** Given the rule above this is
  currently unreachable through the API — the only way to remove the last Top 8
  would be for them to demote themselves. It stays as a guard in case
  self-demotion is ever allowed.

### The first Top 8 has to be made by hand

Nothing in the app can create the first one, because only a Top 8 can promote.
Until one exists, board members can run events and post announcements but nobody
can change levels.

In the Neon console's SQL editor (Vercel → Storage → your database → Open in
Neon):

```sql
UPDATE users SET role = 2 WHERE email = 'someone@uic.edu';
```

It takes effect on that person's next request; they do not need to sign out,
because `requireAuth` re-reads the row rather than trusting the token.

For reference, the levels are `0` member, `1` board member, `2` top 8.

## Gaps

Known and deliberate, listed so nobody assumes otherwise:

- **The first Top 8 is still a SQL step.** Everything after it is in-app.
- **One level governs everything above member.** A board member who should only
  post announcements can also delete events. Splitting that needs real
  per-permission grants rather than an ordered level.
- **No account recovery.** No password reset, and no way to delete an account
  from inside the app.
