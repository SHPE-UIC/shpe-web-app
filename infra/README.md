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
     `GCP_DEPLOYER_SA` (= `deployer_service_account` output).
   - Variables: `GCP_PROJECT_ID`, `API_URL` (= `api_url` output), and the
     four `EXPO_PUBLIC_FIREBASE_*` values (= `firebase_web_config` output).
3. Run the **Deploy** workflow once (workflow_dispatch) to push the first
   real image and site build.

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
