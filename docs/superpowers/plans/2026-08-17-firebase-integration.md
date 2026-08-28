> **SUPERSEDED — 2026-08-27.** This document plans a Firebase-based integration
> (Firestore + Firebase Auth). The project has since moved to a free-tier
> deployment on Vercel + Render + Neon Postgres, which removes Firebase
> entirely. See `docs/superpowers/specs/2026-08-27-free-tier-deployment-design.md`.
>
> Kept for the record: its analysis of the `Event-DB` and `auth` branches, the
> merge-base reasoning, and the signup-wizard design all carried forward.

# Firebase Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Google Calendar → Firestore event pipeline and Firebase Authentication into `stu`, so the app runs on real data instead of hardcoded arrays.

**Architecture:** One Firebase initialization module (`frontend/lib/firebase.ts`) with two independent read layers over it — `lib/events.ts` for events, `contexts/AuthContext.tsx` for auth. `origin/Event-DB` merges cleanly and lands whole. `origin/auth` predates the design system, so its logic modules are copied and its screens are rewritten against `AuthLayout` rather than merged. MongoDB and JWT dependencies are removed.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native 0.81, React 19, TypeScript (strict), Firebase JS SDK `^12.17.1`, firebase-admin + googleapis (backend sync), Jest via `jest-expo` (frontend), `node:test` (backend).

**Spec:** `docs/superpowers/specs/2026-08-17-firebase-integration-design.md`

## Global Constraints

- Target branch is `stu`. Do not push to `main`, `dev`, or `stage`.
- `firebase` is pinned at `^12.17.1`. Do not downgrade to `auth`'s `^12.11.0`.
- Do **not** carry over `react-native-qrcode-svg` or `react-native-svg` from `origin/auth` — they exist only for the unbuilt organizer QR screen, which is out of scope.
- Do **not** create `frontend/firebaseConfig.ts`. The single Firebase entry point is `frontend/lib/firebase.ts`.
- The frontend is `strict: true`. No `any` in ported code — `origin/auth` uses `catch (error: any)` and that must be typed properly.
- All Expo env vars **must** be prefixed `EXPO_PUBLIC_`. Any other name is silently ignored and fails at the first Firestore call.
- After any `.env` change, restart with `npx expo start -c`. Values are inlined at build time.
- Profile statistics (`12` events / `240` points) stay hardcoded and must carry an explicit `TODO`. Never report them as working.
- Out of scope, do not implement: check-in recording, points accrual, real profile statistics, organizer QR generation, Google SSO.
- Attribution: the commit that ports `origin/auth` credits the original author and references commits `adb3a9f3` and `7841a657`. Do not delete `origin/auth`.

---

## Task 1: Merge Event-DB and establish live events

**Files:**
- Merge: `origin/Event-DB` into `stu`
- Create: `frontend/.env` (gitignored, not committed)
- Verify: `frontend/app/(tabs)/events.tsx`, `frontend/lib/events.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `frontend/lib/firebase.ts` exporting `app`, `db`, `storage`; `frontend/lib/events.ts` exporting `useUpcomingEvents()`, `useEvent(id)`, `accentForTag(tag)`, `formatMonth(d)`, `formatDay(d)`, `formatDateLong(d)`, `formatTimeRange(start, end)`, and type `ShpeEvent`; backend modules `backend/eventMapping.js` (`readDateTime`, `calendarOwnedFields`) and `backend/config/eventTags.js` (`tagForColorId`, `TAGS_BY_COLOR_ID`, `DEFAULT_TAG`)

**Note:** `stu` is one commit ahead of `main` (the spec commit), so this is an ordinary merge commit, not a fast-forward. Zero conflicts are still expected — `Event-DB` does not touch `docs/`.

- [ ] **Step 1: Confirm the working tree is clean**

```bash
git status --short
```

Expected: only `?? MASTER_PLAN.MD` and `?? docs/superpowers/plans/`. If anything else is modified, stop and resolve before merging.

- [ ] **Step 2: Merge Event-DB**

```bash
git merge origin/Event-DB -m "Merge origin/Event-DB: Google Calendar to Firestore event sync"
```

Expected: merge succeeds with no conflicts. If conflicts appear, stop and report — that contradicts the branch analysis and the plan needs revisiting.

- [ ] **Step 3: Install dependencies in both trees**

```bash
npm install
```

```bash
cd frontend && npm install
```

- [ ] **Step 4: Create the frontend environment file**

Copy `frontend/example.env` to `frontend/.env` and fill in real values from Firebase Console → Project settings → Your apps.

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

This file is gitignored. Do not commit it.

- [ ] **Step 5: Determine whether Firestore has event data**

Open Firebase Console → Firestore Database and look for an `events` collection.

- **Populated** → continue to Step 6 and verify live data.
- **Empty** → the scheduled sync only runs from the default branch, so it has not run for `stu`. Populate it by running the sync locally, which needs root `.env` (`GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`), `serviceAccountKey.json` from Firebase Console → Service accounts, the Google Calendar API enabled, and the calendar shared with the service account's `client_email`:

```bash
npm run sync:full
```

- **Neither available** → record this as a known gap. Step 6's check degrades to "the empty state renders without crashing," and live-data confirmation waits until merge to `main`. Do not claim events are verified working.

- [ ] **Step 6: Verify the app reads events**

```bash
cd frontend && npx expo start -c
```

Open the app, go to the Events tab. Expected: real events from Firestore, filter chips derived from their tags. Confirm the loading state appears first and no console errors mention `undefined` Firebase config — that symptom means an env var is misnamed or the cache is stale.

- [ ] **Step 7: Verify the backend now starts**

`main` declared `"type": "commonjs"` while `backend/server.js` uses ESM `import`, so it could not start. `Event-DB` sets `"type": "module"`, which fixes it.

```bash
npm run backend
```

Expected: `started the server on port 5000` with the port interpolated, not the literal `${PORT}`. Stop the server afterward.

- [ ] **Step 8: Commit**

The merge commit already exists from Step 2. Confirm nothing else needs committing:

```bash
git status --short
```

Expected: no modified tracked files. `.env` must not appear — if it does, it is not gitignored and that must be fixed before continuing.

---

## Task 2: Add backend test infrastructure and cover the sync's pure logic

**Files:**
- Create: `backend/eventTags.test.js`
- Create: `backend/eventMapping.test.js`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: `backend/config/eventTags.js` → `tagForColorId(colorId)`, `DEFAULT_TAG`; `backend/eventMapping.js` → `readDateTime(edge, timeZone, isAllDayEnd?)`, `calendarOwnedFields(ev, timeZone)`
- Produces: `npm test` at the repo root

**Why `node:test` and not Jest here:** the root package is `"type": "module"`, and running Jest against native ESM requires `--experimental-vm-modules`. Node 22's built-in test runner handles ESM natively with zero configuration and zero dependencies. The frontend uses Jest (Task 4) because `jest-expo` is the supported path there.

- [ ] **Step 1: Write the failing test for event tags**

Create `backend/eventTags.test.js`:

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_TAG, tagForColorId } from './config/eventTags.js';

describe('tagForColorId', () => {
  it('maps Blueberry (9) to GBM worth 3 points', () => {
    assert.deepEqual(tagForColorId(9), { tag: 'GBM', points: 3 });
  });

  it('maps Graphite (8) to Other worth 0 points', () => {
    assert.deepEqual(tagForColorId(8), { tag: 'Other', points: 0 });
  });

  it('maps both Volunteer colors identically', () => {
    assert.deepEqual(tagForColorId(2), tagForColorId(10));
  });

  it('falls back to the default tag when no color is set', () => {
    assert.deepEqual(tagForColorId(undefined), DEFAULT_TAG);
  });

  it('falls back to the default tag for an unknown color id', () => {
    assert.deepEqual(tagForColorId(99), DEFAULT_TAG);
  });
});
```

- [ ] **Step 2: Write the failing test for event mapping**

Create `backend/eventMapping.test.js`:

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarOwnedFields, readDateTime } from './eventMapping.js';

describe('readDateTime', () => {
  it('treats an all-day date as a local calendar day, not a UTC instant', () => {
    const result = readDateTime({ date: '2026-01-01' }, 'America/Chicago');
    assert.equal(result.date, '01/01/2026');
    assert.equal(result.time, 'All Day');
  });

  it('steps back a day for an exclusive all-day end date', () => {
    const result = readDateTime({ date: '2026-01-02' }, 'America/Chicago', true);
    assert.equal(result.date, '01/01/2026');
  });

  it('formats a timed event in the calendar timezone', () => {
    const result = readDateTime({ dateTime: '2026-01-15T18:00:00-06:00' }, 'America/Chicago');
    assert.equal(result.date, '01/15/2026');
    assert.equal(result.time, '6:00 PM');
  });

  it('prefers the edge timezone over the calendar default', () => {
    const result = readDateTime(
      { dateTime: '2026-01-15T18:00:00-06:00', timeZone: 'UTC' },
      'America/Chicago',
    );
    assert.equal(result.time, '12:00 AM');
  });
});

describe('calendarOwnedFields', () => {
  it('marks an all-day event and blanks its time range', () => {
    const fields = calendarOwnedFields(
      {
        id: 'abc',
        summary: '  Study Night  ',
        start: { date: '2026-02-12' },
        end: { date: '2026-02-13' },
      },
      'America/Chicago',
    );

    assert.equal(fields.allDay, true);
    assert.equal(fields.startsAt, 'All Day');
    assert.equal(fields.endsAt, 'All Day');
    assert.equal(fields.name, 'Study Night');
    assert.equal(fields.date, '02/12/2026');
    assert.equal(fields.googleCalendarEventId, 'abc');
  });

  it('defaults a missing summary and blanks missing text fields', () => {
    const fields = calendarOwnedFields(
      {
        id: 'xyz',
        start: { dateTime: '2026-01-15T18:00:00-06:00' },
        end: { dateTime: '2026-01-15T19:00:00-06:00' },
      },
      'America/Chicago',
    );

    assert.equal(fields.name, 'Untitled event');
    assert.equal(fields.description, '');
    assert.equal(fields.location, '');
    assert.equal(fields.allDay, false);
    assert.equal(fields.startsAt, '6:00 PM');
    assert.equal(fields.endsAt, '7:00 PM');
  });

  it('does not return points, so an officer override survives a sync', () => {
    const fields = calendarOwnedFields(
      {
        id: 'abc',
        summary: 'General Meeting',
        start: { dateTime: '2026-01-15T18:00:00-06:00' },
        end: { dateTime: '2026-01-15T19:00:00-06:00' },
      },
      'America/Chicago',
    );

    assert.equal('points' in fields, false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
node --test backend/
```

Expected: FAIL — no `test` script exists yet, but `node --test` runs directly. If the tests instead **pass** on the first run, that is correct and expected: these are characterization tests over code that already landed in Task 1. Confirm they exercise the real modules by temporarily breaking one assertion, re-running to see it fail, then restoring it.

- [ ] **Step 4: Add the test script**

In root `package.json`, add to `scripts`:

```json
"test": "node --test backend/"
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS, 12 tests across 2 files (5 in `eventTags.test.js`, 7 in `eventMapping.test.js`).

- [ ] **Step 6: Commit**

```bash
git add backend/eventTags.test.js backend/eventMapping.test.js package.json
git commit -m "test: cover calendar sync tag mapping and event field translation"
```

---

## Task 3: Unify Firebase initialization

**Files:**
- Modify: `frontend/lib/firebase.ts`

**Interfaces:**
- Consumes: `frontend/lib/firebase.ts` from Task 1 (exports `app`, `db`, `storage`)
- Produces: `frontend/lib/firebase.ts` additionally exporting `auth: Auth`, consumed by `contexts/AuthContext.tsx` in Task 4

- [ ] **Step 1: Add the auth export**

Replace the contents of `frontend/lib/firebase.ts`:

```typescript
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Fast Refresh re-executes this module, so guard against re-initializing.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

- [ ] **Step 2: Add the typecheck script**

In `frontend/package.json`, add to `scripts`:

```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd frontend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Verify events still load**

```bash
cd frontend && npx expo start -c
```

Expected: the Events tab still shows Firestore data. Adding the auth export must not disturb the existing Firestore reads.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/firebase.ts frontend/package.json
git commit -m "feat: expose Firebase auth from the shared init module"
```

---

## Task 4: Port auth logic modules with frontend test infrastructure

**Files:**
- Create: `frontend/types/user.ts`
- Create: `frontend/utils/validation.ts`
- Create: `frontend/utils/authErrors.ts`
- Create: `frontend/contexts/AuthContext.tsx`
- Create: `frontend/components/SegmentedControl.tsx`
- Create: `frontend/utils/__tests__/validation.test.ts`
- Create: `frontend/utils/__tests__/authErrors.test.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `frontend/lib/firebase.ts` → `auth`, `db` (Task 3); `frontend/constants/theme.ts` → `colors`, `radius`
- Produces:
  - `types/user.ts` → `SEX_AT_BIRTH_OPTIONS`, `SCHOOL_LEVEL_OPTIONS`, types `SexAtBirth`, `SchoolLevel`, `UserProfileInput`, `UserProfile`
  - `utils/validation.ts` → `isUicEmail(email: string): boolean`, `UIC_EMAIL_DOMAIN`
  - `utils/authErrors.ts` → `authErrorCode(error: unknown): string | undefined`, `loginErrorMessage(error: unknown): string`, `registerErrorMessage(error: unknown): string`
  - `contexts/AuthContext.tsx` → `AuthProvider`, `useAuth()` returning `{ user, profile, loading, profileLoading, login, register, logout }`
  - `components/SegmentedControl.tsx` → `SegmentedControl<T extends string>({ options, value, onChange })`

`authErrors.ts` is new. `origin/auth` duplicated the same error-code chain inline in both `index.tsx` and `register.tsx`; extracting it keeps the two screens DRY and lets the mapping be unit tested.

- [ ] **Step 1: Install frontend test dependencies**

```bash
cd frontend && npm install --save-dev jest jest-expo @types/jest
```

- [ ] **Step 2: Configure Jest**

In `frontend/package.json`, add to `scripts`:

```json
"test": "jest"
```

And add a top-level `jest` key:

```json
"jest": {
  "preset": "jest-expo"
}
```

- [ ] **Step 3: Write the failing test for email validation**

Create `frontend/utils/__tests__/validation.test.ts`:

```typescript
import { isUicEmail } from '../validation';

describe('isUicEmail', () => {
  it('accepts a uic.edu address', () => {
    expect(isUicEmail('student@uic.edu')).toBe(true);
  });

  it('accepts regardless of case', () => {
    expect(isUicEmail('Student@UIC.EDU')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isUicEmail('  student@uic.edu  ')).toBe(true);
  });

  it('rejects a lookalike suffix', () => {
    expect(isUicEmail('student@uic.edu.evil.com')).toBe(false);
  });

  it('rejects a lookalike prefix', () => {
    expect(isUicEmail('student@fake-uic.edu')).toBe(false);
  });

  it('rejects a non-uic address', () => {
    expect(isUicEmail('student@gmail.com')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isUicEmail('')).toBe(false);
  });

  it('rejects an address with no local part', () => {
    expect(isUicEmail('@uic.edu')).toBe(false);
  });
});
```

- [ ] **Step 4: Write the failing test for auth error messages**

Create `frontend/utils/__tests__/authErrors.test.ts`:

```typescript
import { authErrorCode, loginErrorMessage, registerErrorMessage } from '../authErrors';

const FALLBACK = 'An unexpected error occurred. Please try again.';

describe('authErrorCode', () => {
  it('extracts a string code from a Firebase error', () => {
    expect(authErrorCode({ code: 'auth/user-not-found' })).toBe('auth/user-not-found');
  });

  it('returns undefined for a plain Error', () => {
    expect(authErrorCode(new Error('boom'))).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(authErrorCode(null)).toBeUndefined();
  });

  it('returns undefined when code is not a string', () => {
    expect(authErrorCode({ code: 42 })).toBeUndefined();
  });
});

describe('loginErrorMessage', () => {
  it('maps invalid-credential to a password hint', () => {
    expect(loginErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      'Incorrect password. Please try again.',
    );
  });

  it('maps user-not-found to a missing-account message', () => {
    expect(loginErrorMessage({ code: 'auth/user-not-found' })).toBe(
      'No account found with this email.',
    );
  });

  it('maps too-many-requests to a rate-limit message', () => {
    expect(loginErrorMessage({ code: 'auth/too-many-requests' })).toBe(
      'Too many failed attempts. Please try again later.',
    );
  });

  it('falls back for an unrecognized code', () => {
    expect(loginErrorMessage({ code: 'auth/network-request-failed' })).toBe(FALLBACK);
  });
});

describe('registerErrorMessage', () => {
  it('maps email-already-in-use', () => {
    expect(registerErrorMessage({ code: 'auth/email-already-in-use' })).toBe(
      'An account with this email already exists.',
    );
  });

  it('maps weak-password', () => {
    expect(registerErrorMessage({ code: 'auth/weak-password' })).toBe(
      'Password is too weak. Use at least 6 characters.',
    );
  });

  it('falls back for an unrecognized code', () => {
    expect(registerErrorMessage({ code: 'auth/internal-error' })).toBe(FALLBACK);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

```bash
cd frontend && npm test
```

Expected: FAIL — `Cannot find module '../validation'` and `Cannot find module '../authErrors'`.

- [ ] **Step 6: Create the validation module**

Create `frontend/utils/validation.ts` (verbatim from `origin/auth`):

```typescript
export const UIC_EMAIL_DOMAIN = 'uic.edu';

export const isUicEmail = (email: string): boolean =>
  /^[^\s@]+@uic\.edu$/i.test(email.trim());
```

- [ ] **Step 7: Create the auth error module**

Create `frontend/utils/authErrors.ts`:

```typescript
// Firebase surfaces failures as an error object carrying a `code` string.
// Both auth screens map those to human copy, so the mapping lives here.

const FALLBACK = 'An unexpected error occurred. Please try again.';

const LOGIN_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Incorrect password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
};

const REGISTER_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
};

export function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
}

export function loginErrorMessage(error: unknown): string {
  return LOGIN_MESSAGES[authErrorCode(error) ?? ''] ?? FALLBACK;
}

export function registerErrorMessage(error: unknown): string {
  return REGISTER_MESSAGES[authErrorCode(error) ?? ''] ?? FALLBACK;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
cd frontend && npm test
```

Expected: PASS, 19 tests.

- [ ] **Step 9: Create the user types**

Create `frontend/types/user.ts` (verbatim from `origin/auth`):

```typescript
import type { FieldValue, Timestamp } from 'firebase/firestore';

export const SEX_AT_BIRTH_OPTIONS = ['Male', 'Female'] as const;
export type SexAtBirth = (typeof SEX_AT_BIRTH_OPTIONS)[number];

export const SCHOOL_LEVEL_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
] as const;
export type SchoolLevel = (typeof SCHOOL_LEVEL_OPTIONS)[number];

export interface UserProfileInput {
  name: string;
  age: number;
  sexAtBirth: SexAtBirth;
  gender: string;
  schoolLevel: SchoolLevel;
  memberId: string;
}

export interface UserProfile extends UserProfileInput {
  email: string;
  isAdmin: boolean;
  createdAt: Timestamp | FieldValue;
}
```

- [ ] **Step 10: Create the auth context**

Create `frontend/contexts/AuthContext.tsx`. This is `origin/auth`'s file with one change: the import path is `../lib/firebase`, not `../firebaseConfig`.

```typescript
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import type { UserProfile, UserProfileInput } from '../types/user';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    profile: UserProfileInput,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setProfileLoading(false);
      },
      (error) => {
        console.error('Error subscribing to profile:', error);
        setProfileLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const register = async (
    email: string,
    password: string,
    profileInput: UserProfileInput,
  ) => {
    const trimmedEmail = email.trim();
    const credential = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      password,
    );
    await setDoc(doc(db, 'users', credential.user.uid), {
      ...profileInput,
      email: trimmedEmail,
      isAdmin: false,
      createdAt: serverTimestamp(),
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, profileLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 11: Create the restyled segmented control**

Create `frontend/components/SegmentedControl.tsx`. The logic is `origin/auth`'s; the styling is replaced — its original palette (`#3a3f47`, `#D50032`, `#ccc`) belongs to the pre-redesign UI. The outer `marginBottom` is dropped because `AuthFieldGroup` supplies spacing.

```typescript
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/theme';

interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.pill, selected && styles.pillSelected]}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pillSelected: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.surface,
  },
});
```

- [ ] **Step 12: Verify typecheck and tests pass**

```bash
cd frontend && npm run typecheck && npm test
```

Expected: no type errors, 19 tests pass.

- [ ] **Step 13: Commit**

```bash
git add frontend/types frontend/utils frontend/contexts frontend/components/SegmentedControl.tsx frontend/package.json frontend/package-lock.json
git commit -m "$(cat <<'EOF'
feat: port Firebase auth logic modules onto the current design system

AuthContext, the user profile types, and UIC email validation are taken
from origin/auth unchanged apart from the Firebase import path.
SegmentedControl is restyled to constants/theme — its original palette
predates the app redesign.

Adds utils/authErrors.ts, which extracts the Firebase error-code mapping
that origin/auth duplicated inline across both auth screens.

Ported from origin/auth (adb3a9f3, 7841a657). That branch forked before
the design system landed, so its screens are rewritten rather than merged
and its commits do not appear as ancestors here.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Extend AuthLayout for the wizard and the disabled Google button

**Files:**
- Modify: `frontend/components/AuthLayout.tsx`

**Interfaces:**
- Consumes: `frontend/constants/theme.ts` → `colors`
- Produces:
  - `AuthFieldGroup({ label, children })` — labeled wrapper for non-`TextInput` fields, used by Task 7
  - `GoogleButton({ onPress?, disabled?, note? })` — extended signature, used by Tasks 6 and 7

`AuthField` is typed `{ label: string } & TextInputProps` and always renders a `TextInput`, so it cannot wrap a `SegmentedControl`. `AuthFieldGroup` reuses the same `field` and `fieldLabel` styles so the two read identically.

- [ ] **Step 1: Add AuthFieldGroup**

In `frontend/components/AuthLayout.tsx`, insert immediately after the `AuthField` function (currently ending at line 82):

```typescript
/** Same label treatment as AuthField, for fields that aren't a TextInput. */
export function AuthFieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Replace GoogleButton**

Replace the existing `GoogleButton` function (currently lines 122-131) with:

```typescript
export function GoogleButton({
  onPress,
  disabled,
  note,
}: {
  onPress?: () => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <View style={styles.googleWrap}>
      <TouchableOpacity
        style={[styles.googleButton, disabled && styles.googleButtonDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
      >
        <View style={[styles.googleBadge, disabled && styles.googleBadgeDisabled]}>
          <Text style={styles.googleBadgeText}>G</Text>
        </View>
        <Text style={[styles.googleText, disabled && styles.googleTextDisabled]}>
          Continue with Google
        </Text>
      </TouchableOpacity>
      {note ? <Text style={styles.googleNote}>{note}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 3: Add the supporting styles**

In the `StyleSheet.create` block, add these keys next to the existing `googleButton` entry:

```typescript
  googleWrap: {
    gap: 8,
  },
  googleButtonDisabled: {
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  googleBadgeDisabled: {
    backgroundColor: colors.textFaint,
  },
  googleTextDisabled: {
    color: colors.textFaint,
  },
  googleNote: {
    fontSize: 11.5,
    color: colors.textFaint,
    textAlign: 'center',
  },
```

- [ ] **Step 4: Verify typecheck passes**

```bash
cd frontend && npm run typecheck
```

Expected: no errors. Existing `GoogleButton` call sites pass no props, which remains valid — every new prop is optional.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/AuthLayout.tsx
git commit -m "feat: add AuthFieldGroup and a disabled state for GoogleButton"
```

---

## Task 6: Rewrite the login screen against real auth

**Files:**
- Modify: `frontend/app/index.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useAuth()` → `login` (Task 4); `isUicEmail` (Task 4); `loginErrorMessage` (Task 4); `GoogleButton` with `disabled`/`note` (Task 5)
- Produces: nothing consumed by later tasks

Navigation after a successful sign-in is **not** done here. Task 8's `AuthGate` reacts to the auth state change and redirects. Calling `router.replace` here as well would race it.

- [ ] **Step 1: Rewrite the screen**

Replace the entire contents of `frontend/app/index.tsx`:

```typescript
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import AuthLayout, {
  AuthDivider,
  AuthField,
  AuthFooter,
  AuthSubmit,
  GoogleButton,
} from '../components/AuthLayout';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { loginErrorMessage } from '../utils/authErrors';
import { isUicEmail } from '../utils/validation';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isUicEmail(email)) {
      Alert.alert('Error', 'Please use your @uic.edu email to sign in.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      // AuthGate redirects once the auth state changes — don't navigate here.
    } catch (error) {
      Alert.alert('Login Failed', loginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={'Welcome\nBack'}>
      <AuthField
        label="Email"
        placeholder="you@uic.edu"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <AuthField
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.forgotWrap}>
        <Text style={styles.forgot}>Forgot Password?</Text>
      </TouchableOpacity>

      <AuthSubmit label="Sign in" onPress={handleLogin} loading={isLoading} />

      <AuthDivider />
      <GoogleButton disabled note="Coming soon" />

      <AuthFooter
        prompt="Don't have an account?"
        action="Sign up"
        onPress={() => router.push('/signup')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgotWrap: {
    alignSelf: 'flex-end',
  },
  forgot: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
  },
});
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd frontend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "feat: sign in against Firebase Auth instead of hardcoded credentials"
```

Note: the screen cannot be exercised end-to-end until Task 8 wires `AuthProvider`. `useAuth()` throws outside a provider by design. Manual verification happens in Task 8.

---

## Task 7: Build the two-step signup wizard

**Files:**
- Modify: `frontend/app/signup.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useAuth()` → `register` (Task 4); `SEX_AT_BIRTH_OPTIONS`, `SCHOOL_LEVEL_OPTIONS`, `SexAtBirth`, `SchoolLevel` (Task 4); `isUicEmail` (Task 4); `authErrorCode`, `registerErrorMessage` (Task 4); `SegmentedControl` (Task 4); `AuthFieldGroup`, `GoogleButton` (Task 5)
- Produces: nothing consumed by later tasks

**Critical:** `register()` is called exactly once, at the end of step 2. Calling `createUserWithEmailAndPassword` at step 1 would leave an orphaned auth account with no `users/{uid}` document if the user abandoned step 2, which `AuthContext` would then load as `profile: null` with no in-app recovery path.

- [ ] **Step 1: Rewrite the screen**

Replace the entire contents of `frontend/app/signup.tsx`:

```typescript
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import AuthLayout, {
  AuthDivider,
  AuthField,
  AuthFieldGroup,
  AuthFooter,
  AuthSubmit,
  GoogleButton,
} from '../components/AuthLayout';
import { SegmentedControl } from '../components/SegmentedControl';
import { useAuth } from '../contexts/AuthContext';
import {
  SCHOOL_LEVEL_OPTIONS,
  SEX_AT_BIRTH_OPTIONS,
  type SchoolLevel,
  type SexAtBirth,
} from '../types/user';
import { authErrorCode, registerErrorMessage } from '../utils/authErrors';
import { isUicEmail } from '../utils/validation';

export default function SignUpScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 — account
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 — profile
  const [age, setAge] = useState('');
  const [sexAtBirth, setSexAtBirth] = useState<SexAtBirth | undefined>();
  const [gender, setGender] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | undefined>();
  const [memberId, setMemberId] = useState('');

  const handleContinue = () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (!isUicEmail(email)) {
      Alert.alert('Error', 'Registration is restricted to @uic.edu emails.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setStep(2);
  };

  const handleRegister = async () => {
    if (!age || !sexAtBirth || !gender || !schoolLevel || !memberId) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const ageNum = Number.parseInt(age, 10);
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      Alert.alert('Error', 'Please enter a valid age.');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, {
        name: name.trim(),
        age: ageNum,
        sexAtBirth,
        gender: gender.trim(),
        schoolLevel,
        memberId: memberId.trim(),
      });
      // AuthGate redirects once the auth state changes — don't navigate here.
    } catch (error) {
      // The account is only created here, at the end, so a duplicate email
      // can't surface on step 1 where it was typed. Send the user back with
      // their input intact rather than making them start over.
      if (authErrorCode(error) === 'auth/email-already-in-use') {
        setStep(1);
      }
      Alert.alert('Registration Failed', registerErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 2) {
    return (
      <AuthLayout title={'Your\nProfile'} onBack={() => setStep(1)}>
        <AuthField
          label="Age"
          placeholder="20"
          value={age}
          onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
        />

        <AuthFieldGroup label="Sex assigned at birth">
          <SegmentedControl
            options={SEX_AT_BIRTH_OPTIONS}
            value={sexAtBirth}
            onChange={setSexAtBirth}
          />
        </AuthFieldGroup>

        <AuthField
          label="Gender"
          placeholder="How you identify"
          value={gender}
          onChangeText={setGender}
        />

        <AuthFieldGroup label="School level">
          <SegmentedControl
            options={SCHOOL_LEVEL_OPTIONS}
            value={schoolLevel}
            onChange={setSchoolLevel}
          />
        </AuthFieldGroup>

        <AuthField
          label="Member ID"
          placeholder="SHPE member number"
          value={memberId}
          onChangeText={setMemberId}
          autoCapitalize="characters"
        />

        <AuthSubmit
          label="Create account"
          onPress={handleRegister}
          loading={isLoading}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={'Create\nAccount'} onBack={() => router.back()}>
      <AuthField
        label="Name"
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <AuthField
        label="Email"
        placeholder="you@uic.edu"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <AuthField
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <AuthField
        label="Confirm Password"
        placeholder="••••••••"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <AuthSubmit label="Continue" onPress={handleContinue} />

      <AuthDivider />
      <GoogleButton disabled note="Coming soon" />

      <AuthFooter
        prompt="Already have an account?"
        action="Sign in"
        onPress={() => router.back()}
      />
    </AuthLayout>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd frontend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/signup.tsx
git commit -m "feat: add two-step signup collecting the full member profile"
```

---

## Task 8: Wire the auth provider and route guard

**Files:**
- Modify: `frontend/app/_layout.tsx` (full rewrite)

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth()` → `user`, `loading` (Task 4); `colors` from `constants/theme`
- Produces: the auth-gated navigation shell; makes Tasks 6 and 7 runnable

`origin/auth`'s version is corrected in three ways: it registered `edit-profile` and `organizer/qr/[eventId]`, neither of which exists on any branch; it dropped the `SafeAreaProvider` that `main` has; and it used a stray `#D50032` for the spinner.

- [ ] **Step 1: Rewrite the root layout**

Replace the entire contents of `frontend/app/_layout.tsx`:

```typescript
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Routes reachable while signed out. Everything else bounces to the login screen.
const AUTH_SEGMENTS = new Set(['', 'signup']);

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isAuthScreen = AUTH_SEGMENTS.has(segments[0] ?? '');

    if (!user && !isAuthScreen) {
      router.replace('/');
    } else if (user && isAuthScreen) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd frontend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Enable Email/Password auth in Firebase**

In Firebase Console → Authentication → Sign-in method, confirm **Email/Password** is enabled. Registration fails with `auth/operation-not-allowed` if it is not.

- [ ] **Step 4: Register a real account end-to-end**

```bash
cd frontend && npx expo start -c
```

Walk the full flow and confirm each:
- Step 1 rejects a non-UIC email
- Step 1 rejects mismatched passwords
- Step 1 rejects a password under 6 characters
- Continue advances to step 2; the back arrow returns to step 1 **with step 1's values still filled in**
- Step 2 rejects an age outside 13–120
- Create account succeeds and lands on the Home tab without manual navigation

Then in Firebase Console → Firestore → `users/{uid}`, confirm the document has all six profile fields plus `email`, `isAdmin: false`, and `createdAt`.

- [ ] **Step 5: Verify the duplicate-email path**

Register again with the same email. Expected: the alert reads "An account with this email already exists." and the wizard returns to **step 1** with the entered values intact.

- [ ] **Step 6: Verify the route guard**

- Signed in, force-navigate to `/` — expected: bounced to Home.
- Sign out is not wired until Task 9. To test the signed-out guard now, delete the app's stored session by reloading with `r` in the Expo CLI after removing the user in Firebase Console, then attempt `/(tabs)/home` — expected: bounced to the login screen.

- [ ] **Step 7: Verify session persistence**

**This check is the one most likely to fail.** `getAuth()` may not persist sessions on React Native, because the web SDK's default persistence is `localStorage`, which does not exist on device.

Force-quit the app completely (not a reload) and reopen it.

- **Still signed in** → persistence works. Continue to Step 8.
- **Back at the login screen** → persistence is broken. Fix it:

```bash
cd frontend && npx expo install @react-native-async-storage/async-storage
```

Then in `frontend/lib/firebase.ts`, replace the `auth` export:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

// Replaces `export const auth = getAuth(app);`
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```

Re-run the force-quit check before continuing. Report which branch of this step was taken.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/_layout.tsx frontend/lib/firebase.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: gate navigation behind Firebase auth state"
```

---

## Task 9: Wire real identity into home and profile

**Files:**
- Modify: `frontend/app/(tabs)/profile.tsx:15-50`
- Modify: `frontend/app/(tabs)/home.tsx:46-58`

**Interfaces:**
- Consumes: `useAuth()` → `profile`, `logout` (Task 4)
- Produces: nothing consumed by later tasks

Statistics stay hardcoded per the spec and must carry a visible `TODO`.

- [ ] **Step 1: Import auth into the profile screen**

In `frontend/app/(tabs)/profile.tsx`, add to the imports:

```typescript
import { useAuth } from '../../contexts/AuthContext';
```

- [ ] **Step 2: Read the profile and expose logout**

Replace the component's opening lines:

```typescript
const ProfileScreen = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
```

with:

```typescript
const ProfileScreen = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { profile, logout } = useAuth();
```

- [ ] **Step 3: Replace the hardcoded identity**

Replace these three lines in the profile card:

```typescript
          <Text style={styles.userName}>User's Name</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>Member</Text>
          </View>
          <Text style={styles.userEmail}>user45@uic.edu</Text>
```

with:

```typescript
          <Text style={styles.userName}>{profile?.name ?? 'Member'}</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>
              {profile?.isAdmin ? 'Officer' : 'Member'}
            </Text>
          </View>
          <Text style={styles.userEmail}>{profile?.email ?? ''}</Text>
```

- [ ] **Step 4: Mark the statistics as unimplemented**

Immediately above the `{/* Stats Row */}` comment, add:

```typescript
        {/* TODO: these numbers are placeholders. Real attendance and points
            require the check-in subsystem, which is not built yet. */}
```

- [ ] **Step 5: Wire sign out**

Replace the sign-out row's opening tag:

```typescript
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={19} color={colors.orangeDark} />
```

with:

```typescript
          <TouchableOpacity style={styles.settingRow} onPress={logout}>
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={19} color={colors.orangeDark} />
```

- [ ] **Step 6: Greet the real member on the home screen**

In `frontend/app/(tabs)/home.tsx`, add to the imports:

```typescript
import { useAuth } from '../../contexts/AuthContext';
```

Replace:

```typescript
export default function Index() {
  const router = useRouter();
```

with:

```typescript
export default function Index() {
  const router = useRouter();
  const { profile } = useAuth();
  const firstName = profile?.name?.trim().split(' ')[0];
```

And replace the header's subtitle prop:

```typescript
        subtitle="Welcome back, User!"
```

with:

```typescript
        subtitle={`Welcome back, ${firstName ?? 'Member'}!`}
```

- [ ] **Step 7: Verify typecheck passes**

```bash
cd frontend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Verify in the app**

```bash
cd frontend && npx expo start -c
```

Confirm:
- Home greets you by your real first name
- Profile shows your real name and email, with the role chip reading "Member"
- Profile statistics still read `12` and `240` — expected
- Sign Out returns to the login screen
- Signing back in returns to Home

- [ ] **Step 9: Commit**

```bash
git add frontend/app/\(tabs\)/profile.tsx frontend/app/\(tabs\)/home.tsx
git commit -m "feat: show the signed-in member on home and profile, wire sign out"
```

---

## Task 10: Remove MongoDB and JWT dependencies, run final verification

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: everything from Tasks 1-9
- Produces: the completed milestone

- [ ] **Step 1: Confirm the packages are genuinely unused**

```bash
grep -rn --include=*.js --include=*.ts --include=*.tsx -E "mongoose|bcryptjs|jsonwebtoken" backend frontend
```

Expected: no matches. If anything is found, stop and report — removing them would break code.

- [ ] **Step 2: Remove the dependencies**

In root `package.json`, delete these three lines from `dependencies`:

```json
    "bcryptjs": "^3.0.3",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.1.6",
```

Leaving `dotenv`, `express`, `firebase-admin`, and `googleapis`.

- [ ] **Step 3: Reinstall and verify the backend still runs**

```bash
npm install
```

```bash
npm run backend
```

Expected: `started the server on port 5000`. Stop the server afterward.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

```bash
cd frontend && npm test
```

Expected: 12 backend tests pass, 19 frontend tests pass.

- [ ] **Step 5: Run the full static check**

```bash
cd frontend && npm run typecheck && npx expo lint
```

Expected: no type errors, no lint errors.

- [ ] **Step 6: Walk the complete acceptance checklist**

```bash
cd frontend && npx expo start -c
```

**Authentication**
- [ ] Registering a `@uic.edu` account through both steps creates `users/{uid}` with all six profile fields, `isAdmin: false`, and `createdAt`
- [ ] A non-UIC email is rejected at step 1
- [ ] A duplicate email returns to step 1 with entered state intact
- [ ] Sign out returns to the login screen
- [ ] Signing in lands on Home
- [ ] Force-quitting and reopening preserves the session
- [ ] A signed-out deep link to `/(tabs)/home` redirects to login

**Events**
- [ ] The list renders live Firestore data
- [ ] Editing an event in Google Calendar and running `npm run sync` updates the app without a refresh
- [ ] An event detail deep link resolves
- [ ] Empty and error states render correctly

**Identity**
- [ ] Home greets the member by real name
- [ ] Profile shows real name, email, and role
- [ ] Profile statistics still show `12` / `240` with the TODO in place

Record any check that could not be run and why. Do not mark a box that was not actually exercised.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: drop unused MongoDB and JWT dependencies in favor of Firebase"
```

- [ ] **Step 8: Report status**

Summarize: which acceptance checks passed, which were blocked and why, whether session persistence needed the AsyncStorage fix, and whether Firestore had event data or needed a manual sync.

**Reminders for the handoff:**
- The repository secret `GOOGLE_SERVICE_ACCOUNT_JSON` must exist for the scheduled sync to run after merging to `main`. This is a GitHub settings change outside the codebase.
- The scheduled workflow only runs from the default branch, so calendar sync stays manual until this merges.
- `MASTER_PLAN.MD` at the repo root is still empty and untracked. Delete it or point it at the spec.
