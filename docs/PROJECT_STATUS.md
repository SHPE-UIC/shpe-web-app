# SHPE Web App Project Status

Last updated: August 27, 2026  
Working branch: `feature/firebase-stuff`

## Executive summary

The Firebase integration milestone is implemented. The Expo app now reads live
events from Firestore, authenticates members with Firebase Email/Password Auth,
persists the session with React Native AsyncStorage, protects signed-in routes,
and shows the signed-in member's real profile. The Google Calendar sync backend
and its scheduled GitHub Actions workflow are present.

The milestone is not production-ready yet. The highest-priority remaining work
is to define and deploy Firestore security rules, finish an end-to-end device
acceptance pass, unblock and verify the Google Calendar API sync, and restore
the native app icon/splash assets referenced by `frontend/app.json`.

## Current architecture

```text
Google Calendar -> Node sync job -> Firestore events -> Expo app
                                             |
Firebase Email/Password Auth -> users/{uid} -+
```

- `frontend/` is the Expo SDK 54 / React Native application.
- `backend/` maps Google Calendar events and synchronizes them to Firestore.
- `.github/workflows/calendar-sync.yml` runs the sync every 30 minutes from the
  repository's default branch and also supports manual runs.
- `frontend/lib/firebase.ts` is the single frontend Firebase initialization
  module for Auth, Firestore, and Storage.

## Implemented and verified

| Area | Current state | Evidence |
| --- | --- | --- |
| Live events | Event list uses Firestore `onSnapshot`, filters past events, sorts upcoming events, and supports tag filters. Event detail reads one Firestore document and supports deep links. | A real Firestore event was loaded in the app and the event detail screen was manually confirmed. |
| Calendar mapping | Calendar titles, descriptions, locations, date/time, color-derived category, and points map into the app event schema. Incremental sync-token and deletion handling are implemented. | 12 backend tests pass. |
| Authentication | Email/password login and two-step registration are connected to Firebase Auth. Registration validates `@uic.edu`, password rules, profile fields, and creates `users/{uid}`. Friendly Firebase error messages are implemented. | Auth/validation unit tests pass; Email/Password provider is enabled. Full device flow remains to be exercised. |
| Session and routes | Auth state gates protected Expo Router routes. React Native persistence uses AsyncStorage, while web uses Firebase's browser auth persistence. | TypeScript and Android/web bundling pass. Force-quit persistence and signed-out deep links still need device verification. |
| Member identity | Home uses the member's first name. Profile uses the real name, email, and admin/member role. Sign out is connected. | TypeScript and unit tests pass. Manual device verification remains. |
| Backend cleanup | Unused MongoDB, bcrypt, and JWT packages were removed. | Backend starts successfully and `/healthz` returns HTTP 200. |

## Automated verification snapshot

Run on August 27, 2026:

| Check | Result |
| --- | --- |
| `npm test` | Pass: 12/12 backend tests |
| `frontend/npm test -- --runInBand` | Pass: 19/19 frontend tests |
| `frontend/npm run typecheck` | Pass: no TypeScript errors |
| `frontend/npx expo lint` | Pass with 0 errors and 6 warnings, all in `app/(tabs)/check-in.tsx` |
| Android development bundle | Pass; bundle served successfully |
| Production web export | Pass after separating browser Auth initialization from React Native AsyncStorage persistence |
| Backend startup and `/healthz` | Pass |
| Local `npm run sync` | Blocked: Google Calendar API is disabled for project `335746674027`, or enablement has not propagated yet |

The existing frontend tests cover validation and error-message logic. There are
currently no component, Firebase integration, navigation, or end-to-end tests.

## Manual acceptance still required

These checks have not been claimed as passing. Run them on a physical device or
emulator after restarting Expo with `npx expo start -c`:

### Authentication

- Register a new `@uic.edu` account through both steps.
- Confirm non-UIC email, mismatched password, short password, and invalid age
  are rejected.
- Confirm going back from registration step 2 preserves step 1 input.
- Confirm `users/{uid}` contains all profile fields, `email`, `isAdmin: false`,
  and `createdAt`.
- Register the same email again and confirm the form returns to step 1 with its
  values intact.
- Confirm sign out returns to login and signing in lands on Home.
- Force-quit and reopen the app to confirm the AsyncStorage session persists.
- Open a protected deep link while signed out and confirm it redirects to login.

### Events and identity

- Edit a Google Calendar event, run the sync, and confirm the app changes
  without a manual refresh.
- Exercise the event empty and Firestore-error states.
- Confirm Home and Profile display the authenticated member's real identity.
- Confirm the placeholder `12 events / 240 points` statistics remain visibly
  understood as placeholders until attendance is implemented.

## Known mock, incomplete, or broken features

| Priority | Feature | Current behavior | Work remaining |
| --- | --- | --- | --- |
| P0 | Firestore security | No versioned `firestore.rules`, `storage.rules`, `firebase.json`, or `.firebaserc` exists. A signed-out event read succeeded during setup, so deployed rules may be permissive. The `@uic.edu` restriction is client-side and can be bypassed through the Firebase API. | Design least-privilege rules for events, user profiles, attendance, and admin writes; add emulator/rules tests; deploy rules before production use. Add server-side or rules-backed eligibility enforcement if UIC-only membership is a security requirement. |
| P0 | Calendar sync | Sync code and workflow exist, but the final local sync returned a Google API-disabled error. Scheduled workflows run only from the default branch. | Enable the Google Calendar API for project `335746674027`, allow time to propagate, share the calendar with the service-account `client_email`, rerun `npm run sync`, and verify `GOOGLE_SERVICE_ACCOUNT_JSON` exists in GitHub Actions secrets. |
| P0 | Native release assets | `frontend/app.json` references `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, and `splash-icon.png`, but those files are absent. Expo warns about the missing adaptive icon. | Add the referenced assets or update `app.json`, then perform Android/iOS release builds. |
| P0 | Registration consistency | Firebase Auth account creation happens before the Firestore profile write. A denied or failed profile write can leave an authenticated account without `users/{uid}`. | Add recovery/rollback behavior and test partial failures. Decide how the UI handles an authenticated user whose profile is missing. |
| P1 | Check-in and attendance | The camera scanner displays the raw QR value in a success alert. It does not identify an event, record attendance, prevent duplicates, validate eligibility, or award points. Its event subtitle is hardcoded. | Define the attendance schema and security model; pass an event ID to the scanner; create an idempotent trusted write path; add organizer QR generation and tests. |
| P1 | Profile statistics | `12` events and `240` points are hardcoded placeholders with a source TODO. | Derive statistics from verified attendance after check-in exists. |
| P1 | RSVP | The event detail `RSVP Now` button has no action. | Define RSVP data, permissions, capacity/wait-list behavior, and wire the button. |
| P1 | Announcements | Home contains a hardcoded two-item announcements array. `See all` and announcement cards have no actions. | Add a Firestore-backed announcement model, officer publishing flow, list/detail screens, and links. |
| P2 | Password recovery | `Forgot Password?` is visible but has no action. | Implement Firebase password-reset email and success/error states. |
| P2 | Google sign-in | Google buttons are intentionally disabled and labeled `Coming soon`. | Configure OAuth for each platform and decide how UIC eligibility/profile completion works. |
| P2 | Profile/settings | Editing the profile is absent. The settings gear and Privacy row do nothing. The Notifications toggle changes only local component state. | Add profile editing, privacy destination, persisted notification preference, push-token registration, and notification delivery. |
| P2 | Event detail polish | Check-in opens a generic scanner without an event ID. `UIC Campus` is hardcoded below every location. Old attendee/avatar styles remain unused. | Connect event-aware check-in, use real location metadata, and either implement or remove attendee UI. |
| P2 | Check-in code quality | The screen has duplicate imports, an unused theme value, and a camera-permission effect with missing dependencies. | Resolve all 6 current lint warnings before extending the scanner. |
| P2 | Backend presentation | The root backend route still returns `Testing`; the background server interval is 15 minutes while GitHub Actions runs every 30 minutes. | Remove or replace the placeholder route and document/standardize the intended execution mode and cadence. |

## Maintenance and dependency follow-up

- Expo reported patch updates available for Expo, Expo Constants, Expo Font,
  Expo Linking, Expo Router, and Expo Web Browser. Apply compatible Expo-managed
  updates and rerun the full verification suite.
- The latest dependency audit during this milestone reported 6 moderate issues
  in the root package and 29 frontend issues (1 low, 11 moderate, 15 high, 2
  critical). Triage the dependency paths and upgrade deliberately; do not use a
  force audit fix without reviewing Expo/React Native compatibility.
- `useUpcomingEvents` currently downloads the whole event collection and
  filters/sorts on the device because legacy date fields are display strings.
  Query the `startAt` timestamp if event volume grows substantially.
- Add component tests for auth forms, AuthGate navigation tests, Firebase
  emulator integration tests, and at least one end-to-end happy path.

## Recommended delivery order

1. Enable/verify the Calendar API and complete the outstanding manual acceptance
   checklist.
2. Add and test Firebase security rules, including the missing-profile failure
   path, before exposing the app more broadly.
3. Fix missing native assets and produce release builds.
4. Build event-aware QR check-in, attendance, idempotency, and points; then
   replace the mock profile statistics.
5. Implement RSVP and announcements.
6. Finish password reset, profile/settings, notifications, privacy, and Google
   sign-in.
7. Clear lint warnings, update Expo-compatible dependencies, and expand
   integration/end-to-end coverage.

## Configuration handoff

Local secret files are intentionally ignored by Git:

- `frontend/.env`: six `EXPO_PUBLIC_FIREBASE_*` values.
- Root `.env`: `GOOGLE_CALENDAR_ID` and
  `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`.
- `serviceAccountKey.json`: Firebase Admin service-account key; never commit it.

The GitHub Actions calendar sync also requires the repository secret
`GOOGLE_SERVICE_ACCOUNT_JSON`. Firebase web configuration is public by design;
authorization must come from deployed Firebase security rules, not from hiding
the `EXPO_PUBLIC_*` values.
