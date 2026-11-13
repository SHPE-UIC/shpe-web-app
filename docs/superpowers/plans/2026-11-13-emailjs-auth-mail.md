# Auth Mail Through EmailJS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send verification and password-reset mail from the SHPE Gmail through EmailJS, with links that land on `shpeuicapp.org` and are only spent on a button press.

**Architecture:** The API asks the Firebase Admin SDK for an action link, keeps only its `oobCode`, and mails `https://shpeuicapp.org/<page>?code=…` through the EmailJS REST API. Two new public pages in the Expo app spend the code with the Firebase client SDK (`applyActionCode`, `confirmPasswordReset`). Firebase still owns expiry and single use; nothing new is stored.

**Tech Stack:** Express 5, firebase-admin 14, vitest (backend); Expo Router, firebase JS SDK, jest-expo (frontend); Terraform + Secret Manager + Cloud Run (infra); EmailJS REST API.

**Spec:** `docs/superpowers/specs/2026-11-13-emailjs-auth-mail-design.md`

**Issues:** #54 (Part A), #53 (Part B)

## Global Constraints

- The API never returns a code or link in a response body, in any environment.
- `POST /api/auth/password-reset` returns the same status and body for a known and an unknown address.
- The EmailJS private key exists only in backend env / Secret Manager. Nothing `EXPO_PUBLIC_*` may hold it.
- Links are built from the backend `APP_URL` env var, never from request headers.
- Sender name in templates is `SHPE UIC`. No `@UIC` in sender name or subject.
- The verification gate stays off. Do not touch `requireAuth`'s behaviour.
- SendGrid / Identity Platform SMTP config stays as it is.
- Two PRs: Part A closes #54, Part B closes #53. Part B branches from Part A; retarget to `main` by hand after A merges.
- Backend tests: `npm test` at repo root. Frontend tests: `npm test` in `frontend/`. Typecheck: `npm run typecheck` at root, `npx tsc --noEmit` in `frontend/`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`

## Review Focus

1. **EmailJS is down or slow.** The verification endpoint must answer 502 `mail_failed` within about 10 seconds, not hang; the reset endpoint must still answer 200. (Tests in Tasks 1, 3, 6.)
2. **Link opened on a different device, signed out.** `/verify` and `/reset-password` must render and work with no session, and must not be bounced to login by `AuthGate`. (Tests in Tasks 5, 8.)
3. **Link opened twice, or after expiry.** The page shows a plain "expired or already used" message with a way forward, not a Firebase error string. (Tests in Tasks 5, 8.)
4. **Link opened with no `code` parameter, or a mangled one.** Same message as expired; no SDK call with an empty code. (Tests in Tasks 5, 8.)
5. **Reset requested for an address in a different case or with spaces** (`  Ann@UIC.edu `). It must find the account. (Test in Task 6.)

## Human steps (a maintainer)

These block the manual delivery check and the merge, not the coding.

1. In EmailJS: connect the SHPE Gmail as a service; create two templates using variables `{{to_email}}`, `{{to_name}}`, `{{link}}` (To field `{{to_email}}`, From name `SHPE UIC`); in Account → Security allow API requests from non-browser applications.
2. Add GitHub repo **secret** `EMAILJS_PRIVATE_KEY` and repo **variables** `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_VERIFY_TEMPLATE_ID`, `EMAILJS_RESET_TEMPLATE_ID`.
3. Run the manual infra apply after Task 2 is on the branch and before merging Part A.

---

# Part A: verification (#54)

Branch: `feature/emailjs-verification`

### Task 1: Mailer and env

**Files:**
- Modify: `backend/src/env.ts`
- Create: `backend/src/mail/emailjs.ts`
- Test: `backend/src/mail/emailjs.test.ts`
- Modify: `example.env`

**Interfaces:**
- Produces:
  - `env.appUrl: string` (`APP_URL`, default `http://localhost:8081`, trailing slashes stripped)
  - `env.emailjs: { serviceId, publicKey, privateKey, verifyTemplateId, resetTemplateId }` — all `optional()`, from `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, `EMAILJS_VERIFY_TEMPLATE_ID`, `EMAILJS_RESET_TEMPLATE_ID`
  - `type MailTemplate = 'verify' | 'reset'`
  - `sendAuthMail(template: MailTemplate, params: { toEmail: string; toName: string; link: string }): Promise<void>`
  - `class MailError extends Error`

- [ ] **Step 1: Write the failing tests** in `backend/src/mail/emailjs.test.ts`, stubbing `globalThis.fetch` with `vi.stubGlobal` and env with `vi.mock('../env')`:

```ts
it('posts service, template, both keys and the params to EmailJS', async () => {
  // configured env; fetch resolves 200 'OK'
  await sendAuthMail('verify', { toEmail: 'ann@uic.edu', toName: 'Ann', link: 'https://x/verify?code=abc' });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.emailjs.com/api/v1.0/email/send');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({
    service_id: 'svc', template_id: 'tpl_verify', user_id: 'pub', accessToken: 'priv',
    template_params: { to_email: 'ann@uic.edu', to_name: 'Ann', link: 'https://x/verify?code=abc' },
  });
});
it('uses the reset template id for reset mail', ...);            // template_id === 'tpl_reset'
it('throws MailError on a non-2xx answer', ...);                 // fetch → 403 'forbidden'; rejects.toBeInstanceOf(MailError)
it('throws MailError when fetch rejects or times out', ...);     // fetch rejects; rejects.toBeInstanceOf(MailError)
it('logs the link instead of sending when unconfigured outside production', ...);
   // privateKey '' and isProduction false → fetch not called, console.info called with the link, resolves
it('throws MailError when unconfigured in production', ...);     // isProduction true → rejects, fetch not called
```

- [ ] **Step 2: Run** `npx vitest run backend/src/mail` — expect FAIL, module not found.
- [ ] **Step 3: Implement.** Add the env entries. In `emailjs.ts`, "configured" means all five EmailJS values are non-empty. Pass `signal: AbortSignal.timeout(10_000)` to `fetch`. `MailError` messages carry the HTTP status and response text but never the private key or the link.
- [ ] **Step 4: Run** `npx vitest run backend/src/mail` — expect PASS. Run `npm run typecheck`.
- [ ] **Step 5:** Add an "Auth mail" block to `example.env` listing `APP_URL` and the five `EMAILJS_*` names, commented out, with one line saying that unset means links are printed to the API log.
- [ ] **Step 6: Commit** — `Add EmailJS mailer for auth mail`

### Task 2: Infra wiring

**Files:**
- Modify: `infra/variables.tf`, `infra/secrets.tf`, `infra/iam.tf`, `infra/run.tf`, `.github/workflows/infra.yml`

No tests; verified by `terraform fmt`/`validate` in CI (no local terraform).

- [ ] **Step 1:** `variables.tf`: add `emailjs_private_key` (string, `sensitive = true`, no default) and `emailjs_service_id`, `emailjs_public_key`, `emailjs_verify_template_id`, `emailjs_reset_template_id` (string, no default).
- [ ] **Step 2:** `secrets.tf`: add `google_secret_manager_secret.emailjs_private_key` (`secret_id = "shpe-emailjs-private-key"`) and its version from `var.emailjs_private_key`, copying the `sync_secret` pair.
- [ ] **Step 3:** `iam.tf`: add `emailjs_private_key` to the `runtime_secrets` map.
- [ ] **Step 4:** `run.tf`: add env `EMAILJS_PRIVATE_KEY` (secret ref, `latest`), plain env `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_VERIFY_TEMPLATE_ID`, `EMAILJS_RESET_TEMPLATE_ID` from the variables, and `APP_URL = "https://${var.domain_name}"`. Add the new secret version to `depends_on`.
- [ ] **Step 5:** `infra.yml`: add `TF_VAR_emailjs_private_key: ${{ secrets.EMAILJS_PRIVATE_KEY }}` and the four `TF_VAR_emailjs_*` from `vars.EMAILJS_*` beside the existing `TF_VAR_` lines.
- [ ] **Step 6: Commit** — `Wire EmailJS config into Cloud Run`

### Task 3: Rate limiter and `POST /api/auth/verification-email`

**Files:**
- Create: `backend/src/middleware/rateLimit.ts`
- Test: `backend/src/middleware/rateLimit.test.ts`
- Modify: `backend/src/auth/firebase.ts`, `backend/src/middleware/errors.ts`, `backend/src/routes/auth.ts`
- Test: `backend/src/routes/auth.test.ts`

**Interfaces:**
- Consumes: `sendAuthMail`, `MailError`, `env.appUrl` (Task 1)
- Produces:
  - `createRateLimiter(opts: { windowMs: number; max: number; now?: () => number }): { take(key: string): boolean; reset(): void }` — `take` returns `false` once `max` calls for that key fall inside the window. Fixed window, in-memory `Map`, expired keys dropped on `take`.
  - `tooManyRequests(message?: string, code?: string): HttpError` (429) in `errors.ts`
  - `generateVerificationCode(email: string): Promise<string>` and `oobCodeFrom(link: string): string` in `auth/firebase.ts`
  - Route: `POST /api/auth/verification-email` → `204` on send

- [ ] **Step 1: Write failing limiter tests:** allows `max` takes then refuses; a different key is unaffected; allows again after `windowMs` (inject `now`); `reset()` clears.
- [ ] **Step 2: Run** `npx vitest run backend/src/middleware/rateLimit.test.ts` — FAIL. Implement. Re-run — PASS.
- [ ] **Step 3: Write failing route tests** in `auth.test.ts`. Add `generateVerificationCode` to the hoisted `fb` mock and mock `../mail/emailjs` (`sendAuthMail`, real `MailError`). Sign in by having `fb.verifyIdToken` resolve `{ uid, email_verified: false }` and queueing the member row in `dbState.selectRows`.

```ts
describe('POST /api/auth/verification-email', () => {
  it('refuses a signed-out caller', ...);                       // 401, sendAuthMail not called
  it('mails a link to the app with the code, to the caller\'s own address', async () => {
    fb.generateVerificationCode.mockResolvedValue('abc/123');
    // → 204, empty body
    expect(fb.generateVerificationCode).toHaveBeenCalledWith('ann@uic.edu');
    expect(mail.sendAuthMail).toHaveBeenCalledWith('verify', {
      toEmail: 'ann@uic.edu', toName: 'Ann',
      link: 'http://localhost:8081/verify?code=abc%2F123',
    });
  });
  it('ignores an email in the request body', ...);              // body {email:'other@uic.edu'} → still mails ann@uic.edu
  it('never puts the code in the response', ...);               // response text does not contain 'abc'
  it('answers 409 already_verified without sending', ...);      // token email_verified: true
  it('answers 502 mail_failed when the mailer throws', ...);    // sendAuthMail rejects MailError
  it('answers 429 rate_limited on the 4th request in the window', ...);
});
```

- [ ] **Step 4: Run** — FAIL (404 `no_route`).
- [ ] **Step 5: Implement.**
  - `oobCodeFrom` reads the `oobCode` query parameter with `new URL(link).searchParams` and throws if absent. `generateVerificationCode` calls `adminAuth().generateEmailVerificationLink(email)` and returns `oobCodeFrom(link)`.
  - Route is behind `requireAuth`; address and name come from `req.currentUser` only.
  - Limiter: 3 per 15 minutes keyed by user id, module-level in `routes/auth.ts`, exported so tests call `reset()` in `beforeEach`. Checked before anything else.
  - Messages: 409 `"That address is already verified."`; 502 `"Could not send the email. Try again."`; 429 `"Too many requests. Wait a few minutes before asking for another email."`
  - Log the `MailError` with `console.error`; do not log the link.
- [ ] **Step 6: Run** `npm test` and `npm run typecheck` — PASS.
- [ ] **Step 7: Commit** — `Add verification-email endpoint sending through EmailJS`

### Task 4: `AuthContext` sends through the API

**Files:**
- Modify: `frontend/contexts/AuthContext.tsx`, `frontend/contexts/AuthContext.test.tsx`
- Modify: `.github/workflows/deploy.yml` (remove `EXPO_PUBLIC_APP_URL` and its comment), `frontend/example.env` if it lists it

**Interfaces:**
- Consumes: `POST /api/auth/verification-email` (Task 3)
- Produces: unchanged `useAuth()` shape. `resendVerification` and `register` behave as before from the screen's point of view.

- [ ] **Step 1: Rewrite the affected tests.** Replace every `sendEmailVerification` assertion with one on `apiFetch`:

```ts
expect(apiFetch).toHaveBeenCalledWith('/api/auth/verification-email', { method: 'POST' });
```

Keep: registration records `verificationEmailSent === false` when the send rejects and still resolves; `resendVerification` throws `ApiError` 429 with the existing "Too many requests…" wording when the API answers 429; any other failure throws `'Could not send the email. Try again.'`. Add: an `already_verified` (409) answer on resend triggers `recheckVerification` and resolves. Delete the continue-URL fallback tests.
- [ ] **Step 2: Run** `npm test -- AuthContext` in `frontend/` — FAIL.
- [ ] **Step 3: Implement.** `sendVerificationLink()` takes no argument and calls the endpoint. Remove `sendEmailVerification`, `REFUSED_CONTINUE_URL`, and the `auth.currentUser` null branch in `register` that only existed to have a `User` to send to. Rewrite the doc comment to say the API mints and mails the link.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit` in `frontend/` — PASS.
- [ ] **Step 5: Commit** — `Send verification mail through the API`

### Task 5: `/verify` page and public routes

**Files:**
- Create: `frontend/app/verify.tsx`
- Test: `frontend/__tests__/verify.test.tsx`
- Modify: `frontend/app/_layout.tsx`, `frontend/__tests__/auth-gate.test.tsx`
- Modify: `frontend/app/verify-email.tsx` (copy only)

**Interfaces:**
- Consumes: `applyActionCode` from `firebase/auth`; `useAuth().recheckVerification`, `useAuth().user`
- Produces: route `/verify?code=<oobCode>`; `PUBLIC_SEGMENTS` in `_layout.tsx` (Task 8 adds to it)

- [ ] **Step 1: Write failing tests** in `verify.test.tsx` (mock `firebase/auth`, `expo-router`'s `useLocalSearchParams`/`useRouter`, and `useAuth`, following `verify-email.test.tsx`):

```ts
it('does not spend the code until the button is pressed', ...);
   // render with code 'abc' → applyActionCode not called
it('confirms the address on press and says so', ...);
   // press 'Confirm my email' → applyActionCode(auth, 'abc'); 'Your email is confirmed.' shown
it('refreshes the session when signed in', ...);        // user set → recheckVerification called once
it('works signed out', ...);                            // user null → no recheckVerification, success shown
it('explains an expired or used link', ...);
   // reject {code:'auth/invalid-action-code'} and 'auth/expired-action-code'
   // → 'This link has expired or was already used. Sign in and ask for a new one.'
it('treats a missing code the same way, without calling Firebase', ...);
it('shows a retry message on a network failure', ...);  // 'Could not confirm just now. Try again in a moment.'
it('Continue goes to the app root', ...);               // router.replace('/')
```

Add to `auth-gate.test.tsx`:

```ts
it('leaves a signed-out visitor on the verify page', ...);   // segments ['verify'] → no replace
it('leaves a signed-in member on the verify page', ...);     // no replace
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Build the page from `AuthLayout`, `AuthError`, `AuthSubmit` like `verify-email.tsx`. In `_layout.tsx` add `const PUBLIC_SEGMENTS = new Set(['verify'])`; when the first segment is in it, `AuthGate` does no redirect at all. Register `<Stack.Screen name="verify" />`. In `verify-email.tsx` change "Open it, then come back here" to "Open it and press Confirm, then come back here"; leave behaviour alone.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npm run lint` in `frontend/` — PASS.
- [ ] **Step 5: Commit** — `Add verify page that confirms on press`

### Task 5b: Docs and delivery check

**Files:**
- Modify: `docs/EMAIL-DELIVERY.md`, `docs/TODO.md`, `docs/DEPLOYMENT.md` (member-email section)

- [ ] **Step 1:** EMAIL-DELIVERY.md: add a dated section "Auth mail now goes through EmailJS" stating what sends verification and reset mail now, that SendGrid remains for Firebase's own notices, and where the config lives. Update "Turning the gate back on" step 3 note only if it references the old send path. TODO.md: mark the `firebaseapp.com` action-URL item resolved for verification. DEPLOYMENT.md: list the new secret, the four variables and the EmailJS account steps.
- [ ] **Step 2: Manual check (needs Human steps 1–3).** Run the API locally with real `EMAILJS_*` values and `APP_URL=https://shpeuicapp.org`, register a throwaway `@uic.edu` account a maintainer can read, and record in the PR description: arrived in inbox yes/no, From address, and whether the link still confirmed after sitting in the inbox for a few minutes. If it does not arrive, stop and report; do not merge.
- [ ] **Step 3: Commit** — `Document EmailJS auth mail`. Open the PR against `main`, "Closes #54".

---

# Part B: password reset (#53)

Branch: `feature/password-reset`, from `feature/emailjs-verification`.

### Task 6: `POST /api/auth/password-reset`

**Files:**
- Modify: `backend/src/auth/firebase.ts`, `backend/src/routes/auth.ts`
- Test: `backend/src/routes/auth.test.ts`

**Interfaces:**
- Consumes: `sendAuthMail`, `createRateLimiter`, `tooManyRequests`, `oobCodeFrom`, `findUserByEmail`, `env.appUrl`
- Produces:
  - `generatePasswordResetCode(email: string): Promise<string>` in `auth/firebase.ts`
  - Route: `POST /api/auth/password-reset`, body `{ email: string }` → always `200 { ok: true }`

- [ ] **Step 1: Write failing tests:**

```ts
describe('POST /api/auth/password-reset', () => {
  it('mails a reset link for a known address', async () => {
    // selectRows: [[memberRow]]; generatePasswordResetCode → 'r1'
    // → 200 {ok:true}
    expect(mail.sendAuthMail).toHaveBeenCalledWith('reset', {
      toEmail: 'ann@uic.edu', toName: 'Ann',
      link: 'http://localhost:8081/reset-password?code=r1',
    });
  });
  it('gives an unknown address the identical answer and sends nothing', ...);
     // same status, same body text as the known case
  it('gives the identical answer when the mailer fails', ...);
  it('gives the identical answer when Firebase has no such user', ...);
     // generatePasswordResetCode rejects {code:'auth/user-not-found'}
  it('finds the account regardless of case and surrounding spaces', ...);
     // body {email:'  Ann@UIC.edu '} → mail goes to the row's stored address
  it('answers 400 when email is missing or not a string', ...);
  it('answers 429 after 3 requests for one address, known or not', ...);
  it('answers 429 after 10 requests from one IP', ...);
  it('never puts the code in the response', ...);
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** No auth middleware. Two limiters, checked before the lookup so they behave the same for known and unknown addresses: 3 per 15 minutes keyed by the trimmed, lower-cased address; 10 per 15 minutes keyed by `req.ip`. Await the send (Cloud Run throttles CPU after the response), catch and `console.error` every failure after the limiters, and answer `{ ok: true }` regardless. Addresses longer than 254 characters are treated as unknown.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** — `Add password-reset endpoint`

### Task 7: Forgot-password screen

**Files:**
- Create: `frontend/app/forgot-password.tsx`
- Test: `frontend/__tests__/forgot-password.test.tsx`
- Modify: `frontend/app/index.tsx`, `frontend/__tests__/login.test.tsx`, `frontend/app/_layout.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/password-reset` via `apiFetch(path, { method: 'POST', anonymous: true, body: { email } })`
- Produces: route `/forgot-password` (added to `AUTH_SEGMENTS`)

- [ ] **Step 1: Write failing tests:**

```ts
it('asks for an address before calling the API', ...);   // empty → 'Enter your email.'; apiFetch not called
it('sends the trimmed address anonymously', ...);
it('shows the same confirmation whatever the API found', ...);
   // 'If that address has an account, a reset link is on its way. It can take a minute — check spam too.'
it('shows the rate-limit message on 429', ...);          // ApiError.message shown
it('shows a retry message when the server cannot be reached', ...);
it('Back to sign in returns to login', ...);
// login.test.tsx:
it('Forgot Password opens the forgot-password screen', ...);   // router.push('/forgot-password')
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** with `AuthLayout`/`AuthField`/`AuthSubmit`/`AuthFooter`. Title `'Reset\nPassword'`, submit label `Send reset link`. After success, replace the form with the confirmation text. Wire the existing `Forgot Password?` touchable in `index.tsx` and give it `accessibilityRole="link"`. Add `'forgot-password'` to `AUTH_SEGMENTS` and register the screen.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npm run lint` — PASS.
- [ ] **Step 5: Commit** — `Add forgot-password screen`

### Task 8: `/reset-password` page

**Files:**
- Create: `frontend/app/reset-password.tsx`
- Test: `frontend/__tests__/reset-password.test.tsx`
- Modify: `frontend/app/_layout.tsx`, `frontend/__tests__/auth-gate.test.tsx`

**Interfaces:**
- Consumes: `verifyPasswordResetCode`, `confirmPasswordReset` from `firebase/auth`; `MIN_PASSWORD_LENGTH` from `frontend/lib/validation.ts`; `PUBLIC_SEGMENTS` (Task 5)
- Produces: route `/reset-password?code=<oobCode>`

- [ ] **Step 1: Write failing tests:**

```ts
it('checks the code on load and names the account', ...);
   // verifyPasswordResetCode(auth,'r1') → 'ann@uic.edu' shown; confirmPasswordReset not called
it('explains an expired or used link, with a way to ask again', ...);
   // verify rejects invalid/expired → 'This link has expired or was already used.' and
   // 'Request a new link' → router.replace('/forgot-password')
it('treats a missing code the same way, without calling Firebase', ...);
it('refuses a password shorter than 8 characters', ...);       // `Password must be at least 8 characters`
it('refuses when the two entries differ', ...);                // 'Those passwords do not match.'
it('sets the password and offers sign-in', ...);
   // confirmPasswordReset(auth,'r1','newpassword1'); 'Your password is updated.'; 'Sign in' → router.replace('/')
it('reports a link that expired between load and submit', ...); // confirm rejects expired → expired message
it('maps auth/weak-password to the length message', ...);
// auth-gate.test.tsx:
it('leaves a signed-out visitor on the reset-password page', ...);
it('leaves a signed-in member on the reset-password page', ...);
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Two `AuthField`s (`secureTextEntry`, `autoComplete="new-password"`), labels `New password` and `Confirm password`, submit `Set new password`. Show a loader while the code is being checked. Add `'reset-password'` to `PUBLIC_SEGMENTS` and register the screen.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npm run lint` — PASS.
- [ ] **Step 5:** Update `docs/TODO.md` (password reset done) and the EmailJS section of `docs/EMAIL-DELIVERY.md` (reset now ships; From address observed).
- [ ] **Step 6: Manual check.** With real EmailJS config, request a reset for the throwaway `@uic.edu` account, follow the link, set a password, sign in with it, and confirm the same link is refused on a second use. Record the result and the From address in the PR.
- [ ] **Step 7: Commit** — `Add reset-password page`. Open the PR, "Closes #53".
