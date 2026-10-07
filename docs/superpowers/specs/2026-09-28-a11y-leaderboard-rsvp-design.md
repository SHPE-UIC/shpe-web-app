# Design: accessibility gate, leaderboard, RSVP, and the domain fixes

Approved 2026-09-28. Delivered as five pull requests; this file is the design
they implement.

## Context

Four asks from the chapter app's maintainer:

1. **Accessibility tooling** (axe and/or Lighthouse). Chosen: axe driven by
   Playwright against the whole app, signed in, in a real browser, **blocking
   PRs** on any violation. Existing violations get fixed (or explicitly
   allow-listed with a reason) so it starts green.
2. **RSVP.** The "RSVP Now" button on the event screen is a `ComingSoon`
   placeholder today (`frontend/app/(tabs)/events-info/[id].tsx:95`). Chosen:
   a simple going / not-going toggle, **no capacity limit**; members see **only
   their own status**; officers see who RSVP'd.
3. **Leaderboard** on the home screen, visible to every signed-in member: top 5
   by **all-time** check-in points, **officers included**; rank, name, picture,
   points — **nothing tappable, and the API returns nothing else** (no id, no
   email), so no screen can reach further into a profile even by accident.
4. **Domain sanity check** — done read-only this session. `shpeuicapp.org` is
   correctly the app's URL: DNS → Hosting, cert `CERT_ACTIVE`, http→https 301,
   SPA deep links, same bundle as `.web.app`, API CORS allows it (live preflight
   204; foreign origin 403), avatar-bucket CORS includes it, Firebase
   `authorizedDomains` includes it, login screen loads with no console or
   network errors. **Two gaps, both approved for fixing:** `www.shpeuicapp.org`
   is NXDOMAIN, and verification mail carries no continue URL, so a member who
   clicks the link is left on `shpe-webapp.firebaseapp.com` with no way back.

Delivery (approved): five PRs, smallest first. Branches follow CONTRIBUTING's
prefixes; recent history uses descriptive names (`infra/app-domain`), so the
names below are defaults — swap in `SCRUM-<n>` if tickets exist.

| # | Branch | PR |
|---|---|---|
| 1 | `bugfix/verification-continue-url` | Continue link back to the app |
| 2 | `infra/www-redirect` | `www` → apex redirect (two applies) |
| 3 | `ci/a11y-gate` | axe + Playwright job, and fixes for what it finds |
| 4 | `feature/leaderboard` | Home-screen top 5 |
| 5 | `feature/rsvp` | RSVP end to end |

Every PR: tests written first and watched fail (CONTRIBUTING), both check
commands pass, docs updated where a documented rule changes. On starting PR 3,
copy this plan's design sections into
`docs/superpowers/specs/2026-09-28-a11y-leaderboard-rsvp-design.md` (repo
convention for specs) and commit it there.

---

## PR 1 — Verification continue link

- `frontend/contexts/AuthContext.tsx`: both `sendEmailVerification` calls
  (~L154, ~L178) pass action-code settings built by a small helper that reads
  `process.env.EXPO_PUBLIC_APP_URL` **at call time** (testable, no module
  reload): `{ url }` when set, `undefined` when empty — so local dev and native
  builds behave exactly as today.
- `.github/workflows/deploy.yml` "Build web bundle" env: add
  `EXPO_PUBLIC_APP_URL: https://shpeuicapp.org` (inline, like a constant — no new
  repo variable to create by hand).
- `frontend/example.env`: document `EXPO_PUBLIC_APP_URL` (optional; leave unset
  locally).
- Tests in `frontend/contexts/AuthContext.test.tsx` (mock already exists at
  `frontend/jest.setup.ts`): with the var set, `sendEmailVerification` is called
  with `{ url: 'https://shpeuicapp.org' }` on register and on resend; unset →
  called with the user only.
- Safe because `shpeuicapp.org` is in `authorizedDomains` (verified live) — an
  unlisted continue URL would make the send throw
  `auth/unauthorized-continue-uri`, which the existing code would record as
  "not sent".
- Docs: one paragraph in `docs/EMAIL-DELIVERY.md` ("Where this landed"), and
  the `docs/TODO.md` domain entry.

## PR 2 — `www.shpeuicapp.org` redirect

- `infra/firebase.tf`: second `google_firebase_hosting_custom_domain` ("www"),
  `custom_domain = "www.${var.domain_name}"`, `redirect_target = var.domain_name`,
  `wait_dns_verification = false`, same `count` guard as the apex one.
- `infra/outputs.tf`: `www_custom_domain_dns_updates`, mirroring
  `custom_domain_dns_updates`.
- Step 1: merge → `infra` workflow apply (reviewer-approved; the user runs it).
- Step 2: read the output, then a follow-up PR adds exactly those records to
  `infra/dns.tf` (no guessing — a wrong record fails silently) → apply again.
- Done when `curl -I https://www.shpeuicapp.org` → 301 to
  `https://shpeuicapp.org/` and the Hosting API reports `HOST_ACTIVE`,
  `CERT_ACTIVE` for `www`.
- Docs: `infra/README.md`, `docs/TODO.md`.

## PR 3 — Accessibility gate (axe + Playwright)

**What runs.** A new `a11y` job in `.github/workflows/ci.yml`, built on the
file's always-report pattern (every step guarded by
`needs.changes.outputs.code == 'true'`, no job-level `if`). It stands up the same
stack as local development:

1. `services: postgres:17-alpine`.
2. Auth emulator in the background:
   `npx firebase-tools emulators:start --only auth --project demo-shpe`
   (port 9099 from `firebase.json`).
3. `npm run db:migrate`, then the API in the background (`npm start`) with
   `DATABASE_URL`, a throwaway `CHECKIN_TOKEN_SECRET`,
   `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `GCLOUD_PROJECT=demo-shpe`,
   `DISABLE_SYNC_LOOP=1`.
4. Seed (below).
5. `npx expo export --platform web` with `EXPO_PUBLIC_API_URL=http://localhost:5000`,
   `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR=http://127.0.0.1:9099`,
   `EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-shpe` and placeholder key/app id; served
   with `npx expo serve` (no new dependency; handles the SPA fallback).
6. `npx playwright install --with-deps chromium`, then `npm run a11y`.

**Seed** — `backend/src/e2e/seed.ts` (typechecked by the root tsconfig, invisible
to vitest's `*.test.ts` glob), run with `tsx`. **Refuses to run unless
`FIREBASE_AUTH_EMULATOR_HOST` is set**, so it can never create accounts in the
real tenant. Creates, via the existing `createFirebaseUser`
(`backend/src/auth/firebase.ts`) plus Drizzle inserts: one member, one Top 8,
an event running now (so check-in/organizer render their live states), a
future event, a published announcement, a check-in (leaderboard has data), and
later an RSVP. Test account emails/passwords live in
`frontend/e2e/accounts.json`, read by both the seed and Playwright — emulator
only, never real.

**Scan** — `frontend/playwright.config.ts` + `frontend/e2e/a11y.spec.ts` (`.spec`,
so Jest's `*.test.ts` match never picks it up; also add `/e2e/` to Jest's
`testPathIgnorePatterns`). Dev deps in `frontend/`: `@playwright/test`,
`@axe-core/playwright`. Script `"a11y": "playwright test"`. Chromium launched
with fake media flags and camera permission granted, so the check-in scanner
renders. Signs in through the real login form, then visits and runs
`AxeBuilder().withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`
on each:

- signed out: `/`, `/signup`
- member: home, events, event detail, check-in, profile, announcements,
  verify-email
- Top 8: dashboard, event editor (new + edit), announcement editor, attendance,
  members, member, organizer QR

Fails with a readable list (rule, impact, selector, screen). An allowlist
(`frontend/e2e/a11y-allowlist.ts`: rule + selector + reason) exists but starts
empty; anything added needs a reason a reviewer can reject.

**Fixing what it finds.** Unknown until the first run; expected by pattern:
icon-only touchables without `accessibilityRole="button"`/`accessibilityLabel`
(sign-in arrow, back buttons, tab icons), inputs without labels, and contrast on
the faint/subtle text tokens. Contrast is fixed **once, in
`frontend/constants/theme.ts`**, rather than per screen — that visibly darkens
some grey text app-wide, which the PR description calls out with before/after
screenshots. If the list is very long, this PR lands the job + fixes for
everything except a named remainder allow-listed with reasons, and a follow-up
clears the allowlist.

**Local run.** Documented in README "Checks": Postgres container + emulator
(already in README steps 1–2), then one command. Also add the job to CI docs.

**Manual step (repo admin, cannot be done from here):** add `a11y` to the
*Main Protection* ruleset's required checks — until then it reports but does
not block.

## PR 4 — Leaderboard

**API** — `backend/src/routes/leaderboard.ts`, mounted in `backend/src/app.ts`
as `/api/leaderboard`, behind `requireAuth` (any level).

- One query: `check_ins` inner-join `users`, `group by users.id`,
  `sum(points)` and `max(check_ins.created_at)`, `having sum > 0`, ordered by
  points desc then that max asc (whoever reached the total first places
  higher), `limit 5`. Same aggregate style as `/api/admin/members`
  (`backend/src/routes/admin.ts:230`).
- Ranks from a pure function `rankLeaders` in `backend/src/leaderboard/rank.ts`:
  competition ranking, so ties share a number (1, 2, 2, 4).
- Response built by naming fields explicitly (the `toPublicUser` rule):
  `{ leaders: [{ rank, name, avatarUrl, points }] }` — avatar via
  `avatarUrlFor` (`backend/src/avatars/storage.ts`). **No id, email, role,
  majors, or school year.**

**App**

- `frontend/lib/leaderboard.ts`: `useLeaderboard()` in the `useMyCheckIns`
  shape (`frontend/lib/checkIns.ts` — `useFocusEffect`, so it refreshes when Home
  regains focus); types in `frontend/lib/api/types.ts`.
- `frontend/components/Leaderboard.tsx`: a card of up to five rows — rank,
  `Avatar` (`frontend/components/Avatar.tsx`, initials fallback), name, points.
  Rows are plain `View`s with no press handler; each row is one accessible
  element labelled e.g. "1st place, Ann Rivera, 40 points". Loading spinner;
  empty state "No points yet — check in at an event to get on the board."
- `frontend/app/(tabs)/home.tsx`: new "Leaderboard" section between the action
  tiles and Announcements.

**Tests (first):** `rankLeaders` ties/ordering; route test in the
`admin.overview.test.ts` mock style — 401 signed out, response keys are exactly
`rank,name,avatarUrl,points`; component test — names/points render, empty
state, no row is pressable.

**Docs:** `docs/PERMISSIONS.md` matrix row and a note that this is the one place
members see other members, with the exact fields; README "How the pieces work".

**As built** — where #44 departs from the above; trust this when they disagree:

- **Ordering and the cut.** The query only totals each member's points: no
  `having`, `order by`, or `limit`. `rankLeaders` drops members with no points,
  orders, ranks, and cuts, so all of it is under test.
- **Five places, not five rows.** Everyone tied for fifth is shown, so the
  board can run past five rows.
- **Tie-break.** A final tie-break by name keeps check-ins stamped in the same
  instant in a stable order.
- **Headings.** Both Home section titles are headings.
- **When a total was reached.** The latest check-in that earned points, not
  the latest check-in, so a check-in worth nothing cannot move a tie.
- **The id in the picture URL.** "No id" holds for the response's fields, but
  each avatar URL carries its owner's id in the object path (`users/<id>/…`).
  Accepted rather than hidden: the id is an opaque UUID that no member-facing
  route takes, and the bucket is public-read already.

## PR 5 — RSVP

**Data** — `rsvps` table in `backend/src/db/schema.ts`: `id`, `user_id` →
users (cascade), `event_id` → events (cascade), `created_at`; unique index on
`(user_id, event_id)`. A row means "going"; cancelling deletes it. Migration
via `npm run db:generate` → `drizzle/0010_*.sql` + snapshot, committed; CI's
deploy already runs it before the API ships.

**Rule** — RSVPs open until the event starts. Pure `rsvpOpen(event, now)` in
`backend/src/rsvp/window.ts` (mirrors `backend/src/checkin/window.ts`). After
start both RSVP and cancel are refused, so the officer's record of who said
they'd come is stable.

**API** (in `backend/src/routes/events.ts`, reusing its `eventId()` UUID guard):

- `GET /api/events/:id` → adds `rsvp: { going: boolean }` for the caller.
- `PUT /api/events/:id/rsvp` → idempotent (`on conflict do nothing`),
  `200 { rsvp: { going: true } }`; `400 rsvp_closed` after start; 404 unknown.
- `DELETE /api/events/:id/rsvp` → `200 { rsvp: { going: false } }`; same
  refusals.
- `GET /api/admin/events/:id/attendance` → adds
  `rsvps: [{ userId, name, email, avatarUrl, rsvpAt, checkedIn }]` (officers
  only, as today). No member-facing count or list anywhere, per the decision.
- No audit entries: RSVPs are a member's own action, and the audit log records
  officer changes.

**App**

- `frontend/lib/rsvp.ts`: `setRsvp(eventId, going)`; `useEvent`
  (`frontend/lib/events.ts:87`) also returns `going`.
- `frontend/components/RsvpButton.tsx` replacing the `ComingSoon` block: not
  going → orange "RSVP"; going → "You're going" with "Cancel RSVP"; started →
  disabled "RSVPs closed". Pending spinner, inline error from `ApiError`. Keeps
  the existing `rsvpButton` styling.
- `frontend/app/admin/attendance.tsx`: an "RSVPs (n)" section — avatar, name,
  and for past events a "Checked in" / "No-show" chip.
- `ComingSoon` stays (profile still uses it for notifications and privacy).

**Tests (first):** `rsvpOpen` boundary; route tests — PUT twice is one row and
200 both times, closed after start, 404, 401, DELETE when not going is fine;
attendance includes `checkedIn` correctly; `RsvpButton` three states + toggle
calls the API; event screen renders it.

**Docs:** PERMISSIONS matrix rows; README — remove RSVP from "What is not built
yet", add a short section; `docs/TODO.md` tick RSVP.

**As built** — where #45 departs from the above; trust this when they disagree:

- **Button color.** The button fill is `orangeDark`, since white on the brand
  orange is under 3:1.
- **Closed state.** Plain status text, not a disabled control: "RSVPs closed",
  or "You RSVP'd · RSVPs closed" for a member who had RSVP'd. Nothing there is
  pressable, and `aria-disabled` on a view with no role tells a screen reader
  nothing.
- **Stale refetches.** `useEvent` keeps a refetch that started before the
  member answered from setting `going`, so returning to the screen cannot put
  the old answer back.
- **Outcome chips.** "Checked in" and "No-show" appear only once the event has
  *ended*, not merely started.
- **Seed.** It adds a database-only member who RSVP'd and never came, so the
  no-show case is scanned.

---

## Verification

- Every PR: `npm run typecheck && npm test` and
  `cd frontend && npm test && npx tsc --noEmit && npx expo lint`.
- PR 1: after deploy, register a test account on shpeuicapp.org (a Gmail-routed
  test inbox, per EMAIL-DELIVERY), click the link, confirm Firebase's page shows
  **Continue** → `https://shpeuicapp.org`. Until then, the bundle check from this
  session: `grep shpeuicapp.org` in the deployed entry JS.
- PR 2: `nslookup www.shpeuicapp.org`, `curl -I https://www.shpeuicapp.org` →
  301 to apex; Hosting API `hostState`/`certState` for `www`.
- PR 3: `npm run a11y` passes locally and in the `a11y` CI job; deliberately
  remove one `accessibilityLabel` on a branch and watch the job fail naming it.
- PRs 4–5: local stack (README steps 1–4) + `preview_start expo-web`; seed via
  `backend/src/e2e/seed.ts`; as member: Home shows the top 5 with pictures /
  initials and no row navigates; RSVP → "You're going" → cancel → back;
  as Top 8: attendance lists the RSVP. The `a11y` job covers both new screens.
- Screenshots of Home (leaderboard) and the event screen (each RSVP state)
  attached to their PRs.
