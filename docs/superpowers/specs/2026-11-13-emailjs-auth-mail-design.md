# Auth mail through EmailJS and the SHPE Gmail

Design for #54 (email verification) and #53 (password reset).

## Intent

Verification mail does not reach `uic.edu` mailboxes
([EMAIL-DELIVERY.md](../../EMAIL-DELIVERY.md)), so verification is not
enforced and password reset was never built. The remaining suspects are the
young sending domain and the action link sitting on `firebaseapp.com`.

Send both kinds of mail from the SHPE Gmail through EmailJS instead. A maintainer's
own site already sends through EmailJS and a Gmail account, and that mail
reaches a `uic.edu` inbox. That mail is not the same shape as a verification
link, so the delivery check under Delivery below still has to pass.

## Goals

- Verification and password-reset mail leave from the SHPE Gmail via EmailJS.
- Links in the mail point at `shpeuicapp.org`, not `firebaseapp.com`.
- A link scanner opening the link does not use it up.
- Members can reset a forgotten password from the login screen (#53): the
  link expires and works once.

## Non-goals

- Turning the verification gate back on. That waits until real members are
  seen verifying; the checklist in EMAIL-DELIVERY.md still applies.
- Removing the SendGrid SMTP setup. Firebase still uses it for anything it
  sends itself (email-change notices).
- Our own code storage. Firebase keeps issuing, expiring and spending codes.

## Anti-goals

- The app must never receive a verification code or link for the signed-in
  member from the API. If it did, a member could verify an address they
  cannot read.
- The reset endpoint must not reveal whether an address has an account.
- The EmailJS private key must never be in the frontend bundle.

## Approaches

1. **Point Firebase's custom SMTP at Gmail.** No code. Keeps Firebase's
   template and the `firebaseapp.com` link, so the scanner problem and one
   filter signal stay. Rejected.
2. **API mints a Firebase code, EmailJS sends our own link. Chosen.** Fixes
   the sender and the link domain, and Firebase still owns expiry and single
   use. Smallest amount of security-sensitive code of our own.
3. **Our own 6-digit codes.** Best in the native app, but we would own a
   codes table, hashing, attempt limits and the password change. Rejected as
   more risk than the benefit over 2.

## Design

### Backend

- **Mailer** (`backend/src/mail/`): one function that posts to the EmailJS
  REST API with service id, template id, public key, private key and template
  parameters. Config comes from env; with it unset (local dev, tests) the
  mailer logs the link instead of sending.
- **`POST /api/auth/verification-email`** (signed in): calls the Admin SDK's
  `generateEmailVerificationLink` for the caller's own address, takes the
  `oobCode` from it, and mails `https://shpeuicapp.org/verify?code=…`.
  Responds with success or failure only, never the code.
- **`POST /api/auth/password-reset`** (anonymous): for a known address, same
  with `generatePasswordResetLink` and
  `https://shpeuicapp.org/reset-password?code=…`. Always answers the same
  200, known address or not.
- **Rate limiting** on both, per IP and per address. There is none in the
  backend today.
- The app URL comes from a backend env var, not from the request.

### Frontend

- `AuthContext`: `sendVerificationLink` calls the new endpoint instead of
  Firebase's `sendEmailVerification`. `verificationEmailSent` keeps its
  meaning. The continue-URL fallback goes away.
- **`/verify`** page: reads the code, shows a **Confirm my email** button,
  and calls `applyActionCode` on press. Works signed out, since the member
  may open the mail on another device.
- **`/reset-password`** page: checks the code with `verifyPasswordResetCode`,
  takes a new password, calls `confirmPasswordReset` on submit, then sends
  the member to login.
- **Forgot password** on the login screen: an address field that calls the
  reset endpoint and shows the same "if that address has an account, a link
  is on its way" message every time.
- `_layout.tsx` must let signed-out visitors reach `/verify` and
  `/reset-password`.

### Config and infra

- EmailJS: connect the SHPE Gmail as a service, create two templates, and
  allow API calls from non-browser clients. A human with the Gmail login does
  this.
- Private key in Secret Manager and wired into Cloud Run in `infra/`, like
  the existing secrets. Service id, template ids and public key as plain env.
  `infra/**` changes need the manual apply.

### Delivery

Two PRs, one per issue: #54 first (mailer, verification endpoint, `/verify`
page), then #53 (reset endpoint, pages, login link).

Before #54 merges: a verification mail sent through the new path lands in a
real `uic.edu` inbox, and the link still works after sitting in it.

## Decisions made while planning

Recorded 2026-11-13. The plan
([2026-11-13-emailjs-auth-mail.md](../plans/2026-11-13-emailjs-auth-mail.md))
and issues #54 and #53 carry these as requirements.

- **Sender:** the SHPE Gmail, chosen over a `@uic.edu` mailbox because it can
  be connected without UIC IT. Delivery to `uic.edu` from it is unproven for
  this kind of mail until the check above passes.
- **Who calls EmailJS:** the API, with the private key. The app never does,
  and EmailJS must be set to allow non-browser API requests.
- **Rate limits:** verification, 3 per member per 15 minutes. Reset, 3 per
  address and 10 per IP per 15 minutes, checked before the account lookup.
  In-memory, and Cloud Run runs up to two instances, so the real ceiling is
  up to double.
- **Unconfigured mailer:** outside production the link is printed to the API
  log; in production the send fails.
- **Already verified:** asking for a verification mail answers 409 and the
  app rechecks instead of mailing.
- **`EXPO_PUBLIC_APP_URL`** is removed from the web build; the backend builds
  links from its own `APP_URL`.
- **Reset timing:** the endpoint waits for the send, so a known address
  answers slower than an unknown one. Accepted, because registration already
  answers "email taken" outright.
- **Config:** the private key is a Secret Manager secret fed by a GitHub
  repo secret through Terraform; service id, public key and template ids are
  repo variables. No value of any of them belongs in this repository.
- **Issues:** #54 and #53 were rewritten on 2026-11-13 as task lists for
  developers, and retitled. The earlier triage comments on both remain.

## Left to the builder

- Rate-limit mechanism and numbers. My call: in-memory per instance is
  enough at this scale.
- Template wording. Plain text, sender name `SHPE UIC`, no `@UIC`.
- Check EmailJS's current free-tier limits and the exact REST fields against
  its docs at build time; the figures used in discussion were from memory.
- Whether the old Firebase-hosted handler needs any redirect. My call: no.
