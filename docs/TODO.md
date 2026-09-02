# Todo

What is outstanding, and who has to do it. Things that only a person with
console access can do are marked **manual** — they cannot be scripted from
this repository.

## Do these next

- [x] **Done 2026-09-02 — Terraform state reconciled.** The phantom `2 to add`
      is gone: the applies run during the mail-domain work cleared it, and
      plans since have reported only their own changes. Background:
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

- [x] **Done 2026-09-02 — test accounts removed.** `steve@uic.edu` and
      `nailong@uic.edu` are gone, both halves each: the Firebase user and the
      `users` row. `nailong` held **role 2**, so a test account carried the
      full admin surface — worth remembering when the next one is created.
      `grami23@uic.edu` is now the only Top 8; a second one is worth making,
      because recovering from the loss of that single account means a SQL
      `UPDATE` against Cloud SQL with the database password.

- [x] **Done 2026-09-02 — the app serves from `shpeuicapp.org`.** Attached to
      Firebase Hosting alongside the `.web.app` name rather than instead of it,
      so nothing pointing at the old URL broke. All five pieces landed:
      `google_firebase_hosting_custom_domain`, the `A` and ownership `TXT`
      records in [`infra/dns.tf`](../infra/dns.tf), `authorized_domains`, and
      `cors_origins`. The two that would have failed quietly were the last two
      — sign-in is refused from an unlisted origin and the API rejects its
      fetches, which together read as a broken app rather than as
      configuration.

      **The email action URL is still on `firebaseapp.com`.** Moving it was the
      point of attaching the domain, and both the Firebase console and the
      Admin API refuse the change with `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`.
      `notification.sendEmail.dnsInfo.customDomainState` is `NOT_STARTED`,
      which may be the prerequisite or may be unrelated. Unresolved, and worth
      fresh eyes — a verification link whose domain has nothing to do with its
      sender is one of the signals working against delivery. See
      [EMAIL-DELIVERY.md](EMAIL-DELIVERY.md).

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
  values it is about to write, which is exactly how the 2026-08-31 leak
  below happened
- Service-account keys. This project has none; deploys authenticate through
  Workload Identity Federation, and it should stay that way
- Dumps of the Identity Platform config (`config-backup*.json`, gitignored).
  They carry `signIn.hashConfig.signerKey`, which unlike the values below
  **cannot be rotated** — see the 2026-09-02 entry

If a secret is committed, **say so immediately** rather than quietly force
pushing it away — GitHub may still serve the old commit from cache, and any
clone or fork made in the meantime keeps it. Rotation is what makes an exposed
value worthless, and it takes minutes. Nobody is in trouble for reporting one.

- [ ] **2026-09-02 — `signerKey` exposed briefly, and cannot be rotated.** A
      dump of the Identity Platform config was committed to a pushed branch on
      this public repository for a few minutes before being removed by a force
      push. It carried `signIn.hashConfig.signerKey` and `saltSeparator`. The
      SendGrid API key was **not** in it — the config API does not return the
      SMTP password — and the Firebase browser key it also contains is public
      by design.

      The signer key is a SCRYPT parameter. On its own it grants nothing: it is
      only useful alongside the password hash database, which lives inside
      Firebase and was not exposed. So this is a loss of defence in depth, not
      a compromise.

      **Unlike the entry below, there is no rotation.** Firebase exposes no way
      to change a project's password hash parameters without re-hashing every
      password, and no API for that. Two things remain worth doing: ask GitHub
      Support to garbage-collect the unreachable commit, since a force push
      leaves it addressable by SHA, and leave this entry here so a future
      secret-scanner hit has something to point at.

      `config-backup*.json` is now in `.gitignore`, and
      [DEPLOYMENT.md](DEPLOYMENT.md#member-email) says not to write config dumps
      into the repository at all.

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
- [ ] **Password reset.** No longer blocked. The sender question that held it
      back is answered — mail sends from `noreply@shpeuicapp.org` through
      SendGrid and authenticates, see
      [EMAIL-DELIVERY.md](EMAIL-DELIVERY.md) — and the hosted action handler
      and templates were already proven. What is left is a
      `sendPasswordResetEmail` call and a screen. Worth confirming when it
      ships that reset mail carries the same From address as verification
      mail: `smtp.senderEmail` should govern every template, but only the
      verification path has actually been observed.
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
