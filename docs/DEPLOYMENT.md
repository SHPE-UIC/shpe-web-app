# Deployment

Everything runs in one Google Cloud project, and everything in it is created
by the Terraform in [`infra/`](../infra/). This document is the operator's
view; [`infra/README.md`](../infra/README.md) has the resource-level notes.
The move off the old Vercel + Render + Neon stack is history now — the record
of it lives in [migration.md](../migration.md).

## The shape of it

| What | Where | Name |
|---|---|---|
| Web app | Firebase Hosting | `https://<project>.web.app` |
| API | Cloud Run service | `shpe-api` |
| Migrations | Cloud Run job | `shpe-migrate` |
| Database | Cloud SQL for PostgreSQL 17 | `shpe-pg` |
| Identity | Firebase Authentication (Identity Platform) | — |
| Images | Artifact Registry | `us-central1-docker.pkg.dev/<project>/shpe` |
| Secrets | Secret Manager | `shpe-*` |
| Calendar sync | Cloud Scheduler → `POST /api/sync/calendar` | `shpe-calendar-sync`, every 15 min |
| Alerting | Uptime check on `/healthz` → email | — |

Two service accounts, deliberately narrow:

- **`shpe-api-runtime`** — what the API runs as. Cloud SQL client, reads its
  three secrets, administers Firebase Auth users (registration), and reads
  the Google Calendar *because the calendar is shared with its email*, not
  through IAM.
- **`shpe-deployer`** — what GitHub Actions becomes via Workload Identity
  Federation. Deploys Cloud Run, pushes images, deploys Hosting. **There are
  no service-account keys anywhere.**

## How a deploy works

Push to `main` (or run the *Deploy* workflow manually):

1. Docker image is built and pushed as `shpe/api:<commit-sha>`.
2. The `shpe-migrate` job is updated to that image and executed with
   `--wait`. It runs `npm run db:migrate` over the Cloud SQL socket. **A
   migration that cannot apply stops the pipeline here** — the same
   guarantee the old Render build gave, before any new code serves traffic.
3. `gcloud run deploy shpe-api` rolls the service to the new image.
4. Only then is the web app exported (`expo export`) with the API URL and
   Firebase config inlined, and deployed to Firebase Hosting. Ordering the
   web deploy after the API kills the old "app is newer than the API" skew.

Terraform owns the *shape* of the Cloud Run service (env vars, secrets,
scaling, the Cloud SQL mount); CI owns the *image*. `ignore_changes` on the
image field keeps them from fighting.

## First-time setup

Follow [`infra/README.md`](../infra/README.md): bootstrap the state bucket,
`terraform apply`, then the three manual steps Terraform cannot do — share
the Google Calendar with the runtime service account, set the GitHub repo
secrets/variables from `terraform output`, and run the first deploy. The
production cutover from the legacy hosting (data migration, Firebase user
import, decommissioning) is scripted step-by-step in
[migration.md](../migration.md).

## Bootstrapping the first Top 8

Registering creates Member accounts. The first officer is a database step:

```bash
gcloud sql connect shpe-pg --user=shpe_api --database=shpe
```

```sql
UPDATE users SET role = 2 WHERE email = 'you@uic.edu';
```

Everyone after that is promoted in the app (Dashboard → View members).

## Costs

| Piece | Cost |
|---|---|
| Cloud SQL (`db-f1-micro`, HDD, zonal, 7 backups) | ~$10–13/mo — the entire bill, effectively |
| Cloud Run (scale to zero, max 2 × 512Mi) | ~$0 at chapter traffic |
| Firebase Hosting / Auth (<50k MAU) / Scheduler / Secret Manager / Artifact Registry | $0 or cents |

The instance tier is one line in `terraform.tfvars`-adjacent config
(`infra/sql.tf`) if the chapter outgrows it. `db-f1-micro` is a shared-core
machine with no SLA — fine for this scale, said out loud so nobody is
surprised.

## Troubleshooting

| Symptom | Likely cause | Where to look |
|---|---|---|
| Deploy workflow fails at *auth* | WIF secrets/variables missing or repo not matching the WIF condition | GitHub repo settings vs `terraform output wif_provider`; `infra/wif.tf` `github_repository` |
| Pipeline fails at *migrations* | Schema cannot apply — this is the guard working | Job logs: `gcloud run jobs executions list --job shpe-migrate` |
| API 500s, `/healthz` ok, `/healthz/db` 503 | Database unreachable | Cloud SQL instance state; the `DATABASE_URL` secret's socket DSN |
| Sign-in fails with `session_invalid` | App built with wrong Firebase config, or Identity Platform misconfigured | GitHub variables vs `terraform output firebase_web_config` |
| Registration 500s | Runtime SA missing `firebaseauth.admin`, or Identity Platform not enabled | `infra/iam.tf`, `infra/firebase.tf` |
| Browser calls fail with `cors_origin` 403 | `CORS_ORIGINS` doesn't include the Hosting URL | `infra/variables.tf` `cors_origins`, then `terraform apply` |
| Events not syncing | Calendar not shared with the runtime SA, or Scheduler job failing | Share settings on the calendar; Scheduler job logs; `POST /api/sync/calendar` with the `x-sync-secret` header |
| Cold requests take a few seconds | Scale-to-zero cold start | Expected. `min_instance_count = 1` in `infra/run.tf` buys it away for ~$10/mo |

## Logs

Everything the API writes to stdout lands in Cloud Logging:

```bash
gcloud run services logs read shpe-api --region us-central1 --limit 50
```

The uptime alert emails the address in `alert_email` when `/healthz` stops
answering.
