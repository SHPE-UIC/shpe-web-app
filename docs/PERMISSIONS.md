# Permissions

Who can do what, and where that is enforced.

## Roles

There are two roles and one unauthenticated state. The role is the single
`users.is_admin` boolean — there is no roles table and no per-permission
granularity.

| Role | Who | How you get it |
|---|---|---|
| **Signed out** | Anyone with the URL | — |
| **Member** | Any `@uic.edu` account | Registering. `is_admin` defaults to `false`. |
| **Officer** | A member with `is_admin = true` | **Only by running SQL.** See [Making someone an officer](#making-someone-an-officer). |

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

| Endpoint | Signed out | Member | Officer |
|---|:--:|:--:|:--:|
| `POST /api/auth/register` | ✅ | ✅ | ✅ |
| `POST /api/auth/login` | ✅ | ✅ | ✅ |
| `GET /api/auth/me` | — | ✅ own | ✅ own |
| `GET /api/events` | — | ✅ | ✅ |
| `GET /api/events/:id` | — | ✅ | ✅ |
| `POST /api/events` | — | — | ✅ |
| `PATCH /api/events/:id` | — | — | ✅ |
| `DELETE /api/events/:id` | — | — | ✅ |
| `GET /api/events/:id/checkin-token` | — | — | ✅ |
| `POST /api/check-ins` | — | ✅ self | ✅ self |
| `GET /api/check-ins/me` | — | ✅ own | ✅ own |
| `GET /api/announcements` | — | ✅ published | ✅ **all, incl. drafts** |
| `POST /api/announcements` | — | — | ✅ |
| `PATCH /api/announcements/:id` | — | — | ✅ |
| `DELETE /api/announcements/:id` | — | — | ✅ |
| `GET /api/admin/overview` | — | — | ✅ |
| `GET /api/admin/events` | — | — | ✅ |
| `GET /api/admin/events/:id/attendance` | — | — | ✅ |
| `GET /api/admin/members` | — | — | ✅ |
| `GET /api/admin/activity` | — | — | ✅ |
| `POST /api/sync/calendar` | 🔑 secret | 🔑 secret | 🔑 secret |
| `GET /healthz`, `/healthz/db` | ✅ | ✅ | ✅ |

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

**The roster carries no demographics.** `users` stores age, sex at birth, and
gender from signup, and none of the three is selected by any admin endpoint.
They are not engagement data, and putting them on a screen every officer can
open is a privacy cost with no analytical return. The roster is limited to name,
email, school level, member ID, role, join date, and attendance counts.

Widening that is a deliberate decision, not a code change to make casually — if
the chapter has to report demographics to SHPE nationals, that belongs behind
its own view and its own entry here.

**Officer changes are logged.** Every create, edit, and delete of an event or
announcement writes an `audit_log` row: who, what, which fields, and when. An
edit records only the fields it actually changed, the same per-field precision
the calendar override rule needs. Officers read it as Recent activity on the
dashboard.

The actor's email and the entity's name are **snapshotted** into the row rather
than joined at read time, so an entry still makes sense after the officer or the
thing they changed is gone — which is exactly when a log is worth having.

Not logged, deliberately: member check-ins (already timestamped rows in
`check_ins`), the calendar sync (a machine, whose per-run stats land in
`sync_state`), and reads of any kind — including opening the roster. Logging
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
| `requireAdmin` | Mounted per-route after `requireAuth` | same |
| Route bodies | Draft visibility, first-person check-ins, check-in window | `routes/*.ts` |
| App screens | Hides officer-only controls | `app/**` |

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

## Making someone an officer

**There is no way to do this from inside the app**, by design for now: no
endpoint reads or writes `is_admin`, so no request — however malformed — can
escalate a member to officer. Registration ignores the field entirely and there
is no user-update route at all.

The cost is that promotion is a manual database step. In the Neon console's SQL
editor (Vercel → Storage → your database → Open in Neon):

```sql
UPDATE users SET is_admin = true WHERE email = 'someone@uic.edu';
```

To demote:

```sql
UPDATE users SET is_admin = false WHERE email = 'someone@uic.edu';
```

Either takes effect on that person's next request; they do not need to sign out.

> **The first officer has to be made this way.** Until at least one account has
> `is_admin = true`, nobody can create an event or post an announcement.

## Gaps

Known and deliberate, listed so nobody assumes otherwise:

- **No officer management screen.** Promotion is SQL only, as above. Worth
  building, but it needs a decision first about who may promote whom — an
  officer-promotes-officer rule has no floor, and the last officer demoting
  themselves would lock the club out.
- **No account recovery.** No password reset, and no way to delete an account
  from inside the app.
- **One role for everything.** An officer who should only post announcements
  can also delete events. Splitting that needs a real roles table.
