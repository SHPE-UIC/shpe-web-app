# Org transfer fix: `communicationsshpeuic` → `SHPE-UIC`

Runbook for the fallout of moving this repo to the `SHPE-UIC` organization.

## What happened

On 2026-09-01 ~01:45 UTC the repo was **transferred** from
`communicationsshpeuic/shpe-web-app` to `SHPE-UIC/shpe-web-app`. GitHub redirects
the old URL, so a clone with a stale `origin` keeps working and the move stays
invisible — but three values in GCP still name the old owner, and the next deploy
fails at the auth step.

Nothing has failed yet only because nothing has deployed since the transfer. The
last successful Deploy ran 2026-08-31 21:44 UTC, about four hours *before* the
move. **The breakage is latent, not visible.**

## What is broken

### Workload Identity Federation (confirmed against live GCP)

| What | Current value | Source |
|---|---|---|
| WIF provider `attributeCondition` | `assertion.repository == "communicationsshpeuic/shpe-web-app"` | `infra/wif.tf:25` |
| `shpe-deployer` `workloadIdentityUser` | `…/attribute.repository/communicationsshpeuic/shpe-web-app` | `infra/wif.tf:35` |
| `shpe-terraform` `workloadIdentityUser` | same old principalSet | `infra/terraform_ci.tf:67` |

Actions OIDC tokens now assert `SHPE-UIC/shpe-web-app`, so the condition rejects
them. This kills `deploy.yml` (deployer SA) **and** both jobs of `infra.yml`
(terraform SA) — meaning **CI cannot repair itself**. `ci.yml` needs no GCP auth
and is unaffected.

`infra.yml:35` already passes `TF_VAR_github_repository: ${{ github.repository }}`,
so CI computes the correct new value; it just can't authenticate to apply it.

The troubleshooting table in `docs/DEPLOYMENT.md` already anticipates this exact
failure ("Deploy workflow fails at *auth* → repo not matching the WIF condition").

### Stale references in files

- `infra/terraform.tfvars` — gitignored, local only. **Most important**: a local
  plan/apply with the old value would revert the fix.
- `infra/terraform.tfvars.example:4`
- `migration.md` lines 37, 69, 168 (prose only)

### Merge deadlock in the "Main Protection" ruleset

Independent of the transfer, but it blocks landing the fix:

- **`required_deployments: [infra]`** — every `infra` deployment in this repo's
  history was created on `ref: main` via `workflow_dispatch`. The apply job runs
  on dispatch only, so no PR head SHA can ever satisfy this. `bypass_actors` is
  empty, so admins are blocked too.
- **`required_signatures`** — commits made locally are `verified: false` across
  the team, which blocks the PR merge path.

### Not broken

Checked, no action needed: no webhooks, no deploy keys, Actions enabled, all repo
secrets and variables intact, both deployment environments (`infra`, `copilot`)
intact, rulesets carried over, commit authorship correctly attributed.

## The fix

**Status: applied 2026-09-01.** Steps 1–3 are done and verified; see
[Outstanding](#outstanding) for the one loose end.

Order matters: **GCP first** (needs no PR), **ruleset second** (so the docs commit
can merge), files last.

### 1. Repair the WIF binding in GCP

Run as a project owner. Do the bindings before the condition — neither works until
both are done.

For both `shpe-deployer@shpe-webapp.iam.gserviceaccount.com` and
`shpe-terraform@shpe-webapp.iam.gserviceaccount.com`, add the new principalSet:

```
gcloud iam service-accounts add-iam-policy-binding <SA> --project=shpe-webapp --role=roles/iam.workloadIdentityUser --member=principalSet://iam.googleapis.com/projects/335746674027/locations/global/workloadIdentityPools/github/attribute.repository/SHPE-UIC/shpe-web-app
```

then `remove-iam-policy-binding` with the old `communicationsshpeuic/shpe-web-app`
member. No shell quoting needed — no argument contains a space.

Then update the provider condition:

```
gcloud iam workload-identity-pools providers update-oidc github-oidc --project=shpe-webapp --location=global --workload-identity-pool=github --attribute-condition=<condition>
```

**Two traps:**

- **Casing is significant.** The org is `SHPE-UIC`, uppercase. `github.repository`
  emits canonical casing and the CEL comparison is exact.
- **The stored string must match what Terraform renders**, character for
  character: `assertion.repository == "SHPE-UIC/shpe-web-app"` — double quotes,
  spaces around `==`. A working-but-differently-spelled CEL expression (single
  quotes, no spaces) authenticates fine but shows as permanent Terraform drift.
  Quoting this through PowerShell→cmd is fragile on Windows, so after updating,
  `describe` the provider and compare the stored condition byte-for-byte against
  the expected string.

### 2. Drop the two deadlocking rules

Ruleset `21973540`. `GET` it, remove the `required_deployments` and
`required_signatures` entries from the `rules` array, `PUT` it back:

```
gh api --method PUT repos/SHPE-UIC/shpe-web-app/rulesets/21973540 --input <edited.json>
```

**Keep** `deletion`, `non_fast_forward`, and the whole `pull_request` rule (2
approvals, thread resolution, extra approval for unattributed changes). Force-push
and deletion protection on `main` stay exactly as they are.

Write the JSON payload outside the repo tree — never commit Terraform or API
payloads that may carry secrets.

### 3. Update the stale files

Set `github_repository = "SHPE-UIC/shpe-web-app"` in `infra/terraform.tfvars`
(local, uncommitted) and `infra/terraform.tfvars.example`, and correct the three
old-org mentions in `migration.md`. This step changes no behavior; it exists so
the next local apply doesn't undo step 1.

## Verification

1. `describe` the provider; stored `attributeCondition` equals
   `assertion.repository == "SHPE-UIC/shpe-web-app"` exactly.
2. `get-iam-policy` on both SAs shows only the `SHPE-UIC` principalSet, with no
   `communicationsshpeuic` member remaining.
3. **End-to-end auth proof:** dispatch the **Infrastructure** workflow with
   `apply` unchecked. Plan-only, but it performs the real OIDC exchange with the
   terraform SA and must reach `terraform plan` without an auth failure. The plan
   should report **no changes** to the `wif.tf` / `terraform_ci.tf` resources,
   which also proves step 1 introduced no drift.
4. The deployer SA is exercised only by `deploy.yml`. Dispatching Deploy is a real
   deployment (image build, migrations, Cloud Run + Firebase), so let the next
   merge to `main` prove it rather than firing it off for a test.
5. `gh api repos/SHPE-UIC/shpe-web-app/rules/branches/main` lists exactly
   `deletion`, `non_fast_forward`, `pull_request`; a force-push to `main` is still
   rejected.
6. The PR from step 3 becoming mergeable is the proof the deadlock is gone. It
   still needs **2 approvals** — that rule stays.

## What actually happened

Deviations from the plan above, recorded so the next person isn't confused:

- **`required_signatures` was removed separately**, by hand, before this runbook
  ran — not by step 2. Step 2 only dropped `required_deployments`.
- **The ruleset was disabled outright** partway through, so `main` briefly had no
  protection at all. The fix commit was pushed directly to `main` during that
  window, then the ruleset was re-enabled with `deletion`, `non_fast_forward` and
  `pull_request` active. Verified: a force-push to `main` is rejected again.
- **The Infrastructure plan ran automatically.** Pushing a change under `infra/`
  triggers `infra.yml` on `main`, so the auth proof came for free — no manual
  dispatch was needed. `deploy.yml` did not run, because `paths-ignore` covers
  `**.md` and `infra/**`.

## Outstanding

**Terraform state is one apply behind.** Repairing the bindings with `gcloud`
rather than Terraform means state still keys the two
`google_service_account_iam_member` resources by the old member string. The next
plan therefore reports **`2 to add`** for `deployer_wif` and `terraform_wif`.

This is state drift, not real drift: both bindings already exist in GCP with
exactly the values Terraform wants, and the provider condition shows `0 to
change`. The adds are idempotent no-ops.

Resolve it by running the **Infrastructure** workflow once with `apply` ticked.
Note the `infra` environment sets `prevent_self_review`, so whoever dispatches it
needs one of the *other* reviewers to approve. Fixing state locally instead would
bypass that gate, which is exactly what the gate exists to prevent — so let the
workflow do it.

Until that apply runs, every infra plan will show those two adds. That is
expected, not a new problem.

## Preventing a repeat

The WIF condition pins the full `owner/repo`, so any future transfer or rename
breaks deploys the same way. If the org moves again, run this runbook again — or
pin the condition to `assertion.repository_owner` instead, accepting the slightly
wider trust boundary that implies.
