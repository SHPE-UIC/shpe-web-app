# Todo

What is outstanding, and who has to do it. Things that only a person with
console access can do are marked **manual** — they cannot be scripted from
this repository.

## Do these next

- [ ] **Reconcile Terraform state after the org transfer.** Run Actions →
      Infrastructure → Run workflow → tick *Apply*. The WIF binding was
      repaired directly with `gcloud`, so state still keys the two
      `google_service_account_iam_member` resources by the old member string
      and every plan reports `2 to add`. The bindings already exist in GCP
      with exactly those values, so the apply is an idempotent no-op — it
      only clears the noise. Needs a second person to approve, per the
      `infra` environment's reviewers. Background:
      [org-migration-fix.md](../org-migration-fix.md).

- [x] **manual — Require a reviewer on the `infra` environment.** Done:
      `infra` now lists three required reviewers with self-review prevented,
      so an apply cannot be approved by whoever dispatched it. This matters
      because that account holds `roles/resourcemanager.projectIamAdmin` —
      it can change who has access to the project. See
      [ARCHITECTURE.md](ARCHITECTURE.md#why-it-differs-from-the-plan).

- [x] **Done 2026-09-01 — `main` is protected.** The *Main Protection*
      ruleset requires a pull request with two approvals, resolved review
      threads, and the `backend`, `frontend`, and `plan` checks; it blocks
      force pushes and deletion. It has **no bypass actors**, so it applies to
      admins too. Verified by a rejected direct push, not just by reading the
      settings.

- [x] **Done 2026-09-01 — the `infra` environment only deploys from `main`.**
      The apply job checks out whatever ref the workflow was dispatched from,
      so without this a branch carrying edited Terraform could reach the
      apply — and the approval prompt names the environment, not the diff.
      Pinning it means the Terraform being applied has already passed the
      ruleset above. Listed as an explicit branch rather than *protected
      branches*, so the allowlist cannot widen later as a side effect of
      protecting some other branch. The plan job does not use the
      environment, so pull request plans are unaffected.

- [ ] **manual — Try a QR check-in end to end.** Sign in as a Top 8, open an
      event's organizer screen, and scan the code with a second account. It is
      the one member-facing flow that has never been exercised against the
      live stack. Everything around it is covered by tests; the camera and the
      60-second token expiry are not.

- [ ] **manual — Work out why the verification email does not arrive.**
      `egarc207@uic.edu` registered on 2026-09-01 and is still unverified; no
      link reached the inbox or spam. Everything on this side has been ruled
      out by direct check: the app calls `sendEmailVerification` (confirmed in
      the deployed bundle), `accounts:sendOobCode` with `VERIFY_EMAIL` is
      reachable on the production browser key (rejects only the token),
      `verifyEmailTemplate` and `callbackUri` are configured, the hosted
      handler at `/__/auth/action` serves on both domains, and
      `accounts:sendOobCode` with `returnOobLink` mints a valid link for that
      exact account. What is left is delivery: mail leaves as
      `noreply@shpe-webapp.firebaseapp.com` with `dnsInfo.customDomainState`
      still `NOT_STARTED`, so nothing aligns it to a domain UIC's Microsoft 365
      tenant trusts. Check the UIC quarantine portal first — the message may be
      held rather than missing — then either configure custom SMTP
      (`notification.sendEmail.method`) on a domain with real SPF/DKIM, or ask
      UIC IT to allowlist the sender. Until then a member can be unblocked with
      `accounts:sendOobCode` + `returnOobLink=true` and the link handed over
      directly.

- [ ] **manual — Delete the email-verification test account.** The real-inbox
      pass creates a live `@uic.edu` account on the production tenant. Remove
      both halves when it is done: the Firebase user *and* its `users` row
      (`check_ins` cascades, `announcements` and `audit_log` null out). Leaving
      it behind puts a phantom member on the roster every officer can see.

- [ ] **manual — Archive `Esgartaq04/shpe-web-app`.** The mirror existed only
      because the old hosts could not build from the team repository. Nothing
      pushes to it now.

## Housekeeping

- [x] Delete the stale local branch `ci/skip-deploy-on-docs-only`. It carries
      duplicate copies of the avatar commits; pushing it would drag unrelated
      work into that PR. Its real work is already merged.

- [ ] Make `env.ts` validation lazy per entry point. Today it validates every
      required variable on import, so the migration job has to be handed a
      QR-signing secret it never uses. Each entry point should require only
      what it actually reads.

- [ ] Consider an `expo lint` rule or a CI check that catches
      `frontend/package.json` dependencies with no importer, so the peer-only
      ones stay documented rather than rediscovered. See the note in the
      README's repository layout section before removing anything there.

## Security

- [x] **Rotated 2026-08-31.** A committed Terraform plan archive exposed the
      database password, `CHECKIN_TOKEN_SECRET`, and `SYNC_SECRET` in a public
      repository. All three were regenerated and the service redeployed, so
      the exposed values are dead. `.gitignore` now covers plan archives,
      which the existing `*.tfstate` rules did not.

      The old values remain in git history and in any clone or fork made
      before the rotation. That is accepted: rotation is what makes them
      worthless, and rewriting public history would break every clone while
      GitHub may still serve the old commit from cache. If the repository is
      ever made private-then-public again, or a secret scanner flags it,
      point at this entry.

- [ ] Consider enabling GitHub secret scanning and push protection on the
      repository. It is free for public repositories and would have caught
      the above before it was pushed.

## Deferred features

These are visible in the app as _Coming soon_ rather than hidden, so nobody
mistakes them for broken:

- [ ] **Google sign-in.** Harder than it looks now: client-side signup is
      disabled at the platform level to keep the `@uic.edu` rule enforceable,
      so federated sign-in needs either pre-linked accounts or a Firebase
      blocking function that applies the same domain check.
- [ ] **Password reset.** Closer than it was: the email-verification work
      proved most of the out-of-band path — Firebase's hosted action handler at
      `/__/auth/action` and the message template both check out — so this is a
      `sendPasswordResetEmail` call and a screen. It is **blocked on the same
      delivery question** as verification, though: reset mail goes out the same
      way, from the same unaligned sender, so shipping it before that is
      answered just adds a second feature nobody receives.
- [ ] **Notifications**, **RSVP**, and **privacy settings**. Designed in the
      superpowers specs, never built.
- [x] **The first Top 8 is still a SQL step.** Documented in
      [PERMISSIONS.md](PERMISSIONS.md#the-first-top-8-has-to-be-made-by-hand);
      everything after the first one happens in the app.

## Test coverage not yet taken

The suites cover the privilege guards, the auth lifecycle, the avatar flow,
and the pure logic. Still uncovered, in rough order of value:

- [ ] `routes/events.ts` and `routes/announcements.ts` at the route level —
      particularly that a draft is invisible to a member and visible to an
      officer, which is a documented rule with nothing enforcing it in CI.
- [ ] `routes/checkIns.ts` — the duplicate-scan rejection relies on a unique
      index, so it needs a real database rather than a mock to test honestly.
- [ ] `calendar/sync.ts` — the re-entrancy guard that stops two syncs
      overlapping.
- [ ] The remaining screens and data hooks (`dashboard`, `events`, `home`,
      `organizer`, `lib/checkIns.ts`, `lib/adminStats.ts`).
