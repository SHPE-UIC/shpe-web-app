# Infrastructure

Everything the app runs on in GCP, as Terraform. Two stacks:

- **`bootstrap/`** — run once with local state. Creates the GCS bucket the
  main stack keeps its state in, and enables the APIs Terraform itself needs.
- **`.` (this directory)** — the app: Cloud Run service + migration job,
  Cloud SQL Postgres, Artifact Registry, Secret Manager, Firebase
  Hosting/Auth, Cloud Scheduler, uptime alerting, and the Workload Identity
  Federation plumbing GitHub Actions deploys through.

## First-time setup

```bash
# 0. One-time prerequisites (human, in the console):
#    - link a billing account to the project (Cloud SQL is ~$10-13/mo)
#    - gcloud auth application-default login

# 1. Bootstrap the state bucket (local state, gitignored)
cd infra/bootstrap
terraform init
terraform apply -var project_id=<PROJECT_ID>

# 2. Main stack
cd ..
cp terraform.tfvars.example terraform.tfvars   # then fill it in
terraform init -backend-config="bucket=<PROJECT_ID>-tfstate"
terraform apply
```

Then the steps Terraform cannot do:

1. **Share the Google Calendar** with the `api_runtime_service_account`
   output ("See all event details").
2. **GitHub repository settings** (repo named in `github_repository`):
   - Secrets: `GCP_WIF_PROVIDER` (= `wif_provider` output),
     `GCP_DEPLOYER_SA` (= `deployer_service_account` output),
     `GCP_TERRAFORM_SA` (= `terraform_service_account` output).
   - Variables: `GCP_PROJECT_ID`, `API_URL` (= `api_url` output), the four
     `EXPO_PUBLIC_FIREBASE_*` values (= `firebase_web_config` output), and
     `GOOGLE_CALENDAR_ID` / `ALERT_EMAIL` for the Infrastructure workflow.
3. Run the **Deploy** workflow once (workflow_dispatch) to push the first
   real image and site build.

## Changing infrastructure after the first apply

Open a pull request touching `infra/**` and the **Infrastructure** workflow
plans it and posts the plan as a comment, so the diff is reviewed rather than
described. Merging does **not** apply it.

To apply, start the workflow by hand — Actions → Infrastructure → Run
workflow → tick *Apply*. It runs in the `infra` environment, which requires
one of its listed reviewers to approve the run, and cannot be approved by
whoever started it. Applying from a laptop still works and is equivalent
(`terraform apply` with the tfvars below); the workflow exists so infra
changes leave the same trail code changes do.

Why apply is not automatic: the workflow's service account
(`shpe-terraform`) holds `roles/resourcemanager.projectIamAdmin` among other
per-service admin roles, because Terraform manages the project's IAM. Anyone
who can trigger an apply can therefore change who has access to the project.
That is a deliberate, reviewable step, not a side effect of merging.

The workflow reads `project_id`, `google_calendar_id` and `alert_email` from
repository variables instead of `terraform.tfvars`, which stays gitignored.
`github_repository` is not a variable — it comes from `${{ github.repository }}`,
so it always names whichever repository the workflow is running in.

## If the repository is renamed or transferred

The WIF provider is pinned to the full `owner/repo`, so a move breaks every
workflow that authenticates to GCP — both Deploy and Infrastructure. Because
Infrastructure authenticates the same way, **CI cannot repair this itself**;
the first fix has to come from a machine with owner credentials.

Three things in GCP carry the old name and must be repointed: the provider's
`attributeCondition`, and the `roles/iam.workloadIdentityUser` binding on each
of `shpe-deployer` and `shpe-terraform`. Repair the bindings first, then the
condition. Update `github_repository` in your local `terraform.tfvars` at the
same time, or the next local apply will undo the fix.

If you repair with `gcloud` rather than Terraform, make the stored condition
match what `wif.tf` renders character for character — spaces around `==`, double
quotes, and the organization's exact capitalization. A valid-but-differently
spelled expression authenticates fine and then shows as permanent drift.

Worked example, including the state reconciliation it leaves behind:
[org-migration-fix.md](../org-migration-fix.md).

## Design notes

- **CI owns the image.** The Cloud Run service and job are created with a
  placeholder image and `ignore_changes` on it; `gcloud run deploy` /
  `gcloud run jobs update` in CI never fight Terraform.
- **Database access** is Cloud SQL's managed unix socket only: the instance
  has a public IP but no authorized networks, so the connectors (and their
  IAM checks) are the only way in. No VPC connector to pay for. A later
  private-VPC upgrade touches `sql.tf`'s `ip_configuration` plus a VPC
  connector on the service.
- **Secrets live twice**: in Secret Manager (what the service reads) and in
  Terraform state (how they were generated). The state bucket is private and
  versioned; treat access to it as access to production.
- **Identity Platform and the Firebase attachment are one-way.** Neither can
  be disabled once enabled; `terraform destroy` requires
  `terraform state rm google_identity_platform_config.auth` first.
- **The scheduler's sync secret** is visible to anyone with project read
  access; its blast radius is "can trigger a calendar sync".
