# Firebase Integration — Design

**Date:** 2026-08-17
**Branch:** `stu`
**Status:** Approved, pending implementation plan

## Problem

The app on `main` is a complete, well-built UI shell with no real data behind it.
Login accepts a hardcoded `test` / `password` pair. Events, announcements, and
profile statistics are literal arrays in the component files. The QR scanner
reads a code and shows an alert without recording anything. `backend/server.js`
is eighteen lines that respond `"Testing"`, and it cannot start at all — the root
package declares `"type": "commonjs"` while the file uses ESM `import`.

Meanwhile two feature branches contain finished work that has never been merged:

- **`origin/Event-DB`** — a Google Calendar → Firestore sync pipeline, with the
  app reading events live through `onSnapshot`. Its README documents the whole
  system, including the convention that an event's calendar color determines its
  category and point value.
- **`origin/auth`** — Firebase Authentication with a real `AuthContext`, a
  registration form collecting a full member profile, and a UIC-email
  restriction.

The two branches are not equally mergeable, and the repository's declared
dependencies contradict both of them.

## Decisions

### Firebase, not MongoDB

Root `package.json` declares `mongoose`, `bcryptjs`, and `jsonwebtoken`. None are
imported anywhere in the repository. Both feature branches independently chose
Firebase. Firebase wins: working code exists for it, and it removes any
always-on server from the request path — the app talks to Firestore directly,
and the backend becomes a scheduled job only.

The three Mongo/JWT packages are removed as part of this work.

### Integration approach: sequenced merge, hand-ported auth

The two branches have different relationships to `main`:

| Branch | Merge-base | Contains `a8598fca` ("New app design") |
|---|---|---|
| `Event-DB` | `ba7240b2` — **`main`'s HEAD** | Yes |
| `auth` | `772046bb` — before the design | **No** |

`Event-DB` forks from `main`'s current HEAD, so merging it is a fast-forward with
zero conflicts. Its screens already use `PageHeader` and `constants/theme`, and
already handle loading and error states.

`auth` forks from before the design system existed. Its `index.tsx` and
`register.tsx` use raw `StyleSheet` with a crimson/dark palette (`#D50032`,
`#25292e`) and do not import `AuthLayout.tsx`, `PageHeader.tsx`, or
`constants/theme.ts` — those files did not exist at its base. Merging it
wholesale would produce delete-vs-modify conflicts across the design system and
would visually regress the auth screens.

**Chosen approach:** fast-forward `Event-DB`, then never `git merge origin/auth`.
Copy `auth`'s logic modules across directly and rewrite only its two screens
against the current design system.

Rejected alternatives:

- *Merge both, then repair.* Produces the same end work plus conflict resolution
  that lands in `main`'s favor on nearly every file, and a merge commit falsely
  implying `auth`'s screens shipped.
- *Rebase `auth` onto `main` first.* Buys linear history at the cost of resolving
  identical conflicts inside a rebase, where mistakes are harder to unwind.

**Attribution:** `auth`'s commits will not become ancestors. The original author
and the branch's commit SHAs (`adb3a9f3`, `7841a657`) are credited in the commit
body, and `origin/auth` is left in place as the record.

### Product decisions

| Decision | Choice |
|---|---|
| UIC email restriction | **Keep.** `isUicEmail` gates both sign-in and registration. |
| Google SSO button | **Keep visible, disabled**, labeled as coming soon. Not implemented. |
| Registration fields | **All six** profile fields, split across a two-step wizard. |
| Profile screen | Identity and sign-out wired to real data. **Statistics stay hardcoded** with an explicit TODO. |

## Scope

**In scope.** Events load live from Firestore. Authentication is real — register,
sign in, sign out, session persistence, route guarding. Home and profile display
the signed-in member's real identity. A single Firebase entry point. Mongo and
JWT dependencies removed.

**Out of scope**, each deferred to its own spec:

- Recording check-in scans to Firestore
- Points accrual from event tags
- Real "events attended" / "points earned" statistics
- The organizer QR-generation screen that `auth` scaffolded but never built
- Google SSO implementation

No code exists for any of these on any branch. They are genuinely separate
subsystems, not finishing touches.

## Architecture

```
Google Calendar ──► GitHub Actions sync ──► Firestore ──► Expo app
   (officers)         (every 30 min)          │            │
                                              │            ├─ lib/firebase.ts  ← single init
                                              │            ├─ lib/events.ts
                                              ├ events/     └─ contexts/AuthContext.tsx
                                              └ users/
```

One Firebase initialization module with two independent read layers over it.
`lib/events.ts` exposes `useUpcomingEvents()` and `useEvent(id)`;
`contexts/AuthContext.tsx` exposes `useAuth()`. Neither knows about the other.
Both use `onSnapshot`, so changes appear without a refresh.

### Firebase initialization

Two competing modules exist. `lib/firebase.ts` (from `Event-DB`) is retained: it
guards against re-initialization under Fast Refresh via
`getApps().length ? getApp() : initializeApp(...)`, which the other lacks. It is
extended with an `auth` export. `frontend/firebaseConfig.ts` (from `auth`) never
lands, and `AuthContext`'s import changes from `../firebaseConfig` to
`../lib/firebase`.

The `firebase` package is pinned at `^12.17.1` — `Event-DB`'s newer pin, which
supersedes `auth`'s `^12.11.0`.

## Implementation phases

Each phase is independently verifiable. Phase 0 stands alone: if the auth port
stalls, `stu` still has working live events.

| # | Phase | Verified by |
|---|---|---|
| 0 | Fast-forward `Event-DB`; create `frontend/.env` | Events list populates live from Firestore |
| 1 | Unify Firebase init; extend `lib/firebase.ts` with `getAuth`; delete `firebaseConfig.ts` | Typecheck passes; events still load |
| 2 | Port `auth`'s logic modules; restyle `SegmentedControl` | Typecheck passes |
| 3 | Add Jest; unit-test `isUicEmail`, `eventMapping`, `eventTags` | Test suite passes |
| 4 | Rewrite login; build two-step signup | Register a real account; confirm in Firebase console |
| 5 | `AuthGate` in root layout | Signed-out user cannot reach tabs; signed-in user skips login |
| 6 | Profile and home identity wiring; remove Mongo/JWT deps | Profile shows real name; sign out returns to login |

Phase 3 precedes the screen work deliberately: `isUicEmail` gates every auth
path in phases 4–6, so its tests should exist before anything depends on it.

## File inventory

| File | Action |
|---|---|
| `contexts/AuthContext.tsx` | Copy; change import to `../lib/firebase` |
| `types/user.ts` | Copy verbatim |
| `utils/validation.ts` | Copy verbatim |
| `components/SegmentedControl.tsx` | Copy, **restyle** — hardcoded to the old dark palette |
| `lib/firebase.ts` | Extend with `getAuth` export |
| `components/AuthLayout.tsx` | Add `disabled` to `GoogleButton`; add `AuthFieldGroup` |
| `app/index.tsx` | Rewrite: keep markup, swap fake auth for `useAuth().login` |
| `app/signup.tsx` | Rewrite as two-step wizard |
| `app/_layout.tsx` | Add `AuthProvider` + `AuthGate` inside `SafeAreaProvider` |
| `app/(tabs)/profile.tsx` | Wire identity and sign-out |
| `app/(tabs)/home.tsx` | Greet by real name |
| `firebaseConfig.ts` | Never lands |

`AuthField` is typed `{ label: string } & TextInputProps` and therefore cannot
wrap a `SegmentedControl`. Step 2 needs `AuthFieldGroup`, which renders
`AuthField`'s existing label styling around arbitrary children — reusing the
established visual idiom rather than introducing a new one.

## The signup wizard

**Step 1 — Account:** Name, Email, Password, Confirm Password. Validates locally
before advancing: UIC domain, passwords match, length ≥ 6.

**Step 2 — Profile:** Age, Sex at birth, Gender, School level, Member ID.
`AuthLayout`'s existing `onBack` returns to step 1 with state intact.

Implemented as a single `signup.tsx` with internal step state, not two routes.

### Account creation must happen once, at the end

`createUserWithEmailAndPassword` creates the auth user immediately. If step 1
called it and the user abandoned step 2, the result would be an orphaned auth
account with no `users/{uid}` document — which `AuthContext` would then load as
`profile: null` indefinitely, with no path to recovery in the app.

Both steps therefore collect into local state, and `register()` fires exactly
once when step 2 submits.

### Known trade-off: late duplicate-email detection

Because no account exists until step 2 submits, `auth/email-already-in-use`
cannot surface at step 1 where the email was entered. Someone re-registering
fills out five additional fields before being told. Firebase's
`fetchSignInMethodsForEmail` is neutered by email-enumeration protection, so
there is no clean early check.

**Mitigation:** catch that specific error code at final submit and return the
user to step 1 with the error anchored on the email field and all state
preserved — one correction, not a re-entry.

## Auth gate

`AuthGate` replaces `auth`'s version with three corrections:

- Registers only routes that exist. `auth`'s version registered `edit-profile`
  and `organizer/qr/[eventId]`, neither of which has a file on any branch.
- Nests inside the `SafeAreaProvider` that `auth`'s root layout dropped.
- Uses `colors.navy` for the loading spinner rather than the stray `#D50032`.

Sign-in error handling keeps `auth`'s per-code messages (`user-not-found`,
`invalid-credential`, `too-many-requests`), which are better than anything
currently on `main`.

## Session persistence — must be verified, not assumed

`auth` uses plain `getAuth()`. On React Native this may not persist sessions
across app restarts, because the web SDK's default persistence is `localStorage`,
which does not exist on device. Behavior under `firebase@^12.17.1` is not
confirmed — it may warn rather than fail silently.

Phase 5 verification is explicitly: **force-quit the app, reopen it, confirm the
session survives.** If it does not, the fix is `initializeAuth` with
`getReactNativePersistence` backed by
`@react-native-async-storage/async-storage`, which is then added as a dependency.
It is not added preemptively.

## Configuration

`frontend/.env` requires the six `EXPO_PUBLIC_FIREBASE_*` values. The prefix is
load-bearing — Expo ignores other names and the app fails silently at the first
Firestore call. Values are inlined at build time, so every `.env` change requires
`npx expo start -c`.

### Blocking dependency for Phase 0

Scheduled workflows run only from the default branch, so the calendar sync will
not run while work is on `stu`. Phase 0's verification depends on Firestore
already containing event documents. Three cases:

1. `events/` is already populated — verify immediately.
2. `events/` is empty — run `npm run sync` locally, which needs
   `serviceAccountKey.json`, the Google Calendar API enabled, and the calendar
   shared with the service account's `client_email`.
3. Neither available — Phase 0 verification degrades to "the empty state renders
   without crashing," and live-data confirmation waits until merge to `main`.

**This must be checked before any code is written.**

Separately, the repository secret `GOOGLE_SERVICE_ACCOUNT_JSON` must exist for
the scheduled sync to run after merge. This is a GitHub settings change outside
the codebase.

## Dependency cleanup

Root `package.json`: remove `mongoose`, `bcryptjs`, `jsonwebtoken`. Retain
`express`, `dotenv`, `firebase-admin`, `googleapis`. `Event-DB` already sets
`"type": "module"` and renames `eslint.config.js` → `.cjs` to match, which
incidentally repairs the ESM/CommonJS mismatch that currently prevents the
backend from starting.

Frontend: `firebase` at `^12.17.1`. `react-native-qrcode-svg` and
`react-native-svg` are **not** carried over — they exist on `auth` solely for the
unbuilt organizer QR screen.

Add a `"typecheck": "tsc --noEmit"` script; the frontend currently has none.

## Testing

The repository has no test infrastructure on any branch — no Jest, no
testing-library. Building out React Native component testing is its own project
and is not attempted here.

**Added:** Jest with unit tests for the pure logic, where the real correctness
risk lives:

- `isUicEmail` — accepts `a@uic.edu`; rejects `a@uic.edu.evil.com` and
  `a@fake-uic.edu`; handles whitespace and case
- `backend/eventMapping.js` — Google event → app schema, including all-day events
- `backend/config/eventTags.js` — color → category → points, including the
  no-color default

Screens and Firestore integration are covered by manual acceptance checks rather
than automated tests. This is stated plainly so that coverage is not overread.

## Acceptance criteria

**Authentication**
- Registering a `@uic.edu` account through both steps creates `users/{uid}` with
  all six profile fields, `isAdmin: false`, and `createdAt`
- A non-UIC email is rejected at step 1
- A duplicate email returns to step 1 with entered state intact
- Sign out returns to the login screen
- Signing in lands on home
- Force-quitting and reopening preserves the session
- A signed-out deep link to `/(tabs)/home` redirects to login

**Events**
- The list renders live Firestore data
- Editing an event in Google Calendar and running the sync updates the app
  without a refresh
- An event detail deep link resolves
- Empty and error states render correctly

**Identity**
- Home greets the member by real name
- Profile shows real name, email, and role
- Profile statistics still show `12` / `240`, carrying an explicit TODO — this is
  expected and must not be reported as working

**Static**
- `npx tsc --noEmit` passes in `frontend/`
- `npx expo lint` passes
- Jest unit tests pass
