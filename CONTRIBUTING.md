# Contributing

Everything you need to get a change merged, in the order you will need it.

New here? Start with the README's [Running it
locally](README.md#running-it-locally) and come back once the app is up.

- [Before you start](#before-you-start)
- [Branching](#branching)
- [Write the test first](#write-the-test-first)
- [Code style](#code-style)
- [Commits](#commits)
- [Pull requests](#pull-requests)
- [What merging does](#what-merging-does)
- [Infrastructure changes](#infrastructure-changes)
- [Never commit](#never-commit)

---

## Before you start

**Every change starts from a Jira ticket.** If there is no ticket for what you
are about to do, make one — the branch is named after it, so there is nowhere
to put the work otherwise.

Read the docs covering what you are touching. They are short, and they explain
the *why*, which the code alone cannot:

| Doc | When to read it |
|---|---|
| [README.md](README.md) | Local setup, how the pieces work, the check commands |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md) | Anything touching roles, endpoints, or member data |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How a request, a deploy, or the calendar sync flows |
| [docs/TODO.md](docs/TODO.md) | What is already known to be outstanding |

---

## Branching

**Branch from `main`.** It is the only long-lived branch.

> The old `dev` → `stage` → `main` promotion pattern has been retired. Both
> branches still exist and are 79 commits behind, untouched since 2026-08-07;
> they are scheduled for deletion. Do not branch from them, and do not merge
> into them. Every change goes from a short-lived branch straight to `main`
> through a pull request.

Name the branch after its Jira ticket, prefixed with the kind of work:

```text
<type>/SCRUM-<number>
```

```bash
git switch main && git pull
git switch -c feature/SCRUM-14
```

| Prefix | Use it for |
|---|---|
| `feature/` | New behaviour a member or officer can see |
| `bugfix/` | Something is broken and should not be |
| `hotfix/` | Production is broken right now |
| `docs/` | Prose only — README, `docs/`, comments |
| `chore/` | Dependencies, cleanup, renames; no behaviour change |
| `ci/` | Workflows, pipelines, repository tooling |
| `infra/` | Terraform, DNS, GCP configuration under `infra/` |

Examples: `feature/SCRUM-14`, `bugfix/SCRUM-12`, `ci/SCRUM-31`.

The ticket number is what ties a branch, its pull request, and the deploy that
carried it back to the reason any of it happened. A branch called `giselle` or
`QR-Pin` cannot answer "why is this here?" six months later.

---

## Write the test first

This repository is test-driven. The cycle:

1. **Red** — write the smallest test that describes what should happen.
2. **Watch it fail.** Not optional. A test you never saw fail has not been
   shown to catch anything — it may be asserting on the wrong thing entirely.
   Check that it fails *because the feature is missing*, not because of a typo.
3. **Green** — write the least code that passes it.
4. **Refactor** — clean up with the test still green.

Fixing a bug? The first step is a test that reproduces it. That test is what
proves the fix, and what stops the bug coming back.

### Where tests live

| Code | Test |
|---|---|
| `backend/src/validation.ts` | `backend/src/validation.test.ts` — beside it |
| `frontend/lib/`, `frontend/components/` | Beside it, same name + `.test.ts(x)` |
| A screen under `frontend/app/` | `frontend/__tests__/<screen>.test.tsx` |

**Never put a test file under `frontend/app/`.** Expo Router treats every file
in that tree as a route, so a test there becomes a screen *and* drags the test
library into the shipped bundle.

### What makes a test worth having

Assert on real behaviour, not on what a mock was called with — a test that only
proves `mockFn` ran tells you the mock works. Prefer the pure modules, where
the interesting cases are boundaries and need no database to exercise: the
calendar merge rule, the check-in window, the validation rules.

### Run everything before you push

```bash
npm run typecheck && npm test
```

```bash
cd frontend && npm test && npx tsc --noEmit && npx expo lint
```

---

## Code style

There is no formatter. The backend has no linter at all; the frontend has
`expo lint`. Style is therefore convention plus review — match the file you are
editing.

- TypeScript **strict**. No `any` you cannot justify in a comment.
- Single quotes, semicolons, two-space indent, trailing commas in multi-line
  literals, lines under about 100 columns.
- LF line endings, enforced by `.gitattributes`. On Windows, leave it alone.

### Comments say *why*, not *what*

This is the house style, and the thing most worth keeping. The code already
says what it does. A comment earns its place by explaining the reason, and the
best ones name the failure being avoided:

```ts
/**
 * Membership is restricted to UIC addresses.
 *
 * Anchored at both ends on purpose: a bare `includes('uic.edu')` would accept
 * `someone@uic.edu.example.com` and `someone@fake-uic.edu`, both of which are
 * addresses an outsider can actually obtain.
 */
```

"Validates the email" would have been worthless. Write the sentence that stops
the next person from simplifying your code back into a bug.

### Patterns to follow

- **Name every field at an API boundary.** `toPublicUser`
  ([backend/src/auth/user.ts](backend/src/auth/user.ts)) and `toPublicEvent`
  ([backend/src/routes/events.ts](backend/src/routes/events.ts)) list fields one
  by one rather than spreading and deleting, so a column added to the table
  later cannot leak through by accident. Build new response shapes the same way.
- **Screens never call `fetch`.** Every request goes through
  [frontend/lib/api/client.ts](frontend/lib/api/client.ts), behind a hook in
  `frontend/lib/`. The client attaches the Firebase ID token and turns error
  responses into typed `ApiError`s; bypassing it loses both.
- **`roles.ts` exists on both sides on purpose.** The server's copy decides what
  is allowed; the app's decides what to render. Changing one usually means
  changing both — and the server is the one that counts.
- **Never hand-write a migration.** Edit
  [backend/src/db/schema.ts](backend/src/db/schema.ts), run
  `npm run db:generate`, and commit what it produces.
- **Before pruning `frontend/package.json`**, read the note in the README's
  repository layout section. Several dependencies have no `import` anywhere and
  are still required as peers; removing them breaks the web export rather than
  the type check, so run `npx expo export --platform web` after touching it.

---

## Commits

Subject in the imperative mood, capitalised, no trailing period, no ticket
prefix — the branch already carries the ticket. Describe what changed for
someone using the code, not which files you edited.

```text
Let members describe their gender when they pick Other
Stop plans from proposing phantom Cloud SQL edits
Cover the guards that nothing was testing
```

Not `fixed icons loading in`, `Added stuff`, or `SCRUM-14: changes`.

If the change involved a decision — a trade-off, a rejected alternative, a
subtle failure you were avoiding — put it in the body. That is the part nobody
can reconstruct later.

---

## Pull requests

Open one against `main` and fill in the template. Small and reviewable beats
complete: a 200-line pull request gets read, a 2000-line one gets skimmed.

`main` is protected by the **Main Protection** ruleset. It has **no bypass
actors**, so every rule below applies to administrators too:

| Rule | What it means for you |
|---|---|
| **2 approving reviews** | Two people other than you must approve |
| **Conversations resolved** | Every review thread closed before merge |
| **`backend`, `frontend`, `plan` pass** | All three, every time |
| **Strict checks** | Your branch must be up to date with `main` |
| **Stale approvals dismissed** | Pushing after approval resets it |
| **No force pushes, no deletion** | `main`'s history is append-only |

### What CI runs, and what it does not

A prose-only pull request still reports all three checks — in seconds, without
running the suites or Terraform. The workflows trigger on *every* pull request
and decide inside whether to do the work.

That shape is deliberate. Filtering a workflow by path instead means it never
starts, so it never reports, and a required check that never reports is not
"passed" — it is pending forever. That combination once made every pull request
in this repository permanently unmergeable. If you touch
[.github/workflows/](.github/workflows/), keep the decision inside the job.

---

## What merging does

**Merging to `main` deploys to production.** In order: build the image, run
migrations as a Cloud Run job, deploy the API, then build and deploy the web
app.

Two things follow from that:

- A migration that cannot apply **stops the pipeline** before any new code
  serves traffic. That guard is deliberate — do not route around it.
- The web app deploys only after the API, so the app is never newer than the
  server it calls.

A docs-only merge skips the deploy entirely (`**.md`, `docs/**`, `infra/**`).

---

## Infrastructure changes

The Terraform in [infra/](infra/) owns the whole GCP project. A pull request
touching `infra/**` gets its plan posted as a comment automatically, so the
diff is reviewed rather than described.

**Applying is manual and gated.** Actions → Infrastructure → Run workflow →
tick *Apply*. It runs only from `main`, and one of the `infra` environment's
reviewers must approve — and it cannot be the person who started the run.

That is not ceremony. The workflow's service account holds
`roles/resourcemanager.projectIamAdmin`, so an apply can change who has access
to the entire project.

---

## Never commit

- `.env` files, or anything else holding a secret
- `terraform.tfvars`, and Terraform **plan archives**
- Service-account keys — this project has none, and it should stay that way

This is not hypothetical — it has happened here once, and the write-up is in
[docs/TODO.md](docs/TODO.md#security).

If you do commit a secret, say so immediately. Rotating it takes minutes;
staying quiet costs the chapter its database. Nobody is in trouble for
reporting one.
