# Signup Profile Fields — School Year, Majors, and UIN

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

The chapter used to collect member data through a Google Form: **Name, UIC Email,
School year (1st–6th / Graduate / PhD / Other), Major (checkboxes, 13 options +
Other)**. When signup moved into the app the school-year list was narrowed to
Freshman/Sophomore/Junior/Senior/Graduate and **major was dropped entirely**.
The university's own student number, the **UIN**, was never collected at all.

That loss matters beyond record-keeping. The push-notification work planned in
`docs/superpowers/plans/2026-09-01-push-notifications.md` is meant to target
announcements at subsets of the chapter — "a Computer Science info session"
should reach CS members, not all 300. There is no column to select on. Every
such feature is blocked until majors are recorded in a queryable shape.

**Outcome:** signup step 2 collects the same school year and majors the form
did, plus the UIN, stored so that a targeting query is a one-line `WHERE`.

### Decisions confirmed by the maintainer (2026-09-02)

1. **Majors are multi-select.** An "Other" free-text answer is recorded and shown
   on the member's own profile, but is **never** used by targeting or any other
   feature.
2. **School year adopts the form's list:** 1st, 2nd, 3rd, 4th, 5th, 6th,
   Graduate, PhD, Other.
3. **No backfill.** No real accounts exist yet; only test rows.
4. **Majors are visible in aggregate only** — a chapter-wide breakdown for
   officers, not a column on the per-member roster.
5. **UIN is collected and required**, validated as exactly nine digits.
6. **UIN is Top 8 only.** Not on the board-wide roster; served by its own
   Top 8-guarded endpoint.
7. **UIN and SHPE member ID are two different numbers**, and both are kept.

### On reintroducing the word "UIN"

`docs/PERMISSIONS.md` and the 2026-08-30 plan both state that nothing
user-visible may say "UIN". That rule was written when the *SHPE membership
number* was mislabelled as one — it was a correction of a wrong label, not a
decision never to collect the university number. Decision 7 above adds the real
UIN as a second, separate field. **Both documents must be updated in Task 6**, so
the rule reads as superseded rather than violated by whoever finds it next.

The two fields look alike (both nine digits), so the copy has to separate them:
the SHPE member ID comes from shpeconnect.org, the UIN from the UIC i-card.

### GCP CLI — verified

`gcloud` is installed and usable, with one wrinkle worth recording:

| Check | Result |
|---|---|
| Binary | Google Cloud SDK 582.0.0, `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk` |
| Account | `communications.shpe.uic@gmail.com` (active) |
| Project | `shpe-webapp` |
| Cloud SQL | `shpe-pg`, POSTGRES_17, `us-central1-a`, **RUNNABLE**, `34.70.134.228` |

**Run gcloud from PowerShell, not Git Bash.** `gcloud.cmd` uses the SDK's bundled
Python; the Bash shim (`.../bin/gcloud`) looks for a system `python` and dies on
the Windows Store stub. Ad-hoc SQL is the documented path from
`docs/DEPLOYMENT.md`:

```
gcloud sql connect shpe-pg --user=shpe_api --database=shpe
```

Schema changes still go through Drizzle and the `shpe-migrate` Cloud Run job —
`gcloud sql connect` is for inspection and one-off fixes, not for this change.

---

## Global constraints

- Migrations run through `shpe-migrate` on deploy; one that cannot apply stops
  the pipeline before new code serves traffic.
- Suites stay green: `npm run typecheck && npm test` (root),
  `cd frontend && npx tsc --noEmit && npm test`.
- Frontend test files never live under `frontend/app/` — Expo Router would treat
  them as routes.
- Follow the existing `gender` / `gender_self_described` precedent for every
  "fixed option plus free text" pair rather than inventing a second shape.
- **A guard names the level it needs at the point of use** (see the comment on
  `requireTop8` in `backend/src/middleware/auth.ts`). No field inside a
  board-guarded payload may carry a Top 8-only value.

---

## Task 1: Schema and migration 0009

**Files:** `backend/src/db/schema.ts`; `drizzle/0009_school_year_majors_uin.sql`
(via `npm run db:generate`, then hand-edit as `drizzle/0005_single_gender_field.sql` was).

```ts
export const SCHOOL_LEVEL_OPTIONS = [
  '1st', '2nd', '3rd', '4th', '5th', '6th', 'Graduate', 'PhD', 'Other',
] as const;

/**
 * The majors a member can be targeted by. 'Other' is deliberately absent —
 * see the note on users.majors.
 */
export const MAJOR_OPTIONS = [
  'Biomedical Engineering', 'Chemical Engineering', 'Civil Engineering',
  'Computer Engineering', 'Computer Science', 'Data Science',
  'Electrical Engineering', 'Engineering Management', 'Engineering Physics',
  'Environmental Engineering', 'Industrial Engineering', 'Mechanical Engineering',
] as const;
```

New and changed columns on `users`:

| Column | Type | Note |
|---|---|---|
| `school_level` | `text` (existing) | now one of the nine above |
| `school_level_other` | `text` | set only alongside `school_level = 'Other'`, required there |
| `majors` | `text[] not null default '{}'` | canonical values only |
| `major_other` | `text` | the free-text answer, independent of `majors` |
| `uin` | `text` | nine digits; `uniqueIndex('users_uin_idx')` |

**Why `'Other'` is not a value inside `majors`, unlike `gender`.** The
maintainer's rule is that an Other major never drives a feature. If `'Other'` sat
in the array, every targeting query, every aggregate, and every future filter
would have to remember to exclude it — and the one that forgets sends a CS
announcement to someone studying Art History. Keeping the array purely canonical
enforces the rule in the data shape instead of in each caller's discipline.
`major_other` carries the text on its own, and a member may set it with or
without also picking canonical majors. `school_level_other` keeps the gender
shape instead, because there the single column already holds one of a known set
and `'Other'` is a real answer.

**Why `uin` is unique.** A UIN identifies exactly one student, so two accounts
sharing one is either a typo or a duplicate account — the same problem the email
unique index already catches, and worth catching at the door for the same reason.
The cost is that a member who mistypes someone else's UIN is told it is taken;
that is the accepted trade on email too. Stored as `text`, not an integer — it is
an identifier that can carry a leading zero, never a quantity.

Migration body — the generated `ADD COLUMN`s and the index, preceded by the same
defensive cleanup 0005 used, so no leftover test row survives holding a value
outside the new set:

```sql
UPDATE "users" SET "school_level" = NULL
  WHERE "school_level" NOT IN ('1st','2nd','3rd','4th','5th','6th','Graduate','PhD','Other');
```

- [x] **Step 1:** Edit `schema.ts` — option lists, five column lines, the unique
      index, with the reasoning above kept as comments.
- [x] **Step 2:** `npm run db:generate`, rename to
      `0009_school_year_majors_uin.sql`, match the `tag` in
      `drizzle/meta/_journal.json`, prepend the `UPDATE`. **Read the generated
      SQL** — confirm `majors` came out `NOT NULL DEFAULT '{}'` and that the
      unique index is on `uin` alone.
- [x] **Step 3:** Prove it applies against a scratch DB, as the 0005 plan did:
      `docker run -d --name mig-check -e POSTGRES_PASSWORD=x -p 55433:5432 postgres:17-alpine`,
      then `DATABASE_URL=postgresql://postgres:x@localhost:55433/postgres CHECKIN_TOKEN_SECRET=s npm run db:migrate`;
      `docker rm -f mig-check`.

---

## Task 2: Backend validation and registration

**Files:** `backend/src/validation.ts`, `backend/src/db/errors.ts`,
`backend/src/routes/auth.ts`, `backend/src/auth/user.ts`.
**Tests:** `backend/src/validation.test.ts`, `backend/src/routes/auth.test.ts`.

`parseGenderSelfDescribed` (`backend/src/validation.ts`) is now one of three
identical "free text that belongs to one option" checks. Extract its body and
call it three times rather than copying it:

```ts
export const MAX_SELF_DESCRIPTION_LENGTH = 50; // keep MAX_GENDER_SELF_DESCRIPTION_LENGTH as an alias
export const UIN_PATTERN = /^\d{9}$/;

function requiredDescription(value: unknown, message: string, code: string): string;
function parseMajors(value: unknown): string[];  // filters to MAJOR_OPTIONS, de-dupes, preserves list order
function parseUin(value: unknown): string;       // strips spaces and dashes, then tests UIN_PATTERN
```

`RegistrationInput` gains `schoolLevelOther: string | null`, `majors: string[]`,
`majorOther: string | null`, `uin: string`. Rules:

- `schoolLevel` becomes **required** (`oneOf` returning null throws
  `school_level_required`). It is required in the form today and the column has
  no legacy NULLs to protect. Columns stay nullable — same as `gender`, where the
  route requires what the column permits.
- `schoolLevelOther` required when and only when `schoolLevel === 'Other'`;
  forced to null otherwise.
- At least one of `majors` (non-empty) or `majorOther` is required
  (`major_required`).
- `majorOther` capped at `MAX_SELF_DESCRIPTION_LENGTH`; unknown strings in
  `majors` are dropped rather than rejected, so a client on an older bundle
  degrades instead of 400ing.
- `uin` required, nine digits after stripping spaces and dashes
  (`uin_required` / `uin_invalid`). Normalising before testing means a member who
  types `651-234-567` is helped, not scolded.

**Constraint-aware unique violations.** `isUniqueViolation`
(`backend/src/db/errors.ts`) returns only a boolean, so `routes/auth.ts` reports
every duplicate as `email_taken`. With a second unique column that becomes a lie.
Add a sibling that walks the same `cause` chain and returns the constraint name,
then branch on it:

```ts
export function uniqueViolationConstraint(err: unknown): string | null;
```

`auth.ts` maps `users_uin_idx` to `409 uin_taken` ("An account already uses that
UIN") and anything else to the existing `email_taken`. The Firebase-user cleanup
on failure stays exactly as it is.

`toPublicUser` (`backend/src/auth/user.ts`) gains `schoolLevelOther`, `majors`,
`majorOther` — a member's own year and majors are theirs to see. **`uin` is not
added to `PublicUser`**: it goes only through the Top 8 endpoint in Task 4, and a
field on the shape every route returns is exactly how it would leak.

- [x] **Step 1: Write the failing tests** (see the matrix in Task 7).
- [x] **Step 2: Run to verify failure** — `npx vitest run backend/src/validation.test.ts backend/src/routes/auth.test.ts`.
- [x] **Step 3: Implement.**
- [x] **Step 4: Verify** — `npm run typecheck && npm test`.

---

## Task 3: Admin — the chapter-wide majors breakdown

**Files:** `backend/src/routes/admin.ts` (the `/overview` handler),
`frontend/lib/adminStats.ts`, `frontend/app/(tabs)/dashboard.tsx`.
**Tests:** the admin route tests.

Majors are reported **in aggregate only** — no major on a roster row, leaving the
select list in the `/members` handler untouched.

Add to the `/overview` response, beside the existing `members` block:

```ts
majors: { major: string; members: number }[]  // desc by count; canonical values only
```

Query it with `unnest`, which is why the column is an array rather than a join
table at this scale:

```sql
select unnest(majors) as major, count(*)::int as members
from users group by 1 order by 2 desc
```

`major_other` is not counted and not returned — it is a note on a profile, not a
category. Render it on the officer dashboard as a ranked list under the member
stats.

- [x] **Step 1: Write the failing tests** (Task 7 matrix).
- [x] **Step 2: Run to verify failure.**
- [x] **Step 3: Implement** the aggregate, the `AdminOverview` type, and the card.
- [x] **Step 4: Verify** — `npm test` and `cd frontend && npm test`.

---

## Task 4: Admin — the Top 8 UIN endpoint

**Files:** `backend/src/routes/admin.ts`, `frontend/app/admin/member.tsx`,
`frontend/lib/api/types.ts`.
**Tests:** the admin route tests, `frontend/__tests__/` (new member-screen test).

```ts
/** One member's UIN. Top 8 only — see docs/PERMISSIONS.md. */
adminRoutes.get('/members/:id/uin', requireTop8, async (req, res) => { … });
// 200 { uin: string | null } · 404 member_not_found · 403 not_top8
```

**Why a separate route rather than a conditional field on the roster.** The
roster is guarded `requireBoard`. Putting a Top 8-only value inside its payload
would mean the route's guard no longer describes what the route returns — the
precise thing the comment on `requireTop8` says to avoid — and the field would
survive any later refactor of that select list unnoticed. A dedicated route
carries its own guard, keeps the roster's shape identical for every officer, and
fetches one UIN only when someone deliberately opens one member.

`frontend/app/admin/member.tsx` is already behind a Top 8 wall (it renders
"Top 8 only" otherwise) and already takes an `id`, so it is the natural and only
consumer: fetch on mount, render the UIN in the member's detail card, render
nothing at all if the response is null.

- [x] **Step 1: Write the failing tests** (Task 7 matrix).
- [x] **Step 2: Run to verify failure.**
- [x] **Step 3: Implement** the route, then the screen's fetch and display.
- [x] **Step 4: Verify** — `npx vitest run backend/src/routes/admin.test.ts`, then `cd frontend && npm test`.

---

## Task 5: Frontend — signup step 2 and the profile card

**Files:** `frontend/lib/api/types.ts`, `frontend/lib/validation.ts`,
`frontend/components/SegmentedControl.tsx`, `frontend/app/signup.tsx`,
`frontend/app/(tabs)/profile.tsx`.
**Tests:** `frontend/__tests__/signup.test.tsx`, `frontend/__tests__/profile.test.tsx`.

`types.ts` mirrors `SCHOOL_LEVEL_OPTIONS` and `MAJOR_OPTIONS` verbatim (the file
is hand-written on purpose — see its header comment) and extends `PublicUser` and
`RegistrationPayload` per Task 2. `frontend/lib/validation.ts` gains
`UIN_PATTERN`, mirroring the server copy the same way `isUicEmail` already does.

**Multi-select control.** Add `MultiSelectControl` to
`frontend/components/SegmentedControl.tsx`, sharing that file's `styles` — the
pills are identical, only the semantics differ (`value: readonly T[]`,
`onToggle`, `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`).
A second component with duplicated styling would drift; a `multi` flag on the
existing one would make `value`'s type conditional for no gain.

Step 2 becomes: Gender → (gender description if Other) → School year → (year
description if Other) → Major(s) → (major description if Other) → SHPE member ID
→ UIN. The conditional description fields follow the existing `gender === 'Other'`
pattern in `signup.tsx`, including its rule that changing the selection clears the
stale text.

The "Other" major is a **13th pill** that toggles the free-text field; it is not
written into `majors`. Track it as its own boolean beside the array.

Because both nine-digit fields now sit together, their copy must distinguish
them: SHPE member ID keeps its "Don't have one? Join SHPE" link; UIN is labeled
"UIN" with placeholder `e.g. 651234567` and helper text naming the i-card.

Client-side checks in `handleSubmit` mirror the server's, in field order, in the
existing style: `'Select your school year.'`, `'Tell us your school year.'`,
`'Select at least one major.'`, `'Tell us your major.'`, `'Enter your 9-digit UIN.'`

**Profile card** (`frontend/app/(tabs)/profile.tsx`) gains a read-only line under
the role chip: school year (or the Other text) and the majors joined by `·`, with
`majorOther` appended. This is the only place an Other major surfaces. **The UIN
is not rendered here** — it is not in `PublicUser`.

- [x] **Step 1: Write the failing tests** (Task 7 matrix).
- [x] **Step 2: Run to verify failure** — `cd frontend && npx jest __tests__/signup.test.tsx`.
- [x] **Step 3: Implement.**
- [x] **Step 4:** Verify step 2 still scrolls on a short viewport — it grows from
      three groups to seven, and `AuthLayout` has not had to scroll before.
- [x] **Step 5: Verify** — `cd frontend && npx tsc --noEmit && npm test`.

---

## Task 6: Docs

- [x] `docs/ARCHITECTURE.md` — the `users` class diagram (~line 285) and ER
      diagram (~line 431): the five columns, the new school-year set, and one
      sentence on why `'Other'` sits outside `majors`.
- [x] `docs/PERMISSIONS.md` — the "roster carries no demographics" passage
      (~line 112). Three additions: majors are reported chapter-wide in aggregate
      and are not on the roster; `major_other` and `school_level_other` are
      returned only to the member who wrote them; **UIN is Top 8 only, served by
      `GET /api/admin/members/:id/uin` and absent from `PublicUser`**. Add the
      route to the permission matrix.
- [x] `docs/PERMISSIONS.md` — **rewrite the "nothing may say UIN" rule**, per the
      note in Context: it was a correction of a mislabelled SHPE number, and the
      university UIN is now collected as its own field.
- [x] `README.md` — the signup field list, including both nine-digit fields and
      what tells them apart.
- [x] `docs/superpowers/plans/2026-09-01-push-notifications.md` — a line in the
      spec section noting `users.majors` is now the targeting column, and that
      `major_other` is out of scope for sends by design.
- [x] `docs/TODO.md` — two entries: members cannot change their year or majors
      after signup (no profile-edit screen — harmless with no live accounts, real
      the first time someone advances a year); and reading a UIN is not audited,
      because `auditLog`'s action enum has no `view` and widening it needs its
      own migration.
- [x] `docs/superpowers/specs/2026-08-27-free-tier-deployment-design.md` is a
      historical design record — leave it.

---

## Task 7: Test matrix

Every case below is required. Backend is vitest, frontend is jest with
`@testing-library/react-native`, matching what each suite already uses.

### `backend/src/validation.test.ts`

Update the `valid` fixture first — it must carry `schoolLevel: '3rd'`,
`majors: ['Computer Science']`, `uin: '651234567'`.

| # | Case | Expect |
|---|---|---|
| 1 | each of the nine school levels | accepted, returned verbatim |
| 2 | `schoolLevel: 'Freshman'` | throws `school_level_required` — the old value is gone |
| 3 | `schoolLevel` absent | throws `school_level_required` |
| 4 | `schoolLevel: 'Other'`, no description | throws `school_level_other_required` |
| 5 | `schoolLevel: 'Other'` + description | both returned |
| 6 | `schoolLevel: '3rd'` + a description | `schoolLevelOther` forced to `null` |
| 7 | `majors` with two canonical values | both returned, list order preserved |
| 8 | `majors: ['Computer Science', 'Underwater Basket Weaving']` | junk dropped, CS kept |
| 9 | `majors: ['Computer Science', 'Computer Science']` | de-duped to one |
| 10 | `majors: []` and no `majorOther` | throws `major_required` |
| 11 | `majorOther` alone, `majors: []` | accepted — Other is a valid sole answer |
| 12 | `majors: ['Other']` | `'Other'` is dropped; falls to `major_required` if nothing else |
| 13 | `majorOther` over 50 chars | throws `major_other_too_long` |
| 14 | `uin: '651234567'` | returned unchanged |
| 15 | `uin: '651-234-567'` and `' 651 234 567 '` | normalised to `'651234567'` |
| 16 | `uin: '12345678'`, `'1234567890'`, `'65123456a'` | throws `uin_invalid` |
| 17 | `uin` absent or empty | throws `uin_required` |
| 18 | `uin: '000000001'` | accepted — leading zeros survive, which is why it is text |

### `backend/src/routes/auth.test.ts`

| # | Case | Expect |
|---|---|---|
| 19 | successful register | insert called with `majors`, `majorOther`, `schoolLevelOther`, `uin` |
| 20 | response body | `user` has `majors`/`majorOther`/`schoolLevelOther`, and **no `uin`** |
| 21 | unique violation on `users_uin_idx` | `409` code `uin_taken`, Firebase user deleted |
| 22 | unique violation on the email index | `409` code `email_taken` — unchanged |
| 23 | invalid UIN | `400`, and **no Firebase user is created** (validation runs first) |

### `backend/src/db/errors.test.ts`

| # | Case | Expect |
|---|---|---|
| 24 | `uniqueViolationConstraint` on a wrapped pg error | returns the constraint name from any depth |
| 25 | a non-unique error, and `null` | returns `null`; `isUniqueViolation` keeps its current behaviour |

### `backend/src/routes/admin.test.ts`

| # | Case | Expect |
|---|---|---|
| 26 | `GET /overview` | `majors` present, sorted desc by count |
| 27 | `GET /overview` with an Other-only member | that member contributes no row |
| 28 | `GET /members` | no `uin` and no `majors` on any roster row |
| 29 | `GET /members/:id/uin` as Top 8 | `200 { uin }` |
| 30 | `GET /members/:id/uin` as board member | `403` code `not_top8` |
| 31 | `GET /members/:id/uin` unauthenticated | `401` |
| 32 | `GET /members/:id/uin` unknown id | `404` code `member_not_found` |
| 33 | `GET /members/:id/uin` for a member with none | `200 { uin: null }` |

### `frontend/__tests__/signup.test.tsx`

| # | Case | Expect |
|---|---|---|
| 34 | step 2 renders | year pills read `1st` and `PhD`; `Freshman` is absent |
| 35 | both nine-digit fields render | `SHPE member ID` and `UIN` both present and distinguishable |
| 36 | pick two majors | both sent in `majors` |
| 37 | tick the Other major pill | text field appears; its answer sent as `majorOther`, not inside `majors` |
| 38 | untick Other | the stale description is cleared, matching the gender rule |
| 39 | submit with no major | `'Select at least one major.'`, no request sent |
| 40 | submit with no year | `'Select your school year.'` |
| 41 | year `Other` without text | `'Tell us your school year.'` |
| 42 | submit with an 8-digit UIN | `'Enter your 9-digit UIN.'`, no request sent |
| 43 | server answers `uin_taken` | the error surfaces on the form; the entered values survive |

### `frontend/__tests__/profile.test.tsx`

| # | Case | Expect |
|---|---|---|
| 44 | member with two majors | both render, `·`-joined, under the role chip |
| 45 | member with `majorOther` | the Other text renders too |
| 46 | any member | the UIN never renders — it is not in `PublicUser` |

### `frontend/__tests__/admin-member.test.tsx` (new)

| # | Case | Expect |
|---|---|---|
| 47 | Top 8 opens a member | the UIN endpoint is called and the value renders |
| 48 | endpoint returns `{ uin: null }` | nothing is rendered where the UIN would be |

---

## Verification (end to end, after deploy)

1. `npm run typecheck && npm test`; `cd frontend && npx tsc --noEmit && npm test` — all green.
2. Migration 0009 applies cleanly against the scratch Postgres (Task 1) and again
   through `shpe-migrate` on deploy.
3. Register a fresh `@uic.edu` account. Step 2 offers 1st–6th/Graduate/PhD/Other,
   the 13 major pills, and both number fields; pick two majors plus Other with a
   description.
4. Try registering a second account with the **same UIN** — refused with the UIN
   message, not the email one.
5. Confirm the row, from PowerShell:
   ```
   gcloud sql connect shpe-pg --user=shpe_api --database=shpe
   ```
   ```sql
   select school_level, school_level_other, majors, major_other, uin from users;
   -- the targeting query the whole change exists for:
   select count(*) from users where majors && array['Computer Science'];
   ```
   The second must **not** count the Other-major account.
6. Open the profile tab as that member: year and both majors render, Other
   included, and no UIN anywhere.
7. As a **board member**: Dashboard shows the majors breakdown with no row for the
   Other answer; the roster shows no UIN; opening a member hits the Top 8 wall.
8. As a **Top 8**: opening that member shows the UIN.
9. `GET /api/admin/members` returns no `uin` and no `majors` on any row.
