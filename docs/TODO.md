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

- [ ] **manual — Try a QR check-in end to end.** Sign in as a Top 8, open an
      event's organizer screen, and scan the code with a second account. It is
      the one member-facing flow that has never been exercised against the
      live stack. Everything around it is covered by tests; the camera and the
      60-second token expiry are not.

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

- [ ] **Delete the `dev` and `stage` branches.** The promotion pattern they
      served is retired — every change now goes from a short-lived branch
      straight to `main`, per [CONTRIBUTING.md](../CONTRIBUTING.md#branching).
      Both are 79 commits behind `main` and 0 ahead, so nothing is lost by
      deleting them; leaving them invites someone to branch from a version of
      the app that predates the GCP migration.

- [ ] Consider a formatter. There is no Prettier config and the backend has no
      linter at all, so style is convention plus review — which is what
      CONTRIBUTING now documents rather than fixes. Adding one would reformat
      the whole repository, so it wants its own ticket and a quiet moment.

## Security

**What must never be committed**, and what to do if it is. This is the
reference [CONTRIBUTING.md](../CONTRIBUTING.md) points at:

- `.env` files, or anything else holding a secret
- `terraform.tfvars`, and Terraform **plan archives** — a plan embeds the
  values it is about to write, which is exactly how the leak below happened
- Service-account keys. This project has none; deploys authenticate through
  Workload Identity Federation, and it should stay that way

If a secret is committed, **say so immediately** rather than quietly force
pushing it away — GitHub may still serve the old commit from cache, and any
clone or fork made in the meantime keeps it. Rotation is what makes an exposed
value worthless, and it takes minutes. Nobody is in trouble for reporting one.

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
- [ ] **Password reset.** Firebase Authentication makes this close to free —
      it is a sendPasswordResetEmail call plus an authorized action URL.
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
