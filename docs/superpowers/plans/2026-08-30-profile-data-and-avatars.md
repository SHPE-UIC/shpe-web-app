# Profile Data Update + Profile Pictures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Top 8's data-collection decisions (no age, a single Male/Female/Other gender field, "SHPE member ID" wording) and add member profile pictures shown everywhere a member appears.

**Architecture:** The demographic change is a straight contraction: two columns drop, free-text gender becomes an enum, labels change — one Drizzle migration, symmetric edits in `validation.ts`/`schema.ts`/`types.ts`/`signup.tsx`. Avatars use the GCS pattern that fits the new stack: a Terraform-provisioned public-read bucket, the API issues V4 signed PUT URLs (no file bytes ever transit Cloud Run), the row stores the object path, and a shared `<Avatar>` component renders image-or-initials everywhere.

**Tech Stack:** Drizzle migrations, Express 5, `@google-cloud/storage` (new backend dep), Terraform (`google_storage_bucket`), `expo-image-picker` (new frontend dep), existing `SegmentedControl` component.

**Spec:** Top 8 feedback relayed 2026-08-30, decisions confirmed by the maintainer:
1. Stop collecting **age** — and delete what was collected (columns drop; only test data exists).
2. One **Gender** field, options **Male / Female / Other**, replacing both "Sex at birth" and the free-text gender. Required at signup; existing rows may hold NULL.
3. The signup field currently labeled **"UIC member ID"** becomes **"SHPE member ID"** (it is the SHPE membership number, not the university UIN). Storage stays `users.member_id` — label/copy change only.
4. **Profile pictures**, shown *everywhere*: profile tab, admin member roster, attendance lists, and available to future features.

## Global Constraints

- The production DB (`shpe-webapp`, Cloud SQL) is live; migrations run via the `shpe-migrate` Cloud Run job on deploy. Dropping columns is sanctioned — Top 8 approved data deletion, and current rows are test accounts.
- `example.env` documents every new backend env var; `infra/` changes must leave `terraform plan` clean after apply.
- Existing suites must stay green: `npm run typecheck && npm test` (root), `cd frontend && npx tsc --noEmit && npm test`.
- Frontend test files never live under `frontend/app/` (Expo Router treats them as routes).
- All new copy uses "SHPE member ID"; nothing user-visible may say "UIN" or "UIC member ID".
- Avatar objects are public-read at unguessable paths (`users/<uid>/<uuid>.<ext>`); uploads capped at 5 MB, content types `image/jpeg`, `image/png`, `image/webp` only.

---

### Task 1: Backend — single Gender enum, drop age and sex-at-birth

**Files:**
- Modify: `backend/src/db/schema.ts` (users table + option exports)
- Modify: `backend/src/validation.ts` (parseRegistration)
- Modify: `backend/src/auth/user.ts` (PublicUser + toPublicUser)
- Modify: `backend/src/routes/auth.ts` (insert values)
- Modify: `backend/src/validation.test.ts`, `backend/src/routes/auth.test.ts`
- Create: `drizzle/0005_single_gender_field.sql` (via `npm run db:generate`, then hand-edit)

**Interfaces:**
- Produces: `GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const` and `type Gender` exported from `backend/src/db/schema.ts`; `users` table without `age`/`sexAtBirth`, with `gender: text('gender').$type<Gender>()`; `RegistrationInput` = `{ email, password, name, gender: Gender, schoolLevel, memberId }` (gender **required**); `PublicUser` without `age`/`sexAtBirth`.

- [x] **Step 1: Write the failing validation tests** — in `backend/src/validation.test.ts`, replace the age/sexAtBirth cases with:

```ts
it('requires a gender from the fixed set', () => {
  expect(() => parseRegistration({ ...VALID, gender: undefined })).toThrow('Select your gender');
  expect(() => parseRegistration({ ...VALID, gender: 'Nonbinary' })).toThrow('Select your gender');
});

it('accepts each allowed gender', () => {
  for (const gender of GENDER_OPTIONS) {
    expect(parseRegistration({ ...VALID, gender }).gender).toBe(gender);
  }
});

it('no longer accepts or returns age or sexAtBirth', () => {
  const parsed = parseRegistration({ ...VALID, age: 22, sexAtBirth: 'Male' });
  expect(parsed).not.toHaveProperty('age');
  expect(parsed).not.toHaveProperty('sexAtBirth');
});
```

Update the file's `VALID` fixture to `{ email: 'ann@uic.edu', password: 'longenough', name: 'Ann', gender: 'Female', schoolLevel: 'Junior', memberId: 'SHPE-12345' }`.

- [x] **Step 2: Run to verify failure** — `npx vitest run backend/src/validation.test.ts` — expect FAIL (`GENDER_OPTIONS` not exported, gender not validated).

- [x] **Step 3: Implement** — in `backend/src/db/schema.ts`: delete `SEX_AT_BIRTH_OPTIONS`/`SexAtBirth`, add:

```ts
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];
```

In the `users` table delete the `age` and `sexAtBirth` columns and change gender to `gender: text('gender').$type<Gender>(),`. In `backend/src/validation.ts`: drop the `rawAge` block and `sexAtBirth` line; add after the password check:

```ts
const gender = oneOf(input.gender, GENDER_OPTIONS);
if (!gender) throw badRequest('Select your gender', 'gender_required');
```

and return `{ email, password, name, gender, schoolLevel, memberId }`. In `backend/src/auth/user.ts` delete `age`/`sexAtBirth` from the type and builder. In `backend/src/routes/auth.ts` delete `age: input.age, sexAtBirth: input.sexAtBirth,` from `.values({...})`. Fix `backend/src/routes/auth.test.ts`'s `PAYLOAD` and `insertedRow` (add `gender: 'Female'`, remove `age`/`sexAtBirth`).

- [x] **Step 4: Verify green** — `npm run typecheck && npm test` — expect PASS, all suites.

- [x] **Step 5: Generate the migration** — `DATABASE_URL=postgresql://x:y@localhost:5432/gen npm run db:generate`, rename the file to `drizzle/0005_single_gender_field.sql`, update the `tag` in `drizzle/meta/_journal.json` to match, then prepend the data fix so the drop and the enum-tightening land together:

```sql
UPDATE "users" SET "gender" = NULL WHERE "gender" NOT IN ('Male','Female','Other');--> statement-breakpoint
```

(the generated `ALTER TABLE "users" DROP COLUMN "age";` and `DROP COLUMN "sex_at_birth";` lines follow).

- [x] **Step 6: Prove the migration applies** — against a scratch DB: `docker run -d --name mig-check -e POSTGRES_PASSWORD=x -p 55433:5432 postgres:17-alpine`, then `DATABASE_URL=postgresql://postgres:x@localhost:55433/postgres CHECKIN_TOKEN_SECRET=s npm run db:migrate` — expect all 6 migrations to apply cleanly. `docker rm -f mig-check`.

- [x] **Step 7: Commit** — `git add -A && git commit -m "Collect a single gender field and stop collecting age"`.

### Task 2: Frontend — signup rework and SHPE member ID label

**Files:**
- Modify: `frontend/lib/api/types.ts`, `frontend/app/signup.tsx`
- Modify: `frontend/lib/validation.ts` (only if it mirrors age/sex rules — check first)
- Test: `frontend/__tests__/signup.test.tsx` (create)

**Interfaces:**
- Consumes: the Task 1 API shape — registration body `{ email, password, name, gender, schoolLevel, memberId }`.
- Produces: `GENDER_OPTIONS`/`Gender` exported from `frontend/lib/api/types.ts` (same values as backend); `PublicUser` without `age`/`sexAtBirth`.

- [x] **Step 1: Write the failing screen test** — `frontend/__tests__/signup.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import SignUpScreen from '../app/signup';
import { AuthProvider } from '../contexts/AuthContext';

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn().mockRejectedValue(new Error('no session')),
}));

const renderSignup = () =>
  render(
    <AuthProvider>
      <SignUpScreen />
    </AuthProvider>,
  );

async function goToStepTwo() {
  fireEvent.changeText(screen.getByPlaceholderText('Full name'), 'Ann');
  fireEvent.changeText(screen.getByPlaceholderText('you@uic.edu'), 'ann@uic.edu');
  fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'longenough');
  fireEvent.changeText(screen.getByPlaceholderText('Re-enter your password'), 'longenough');
  fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(screen.getByText('Step 2 of 2 - Profile')).toBeTruthy());
}

describe('signup step 2', () => {
  it('collects gender and SHPE member ID, and never mentions age, sex at birth, or UIN', async () => {
    renderSignup();
    await goToStepTwo();

    expect(screen.getByText('Gender')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.getByText('SHPE member ID')).toBeTruthy();

    expect(screen.queryByText('Age')).toBeNull();
    expect(screen.queryByText('Sex at birth')).toBeNull();
    expect(screen.queryByText(/UIC member/i)).toBeNull();
    expect(screen.queryByText(/UIN/)).toBeNull();
  });

  it('refuses to submit without a gender', async () => {
    renderSignup();
    await goToStepTwo();

    fireEvent.press(screen.getByText('Create account'));
    expect(screen.getByText('Select your gender.')).toBeTruthy();
  });
});
```

- [x] **Step 2: Run to verify failure** — `cd frontend && npx jest __tests__/signup.test.tsx` — expect FAIL (Age still rendered, no Gender group).

- [x] **Step 3: Implement** — in `frontend/lib/api/types.ts`: replace `SEX_AT_BIRTH_OPTIONS`/`SexAtBirth` with `export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;` and `export type Gender = (typeof GENDER_OPTIONS)[number];`; in `PublicUser` delete `age`/`sexAtBirth` and type `gender: string | null`; `RegistrationPayload` becomes `{ email, password, name, gender: Gender, schoolLevel?, memberId? }`. In `frontend/app/signup.tsx`: delete the `age` and `sexAtBirth` state/fields, change gender state to `useState<Gender | undefined>()`, render one required group before School level:

```tsx
<AuthFieldGroup label="Gender">
  <SegmentedControl options={GENDER_OPTIONS} value={gender} onChange={setGender} />
</AuthFieldGroup>
```

validation in `handleSubmit`: `if (!gender) return setError('Select your gender.');` (age block deleted); member-ID copy: label `"SHPE member ID"`, error `'Enter your SHPE member ID.'`, placeholder unchanged; `register({ email, password, name, gender, schoolLevel, memberId })`.

- [x] **Step 4: Verify green** — `cd frontend && npx tsc --noEmit && npm test` — expect PASS (fix any other test fixtures that referenced the removed fields).

- [x] **Step 5: Commit** — `git add -A && git commit -m "Ask for gender and the SHPE member ID at signup"`.

### Task 3: Terraform — avatars bucket and signing permissions

**Files:**
- Create: `infra/storage.tf`
- Modify: `infra/iam.tf`, `infra/run.tf`, `infra/outputs.tf`
- Modify: `backend/src/env.ts`, `example.env`

**Interfaces:**
- Produces: bucket `<project>-avatars` (public read, CORS for browser PUT); env var `AVATARS_BUCKET` on the Cloud Run service; `env.avatarsBucket: string` (optional, empty = avatars disabled); runtime SA can write the bucket and sign V4 URLs.

- [x] **Step 1: Write `infra/storage.tf`:**

```hcl
# Avatars are public-read at unguessable paths — the roster is small and the
# alternative (signed read URLs) taxes every render for little real privacy.
resource "google_storage_bucket" "avatars" {
  name     = "${var.project_id}-avatars"
  location = var.region

  uniform_bucket_level_access = true

  cors {
    origin          = local.cors_origins
    method          = ["PUT", "GET"]
    response_header = ["Content-Type", "x-goog-content-length-range"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "avatars_public_read" {
  bucket = google_storage_bucket.avatars.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
```

- [x] **Step 2: Grant the runtime SA its two roles** — append to `infra/iam.tf`:

```hcl
resource "google_storage_bucket_iam_member" "runtime_avatars_write" {
  bucket = google_storage_bucket.avatars.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api_runtime.email}"
}

# V4 signed URLs from ADC need the IAM signBlob path — the SA signs as itself.
resource "google_service_account_iam_member" "runtime_self_signer" {
  service_account_id = google_service_account.api_runtime.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api_runtime.email}"
}
```

- [x] **Step 3: Wire the service** — in `infra/run.tf` add to the service's `containers` env list: `env { name = "AVATARS_BUCKET" value = google_storage_bucket.avatars.name }`. In `infra/outputs.tf`: `output "avatars_bucket" { value = google_storage_bucket.avatars.name }`. In `backend/src/env.ts` add `avatarsBucket: optional('AVATARS_BUCKET'),`; document in `example.env` (empty locally = avatar upload endpoints answer 503).

- [x] **Step 4: Verify** — `terraform fmt -check -recursive && terraform validate` in `infra/` — expect clean; `npm run typecheck` — expect PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "Provision the avatars bucket"`. (Apply happens at execution time: `terraform apply` before the Task 4 deploy.)

### Task 4: Backend — avatar upload endpoints

**Files:**
- Create: `backend/src/avatars/storage.ts`, `backend/src/routes/profile.ts`
- Create: `drizzle/0006_add_avatar_path.sql` (via `npm run db:generate`, rename + journal tag as in Task 1)
- Modify: `backend/src/db/schema.ts` (add `avatarPath: text('avatar_path'),` to users), `backend/src/auth/user.ts`, `backend/src/app.ts` (mount route)
- Test: `backend/src/routes/profile.test.ts`
- Run: `npm install @google-cloud/storage`

**Interfaces:**
- Consumes: `env.avatarsBucket` (Task 3), `requireAuth` (existing).
- Produces: `POST /api/profile/avatar/upload-url` (auth) → `201 { url, objectPath, maxBytes }`; `PUT /api/profile/avatar` (auth, body `{ objectPath }`) → `200 { user }`; `PublicUser.avatarUrl: string | null` = `https://storage.googleapis.com/<bucket>/<path>`; `backend/src/avatars/storage.ts` exports `createUploadUrl(userId, contentType)`, `deleteObject(path)`, `publicUrl(path)`, `AVATAR_CONTENT_TYPES`, `AVATAR_MAX_BYTES = 5 * 1024 * 1024`.

- [x] **Step 1: Write the failing route tests** — `backend/src/routes/profile.test.ts`, following the app-boot + `vi.mock` pattern of `backend/src/routes/auth.test.ts` (mock `../auth/firebase` for `requireAuth`'s `verifyIdToken`, mock `../db` for the user lookup/update chains, and mock `../avatars/storage`):

```ts
it('issues a signed upload URL scoped to the caller', async () => {
  // signed-in as MEMBER_ROW (uid fb-1); storage mock returns a canned URL
  const res = await fetch(`${base}/api/profile/avatar/upload-url`, {
    method: 'POST',
    headers: { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: 'image/jpeg' }),
  });
  const body = await res.json();
  expect(res.status).toBe(201);
  expect(body.objectPath).toMatch(new RegExp(`^users/${MEMBER_ROW.id}/`));
  expect(storageMock.createUploadUrl).toHaveBeenCalledWith(MEMBER_ROW.id, 'image/jpeg');
});

it('rejects a content type outside the allowlist', async () => {
  const res = await fetch(`${base}/api/profile/avatar/upload-url`, {
    method: 'POST',
    headers: { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: 'image/gif' }),
  });
  expect(res.status).toBe(400);
});

it('refuses to adopt an objectPath belonging to another member', async () => {
  const res = await fetch(`${base}/api/profile/avatar`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectPath: 'users/someone-else/x.jpg' }),
  });
  expect(res.status).toBe(403);
});

it('adopts the new avatar and deletes the previous object', async () => {
  // MEMBER_ROW.avatarPath preloaded as 'users/<id>/old.jpg'; update mock returns the row with the new path
  const res = await fetch(`${base}/api/profile/avatar`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectPath: `users/${MEMBER_ROW.id}/new.jpg` }),
  });
  expect(res.status).toBe(200);
  expect(storageMock.deleteObject).toHaveBeenCalledWith(`users/${MEMBER_ROW.id}/old.jpg`);
});
```

- [x] **Step 2: Run to verify failure** — `npx vitest run backend/src/routes/profile.test.ts` — expect FAIL (module missing).

- [x] **Step 3: Implement** — `backend/src/avatars/storage.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { env } from '../env';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const storage = new Storage();

export async function createUploadUrl(userId: string, contentType: string) {
  const objectPath = `users/${userId}/${randomUUID()}.${AVATAR_CONTENT_TYPES[contentType]}`;
  const [url] = await storage
    .bucket(env.avatarsBucket)
    .file(objectPath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60_000,
      contentType,
      extensionHeaders: { 'x-goog-content-length-range': `0,${AVATAR_MAX_BYTES}` },
    });
  return { url, objectPath };
}

export async function deleteObject(objectPath: string): Promise<void> {
  await storage.bucket(env.avatarsBucket).file(objectPath).delete({ ignoreNotFound: true });
}

export function publicUrl(objectPath: string): string {
  return `https://storage.googleapis.com/${env.avatarsBucket}/${objectPath}`;
}
```

`backend/src/routes/profile.ts`: both handlers behind `requireAuth`; upload-url returns 503 `avatars_disabled` when `env.avatarsBucket` is empty, 400 `bad_content_type` off the allowlist; the PUT handler rejects paths not starting `users/${req.currentUser!.id}/` with 403 `not_your_object`, updates `users.avatarPath`, then best-effort deletes the previous path (`.catch(() => {})`). Mount in `backend/src/app.ts`: `app.use('/api/profile', profileRoutes);`. Schema: add `avatarPath` column; `toPublicUser` gains `avatarUrl: user.avatarPath ? publicUrl(user.avatarPath) : null`.

- [x] **Step 4: Generate migration 0006** — as Task 1 Step 5 (`0006_add_avatar_path.sql`, journal tag to match); it should contain only `ALTER TABLE "users" ADD COLUMN "avatar_path" text;`.

- [x] **Step 5: Verify green** — `npm run typecheck && npm test` — expect PASS.

- [x] **Step 6: Commit** — `git add -A && git commit -m "Issue signed avatar uploads and record the chosen object"`.

### Task 5: Frontend — Avatar component, upload flow, placements

**Files:**
- Create: `frontend/components/Avatar.tsx`
- Modify: `frontend/app/(tabs)/profile.tsx` (upload flow + own avatar), `frontend/app/admin/members.tsx` (roster rows), `frontend/app/admin/attendance.tsx` (attendee rows), `frontend/lib/api/types.ts` (`avatarUrl: string | null` on `PublicUser` and on the roster/attendance row types it reuses, plus `export type UploadTicket = { url: string; objectPath: string; maxBytes: number };`)
- Test: `frontend/components/Avatar.test.tsx`
- Run: `cd frontend && npx expo install expo-image-picker`

**Interfaces:**
- Consumes: Task 4's endpoints and `PublicUser.avatarUrl`.
- Produces: `<Avatar name={string} url={string | null} size={number} />` — renders `expo-image` style `<Image>` when `url` is set, else a colored circle with the name's initials.

- [x] **Step 1: Write the failing component test** — `frontend/components/Avatar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('falls back to initials without a url', () => {
    render(<Avatar name="Ana María Rivera" url={null} size={40} />);
    expect(screen.getByText('AR')).toBeTruthy(); // first + last word
    expect(screen.queryByTestId('avatar-image')).toBeNull();
  });

  it('renders the image when a url exists', () => {
    render(<Avatar name="Ana Rivera" url="https://cdn.example/a.jpg" size={40} />);
    expect(screen.getByTestId('avatar-image')).toBeTruthy();
    expect(screen.queryByText('AR')).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure** — `cd frontend && npx jest components/Avatar.test.tsx` — expect FAIL (module missing).

- [x] **Step 3: Implement `Avatar.tsx`** — a `View`-wrapped `Image` (`testID="avatar-image"`) or initials `Text` (first letter of first and last name words, uppercased), circle of `size`, background `colors.navy`, white text at `size * 0.4`. Verify green, then wire the placements: profile header uses `<Avatar name={user.name} url={user.avatarUrl} size={72} />` with a small camera-icon badge; roster and attendance rows get `size={36}` avatars to the left of the name (both row types gain `avatarUrl` in their API types — the backend already sends whatever `toPublicUser`/the admin selects include; add `avatar_path` → `avatarUrl` to the admin queries in `backend/src/routes/admin.ts` members/attendance selects as part of this step).

- [x] **Step 4: Implement the upload flow in `profile.tsx`** — on avatar press:

```tsx
const pick = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
});
if (pick.canceled) return;
const asset = pick.assets[0];
const contentType = asset.mimeType ?? 'image/jpeg';
const { url, objectPath, maxBytes } = await apiFetch<UploadTicket>(
  '/api/profile/avatar/upload-url',
  { method: 'POST', body: { contentType } },
);
const blob = await (await fetch(asset.uri)).blob();
if (blob.size > maxBytes) { setAvatarError('That image is too large (5 MB max).'); return; }
const put = await fetch(url, {
  method: 'PUT',
  headers: { 'Content-Type': contentType, 'x-goog-content-length-range': `0,${maxBytes}` },
  body: blob,
});
if (!put.ok) { setAvatarError('Upload failed. Try again.'); return; }
await apiFetch('/api/profile/avatar', { method: 'PUT', body: { objectPath } });
await refreshUser(); // expose a refresh from AuthContext, or re-fetch /me here
```

with a spinner state while in flight and the error surfaced under the card.

- [x] **Step 5: Verify green** — `cd frontend && npx tsc --noEmit && npm test` — expect PASS.

- [x] **Step 6: Commit** — `git add -A && git commit -m "Let members set a profile picture, shown wherever members appear"`.

### Task 6: Docs sweep

**Files:**
- Modify: `README.md` (signup field list in "Accounts and sessions" / "What is not built yet"; demographics note), `docs/PERMISSIONS.md` (the "reports no demographics" passage now covers only gender), `example.env` (already touched in Task 3 — verify), `frontend/example.env` (no change expected — verify)

- [x] **Step 1:** Update README's demographics sentence: age and sex at birth are no longer collected at all; gender (Male/Female/Other) is collected at signup and still excluded from every admin endpoint. Mention avatars in the profile description. Search the repo for `UIN`, `UIC member ID`, `sex at birth`, `Age` in docs — expect zero stale hits when done.
- [x] **Step 2:** `npm run typecheck && npm test && cd frontend && npx tsc --noEmit && npm test` one final time — expect PASS.
- [x] **Step 3: Commit** — `git add -A && git commit -m "Document the profile data changes and avatars"`.

---

## Verification (end-to-end, after deploy)

1. `terraform apply` shows only the Task 3 additions; plan clean afterwards.
2. Deploy pipeline green (migrations 0005 + 0006 apply via `shpe-migrate`).
3. Register a fresh `@uic.edu` account: step 2 shows Gender (Male/Female/Other) + SHPE member ID, no Age, no Sex at birth.
4. Upload a profile picture from the profile tab; confirm it renders there, in Dashboard → View members, and in an event's attendance list; replace it and confirm the old object is gone from the bucket (`gcloud storage ls gs://shpe-webapp-avatars/users/<id>/` shows exactly one object).
5. `select gender, count(*) from users group by 1` returns only Male/Female/Other/NULL.
