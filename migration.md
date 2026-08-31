# GCP Migration — Terraform + Cloud Run + Cloud SQL + Firebase Hosting/Auth

> **HISTORICAL.** This is the record of a migration that finished on
> 2026-08-30, kept for the reasoning and the bugs it caught. For how the
> system works today see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); for
> running it, [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). The Status section
> below is the accurate part; the plan under it is the original design, kept
> as written even where the build diverged from it.

## Context

The SHPE @ UIC app currently runs on free tiers: Expo web export on Vercel, Express API on Render, Postgres on Neon. The org wants everything consolidated onto its (already-created, nothing-enabled) GCP project, matching the target architecture diagram: Firebase Hosting (frontend), Cloud Run (backend), Cloud SQL for PostgreSQL, Artifact Registry, Secret Manager, Cloud Scheduler, Cloud Monitoring — **all provisioned via Terraform**. Per user decisions: **include the Firebase Auth swap** (replace self-hosted JWT sessions), **Cloud SQL via the managed socket connection** (no VPC connector — cheaper, upgradeable later), **GitHub Actions + Workload Identity Federation** for CI/CD (no SA keys), **default `*.web.app` / `*.run.app` URLs** for now.

Current stack facts that shape everything: backend is Express 5 + TS run via `tsx` (no build step; deps in root `package.json`), frontend is Expo SDK 54 web export (SPA, single build-time env `EXPO_PUBLIC_API_URL`), DB is Drizzle + `pg` with SQL migrations in `drizzle/` run from Render's buildCommand. No Dockerfile, no CI/CD, no Terraform exists. Auth is bcrypt + JWT ([backend/src/auth/tokens.ts](backend/src/auth/tokens.ts)) with roles in Postgres. Firebase is absent from code (old design superseded — this plan reintroduces only Auth + Hosting, not Firestore).

**Branch**: create `gcp-migration` off `free-deploy`. **Region**: `us-central1`. Three phases, each leaving the repo testable.

**Cost note (needs board sign-off)**: no longer $0 — ~$10–13/mo, dominated by Cloud SQL `db-f1-micro`. Everything else (Run scale-to-zero, Hosting, Identity Platform <50k MAU, Scheduler, Secret Manager) rounds to $0. Billing account must be linked to the project.

---

## Status — 2026-08-30

The plan below is the original design and is kept as written. This section is
the running record of what has actually been executed against
`shpe-webapp` (project number 335746674027, `us-central1`).

**Phase A — infrastructure provisioned, pipeline partially proven.**

- [x] Billing linked; `gcloud auth login` + `application-default login`
- [x] `infra/bootstrap` applied — state bucket `shpe-webapp-tfstate`
- [x] `infra/` applied — all resources live: Cloud SQL `shpe-pg`, Cloud Run
      `shpe-api` + job `shpe-migrate`, Artifact Registry, four Secret Manager
      secrets, both service accounts, WIF pool/provider, Scheduler,
      uptime check and alert policy, Firebase project/site/web app,
      Identity Platform config
- [x] GitHub secrets and variables set on `communicationsshpeuic/shpe-web-app`
- [x] `gcp-migration` merged to `main` (merge commit `3ab4b494`)
- [x] First Deploy run: WIF auth succeeded, image built and pushed to
      Artifact Registry
- [x] **Migration job green** — Deploy run `33338138397` (the Bug 2 fix)
      completed end to end in 5m30s: image, migrations, API, Hosting
- [x] `/healthz/db` returns `{"ok":true,...}` against Cloud SQL
- [x] `shpe-webapp.web.app` serves the app — login screen renders, bundle,
      fonts and assets all 200, SPA rewrite works on deep links
- [x] Scheduler-fired calendar sync verified — the 15-min tick and a forced
      run both 200; a forced `?full=1` sync returned
      `{"seen":1,"updated":1,"fullSync":true}`
- [x] Calendar shared with `shpe-api-runtime@shpe-webapp.iam.gserviceaccount.com`
      — proven by the successful full sync (a 404 would mean unshared)
- [ ] Cloud Monitoring notification-channel email verified — **unconfirmed**;
      until someone clicks the link, the alert policy delivers nothing

**Phase B — merged and exercised.** `/healthz/db` and the sync path proved the
container, DB, secrets and ADC wiring; registration was then proven on the real
tenant when two `@uic.edu` accounts were created through the Firebase flow (see
Phase C item 5). Identity Platform runs with `disabled_user_signup = true`, so
the `@uic.edu` gate holds — the API is the only thing that can create an
account.

**Phase C — scope reduced, barely started.** See the revised phase below.

### Deviations from the plan

- **No data migration.** The legacy Neon/Render deployment holds test data
  only, so C4 (freeze + `pg_dump`/`pg_restore`) and C5 (Firebase user import)
  are cancelled. `scripts/import-users-to-firebase.ts` is retained unused —
  it costs nothing and is the right tool if users ever need importing.
- **Deploy repo is the team repo**, `communicationsshpeuic/shpe-web-app`, so
  the app outlives any one officer's term. The WIF condition is pinned to it;
  Actions run from anywhere else will fail at the auth step.
- **`.gitattributes` added** (`* text=auto eol=lf`). Editing on Windows made
  every file read as fully rewritten; without this, ~150 files show as
  modified and any PR is unreviewable.

### Bugs found by the first execution

Both had been sitting in the committed code since it was written. Neither is
findable without an apply — which is the point worth remembering.

1. **`google_identity_platform_config` was missing `provider = google-beta`**
   ([infra/firebase.tf](infra/firebase.tf)). Every other Firebase resource
   declares it; this one didn't, so it ran on the default provider without
   `user_project_override` and billed the call to a Google-owned default
   project, failing with a 403 `SERVICE_DISABLED` on
   `identitytoolkit.googleapis.com` — misleading, since that API *is* enabled
   on `shpe-webapp`. Fixed in `10376c9c`. Note that
   `gcloud auth application-default set-quota-project` does **not** fix this:
   the Terraform provider does not read the ADC quota project, it only sends
   `X-Goog-User-Project` when `user_project_override` is set.

2. **The `shpe-migrate` job mounted only `DATABASE_URL`**
   ([infra/run.tf](infra/run.tf)). [env.ts](backend/src/env.ts) validates
   *every* required variable at import time, and `migrate.ts` imports it
   transitively through the db client, so the job threw on
   `CHECKIN_TOKEN_SECRET` before applying a single migration. The same bug
   existed in Phase A against `JWT_SECRET`. Fixed by mapping the secret into
   the job. Do not patch this with `gcloud run jobs update` — Terraform owns
   the job's shape and `ignore_changes` covers only the image, so the next
   apply would silently strip it back out.

   The deeper issue is `env.ts`'s all-or-nothing validation: a migration job
   has no business needing a QR-signing secret. Making validation lazy, so
   each entry point requires only what it uses, is the right follow-up — but
   not mid-cutover.

3. **Google's frontend reserves the exact path `/healthz` on `run.app` URLs**
   and answers its own 404 before the request reaches the container —
   `curl /healthz` returns a Google-branded error page with no Cloud Run
   headers, and no such request ever appears in the service's request logs,
   while `/healthz/db` (and every other path) passes through. The container's
   startup probe is unaffected: probes bypass the frontend, which is why
   deploys went green while the public path 404'd. Consequence: the uptime
   check, pointed at `/healthz`, had been failing since creation against a
   healthy service. Fixed in `f18f76df` by pointing it at `/healthz/db`,
   which also makes a database outage trip the alert. The same commit
   declares the disabled `phone_number` sign-in block that the Identity
   Platform API echoes back on every read, ending a phantom in-place update
   on every plan.

---

## Phase A — Terraform infra, container, CI/CD *(executed — see Status)*

### A1. Terraform (`infra/`)

```
infra/
  bootstrap/main.tf     # one-time, LOCAL state: GCS state bucket <project>-tfstate
                        # (versioned, uniform access, public-access-prevention) + enables
                        # serviceusage + cloudresourcemanager APIs
  versions.tf backend.tf providers.tf variables.tf terraform.tfvars.example outputs.tf
  apis.tf iam.tf wif.tf sql.tf secrets.tf run.tf firebase.tf scheduler.tf monitoring.tf
  README.md
```

- **Providers**: `google` + `google-beta` (beta needed for `google_firebase_*` resources, with `user_project_override = true`). Backend: `gcs` bucket `<project>-tfstate`.
- **apis.tf**: `google_project_service` for_each, `disable_on_destroy = false`: run, sqladmin, artifactregistry, secretmanager, cloudscheduler, iam, iamcredentials, sts, firebase, firebasehosting, identitytoolkit, calendar-json, logging, monitoring, compute.
- **sql.tf**: `google_sql_database_instance "main"` — `shpe-pg`, POSTGRES_17, ENTERPRISE `db-f1-micro`, ZONAL, PD_HDD 10GB autoresize, backups on (7, no PITR), `ip_configuration { ipv4_enabled = true }` with **no authorized networks** (reachable only through Cloud SQL connectors/socket), `deletion_protection = true`. Plus database `shpe`, user `shpe_api` (password from `random_password`).
- **secrets.tf**: Secret Manager secrets + versions: `shpe-db-password`; `shpe-database-url` = socket DSN `postgresql://shpe_api:<pw>@localhost/shpe?host=/cloudsql/<connection_name>`; `shpe-jwt-secret`; `shpe-sync-secret` (all `random_password`). `GOOGLE_CALENDAR_ID` is a plain env var, not a secret.
- **iam.tf**: SA `shpe-api-runtime` (`roles/cloudsql.client` + per-secret `secretAccessor`; Phase B adds `roles/firebaseauth.admin`). SA `shpe-deployer` (`roles/run.developer`, `iam.serviceAccountUser` on runtime SA only, `artifactregistry.writer` on the repo, `firebasehosting.admin`, `serviceusage.serviceUsageConsumer`). Artifact Registry docker repo `shpe`.
- **wif.tf**: WIF pool + GitHub OIDC provider, `attribute_condition` pinned to `var.github_repository`; `roles/iam.workloadIdentityUser` on deployer SA for that repo's principalSet.
- **run.tf**: `google_cloud_run_v2_service "shpe-api"` — runtime SA, min 0 / max 2, 1 CPU / 512Mi, Cloud SQL volume mount `/cloudsql`, envs (`NODE_ENV=production`, `DISABLE_SYNC_LOOP=1`, `CORS_ORIGINS`, `GOOGLE_CALENDAR_ID`, `CHECKIN_TOKEN_TTL_SECONDS`) + secret refs (`DATABASE_URL`, `JWT_SECRET`, `SYNC_SECRET`). **First-apply image pattern**: `image = var.api_image` defaulting to `us-docker.pkg.dev/cloudrun/container/hello`, with `lifecycle { ignore_changes = [template[0].containers[0].image, client, client_version] }` — Terraform owns shape, CI owns image. `run.invoker` → `allUsers` (public API, same posture as Render). Also `google_cloud_run_v2_job "shpe-migrate"` — same SA/volume/`DATABASE_URL`, command `npm run db:migrate`, max_retries 0.
- **firebase.tf**: `google_firebase_project`, `google_firebase_web_app` + web-app config data source (outputs the frontend config values), `google_firebase_hosting_site` (`site_id = var.project_id` → `https://<project>.web.app`), `google_identity_platform_config` — email/password sign-in enabled, authorized domains, and **`client { permissions { disabled_user_signup = true } }`** (load-bearing: preserves the @uic.edu gate by forcing all user creation through the backend Admin SDK). Document: Identity Platform + Firebase attachment are one-way (can't destroy).
- **scheduler.tf**: `google_cloud_scheduler_job` every 15 min, POST `<run-url>/api/sync/calendar` with header `x-sync-secret` (header-secret over OIDC: the endpoint already implements it in [backend/src/routes/sync.ts](backend/src/routes/sync.ts) and the service is public anyway; blast radius = triggering a sync).
- **monitoring.tf**: uptime check on `/healthz` + email notification channel + one alert policy.
- `.gitignore`: add `infra/**/.terraform/`, `*.tfstate*`, `terraform.tfvars`. Note in README: tfstate contains secret values; bucket is private+versioned.

### A2. Container

- **`Dockerfile`** (repo root — WORKDIR must be root so `migrate.ts`'s cwd-relative `migrationsFolder: 'drizzle'` resolves): `node:22-slim` → `npm ci --omit=dev` (tsx + drizzle-orm are runtime deps — sufficient) → copy `tsconfig.json`, `drizzle/`, `backend/` → `USER node` → `CMD ["npm","start"]`. Cloud Run injects `PORT=8080`; [env.ts](backend/src/env.ts) already honors it.
- **`.dockerignore`**: node_modules, frontend, .git, .env*, infra, docs, .github, *.md.
- **Migrations**: Cloud Run Job `shpe-migrate`, executed by CI before each deploy — same fail-loud guarantee as Render's buildCommand.

### A3. Phase A code changes

1. **[backend/src/db/index.ts](backend/src/db/index.ts)** — extract a testable `sslConfigFor(url)`: socket DSNs (`host=/cloudsql/...`) and localhost → no SSL; else `{ rejectUnauthorized: true }`. Keep `max: 5` (fits db-f1-micro's connection ceiling at max 2 instances). New unit test for DSN classification.
2. **[backend/src/calendar/serviceAccount.ts](backend/src/calendar/serviceAccount.ts) + googleCalendar.ts** — ADC fallback: return `null` instead of throwing when neither env var set; `GoogleAuth({ credentials: creds ?? undefined, scopes })` → on Cloud Run uses the runtime SA via metadata server. Calendar access = share the calendar with `shpe-api-runtime@<project>.iam.gserviceaccount.com`. Keep JSON/key-path branches for local dev.
3. Sync loop: no code change — `DISABLE_SYNC_LOOP=1` env (already implemented) + Scheduler replaces it.

### A4. CI/CD (`.github/workflows/`)

- **`ci.yml`** (PR + push): root `npm ci && npm run typecheck && npm test`; frontend `npm ci && npx tsc --noEmit && npm test`.
- **`deploy.yml`** (push to `main` + workflow_dispatch; `permissions: id-token: write`):
  - **deploy-api**: checkout → `google-github-actions/auth@v2` (WIF provider + deployer SA from repo secrets) → docker build/push `us-central1-docker.pkg.dev/<project>/shpe/api:$SHA` → `gcloud run jobs update shpe-migrate --image` + `execute --wait` (failed migration halts pipeline) → `gcloud run deploy shpe-api --image`.
  - **deploy-web** (`needs: deploy-api` — kills the deploy-skew problem): `cd frontend && npm ci` → `npx expo export --platform web` with `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_FIREBASE_*` from GitHub **variables** (public-by-design values) → `npx firebase-tools deploy --only hosting` (firebase-tools reads the WIF external-account ADC that auth@v2 writes; pin the CLI version — no SA-key-based action).
- **`firebase.json`** (repo root): hosting site, `public: "frontend/dist"`, SPA rewrite `** → /index.html` (replaces [frontend/vercel.json](frontend/vercel.json)). Plus `.firebaserc`.
- Manual GitHub setup (runbook): secrets `GCP_WIF_PROVIDER`, `GCP_DEPLOYER_SA`; variables `GCP_PROJECT_ID`, `API_URL`, `EXPO_PUBLIC_FIREBASE_*` — all from `terraform output`. Recommend running Actions on the team repo (`communicationsshpeuic/shpe-web-app`, `main`) so the `personal` mirror can retire; WIF condition can allow both during transition.

**Exit criteria**: `terraform apply` clean; pipeline green; `/healthz/db` OK against Cloud SQL; Scheduler-fired sync works (verifies ADC Calendar access — flagged as the likeliest integration to need a tweak; escape hatch env vars retained); `<project>.web.app` serves the app against the Cloud Run API. Render/Vercel/Neon untouched, both test suites green.

---

## Phase B — Firebase Auth swap *(merged, unverified — see Status)*

**Model**: registration stays a backend endpoint (server-side `admin.auth().createUser` after the existing @uic.edu validation — client signup disabled at platform level). Firebase `uid` = Postgres `users.id`; new `firebase_uid` column records linkage. **QR check-in tokens stay local HS256 JWTs** (60s capability tokens, not sessions) — `JWT_SECRET` renamed `CHECKIN_TOKEN_SECRET` in code (Secret Manager secret name can stay); `SESSION_TTL` dies (Firebase SDK manages sessions).

- **Backend**: add `firebase-admin` (ADC init, new `backend/src/auth/firebase.ts`); [tokens.ts](backend/src/auth/tokens.ts) keeps only checkin sign/verify; [middleware/auth.ts](backend/src/middleware/auth.ts) `requireAuth` → `verifyIdToken` + lookup by `firebase_uid` (requireBoard/requireTop8 unchanged — roles stay in Postgres); [routes/auth.ts](backend/src/routes/auth.ts): `/register` creates Firebase user + row, returns `201 {user}` (no token); `/login` deleted; `/me` unchanged; remove `bcryptjs`; [env.ts](backend/src/env.ts): drop `jwtSecret`/`sessionTtl`, add required `checkinTokenSecret`. Drizzle migration `0004`: add `firebase_uid` (unique), make `password_hash` nullable (drop it in a post-cutover cleanup migration).
- **User import**: new `scripts/import-users-to-firebase.ts` (manual, at cutover) — `admin.auth().importUsers` with `hash: { algorithm: 'BCRYPT' }`, `uid = users.id`, batches ≤1000, idempotent; then set `firebase_uid = id`. Members keep their passwords.
- **Frontend**: add `firebase` JS SDK; new `frontend/lib/firebase.ts` from 4 `EXPO_PUBLIC_FIREBASE_*` vars; [client.ts](frontend/lib/api/client.ts) gets token from `auth.currentUser?.getIdToken()`; [AuthContext.tsx](frontend/contexts/AuthContext.tsx) rewritten around `onIdTokenChanged` + `/api/auth/me` (login = `signInWithEmailAndPassword`; register = POST then sign in; logout = `signOut`); delete [tokenStore.ts](frontend/lib/tokenStore.ts); update `frontend/example.env`.
- **iam.tf**: add `roles/firebaseauth.admin` to runtime SA. **run.tf**: env rename.
- **Tests**: rewrite tokens/auth-middleware tests (mock firebase-admin), update jest setup + login/client tests (mock `firebase/auth`), swap `JWT_SECRET` → `CHECKIN_TOKEN_SECRET` in vitest config. Both suites must pass.
- **Local dev**: document Firebase Auth emulator (`FIREBASE_AUTH_EMULATOR_HOST` backend / `connectAuthEmulator` behind an `EXPO_PUBLIC_` flag).
- Deferred (documented follow-ups): Google sign-in (needs OAuth consent screen + blocking-function or pre-linking — the "coming soon" button stays honest), native secure-store persistence.

---

## Phase C — Cutover runbook + decommission *(revised: no data migration)*

Steps 4 and 5 of the original plan are cancelled — there is no production data
to carry across. What remains:

1. [x] Manual prereqs: billing linked; `gcloud auth application-default login`;
       `infra/bootstrap` applied, then `infra/` applied with real tfvars.
2. [x] Share the SHPE Google Calendar with
       `shpe-api-runtime@shpe-webapp.iam.gserviceaccount.com`
       ("See all event details") — confirmed working via full sync.
3. [x] GitHub secrets and variables set from `terraform output`.
4. [x] Pipeline green — Deploy `33338138397` and subsequent runs.
5. [x] Smoke test — `/healthz/db`, hosting + SPA rewrite, forced Scheduler
       sync, full re-import (`seen:1`). Registration proven on the real
       tenant: two `@uic.edu` accounts created 2026-08-30 through the
       Firebase flow (`firebase_uid` = row id, no password hash). Remaining
       in-app: a QR check-in round trip, possible now that a Top 8 exists.
6. [x] First Top 8 bootstrapped — `grami23@uic.edu` promoted to role 2 via
       the Cloud SQL Auth Proxy on 2026-08-30. Everyone after that is
       promoted in the app.
7. [x] Notification channel — resolved as a non-issue: email-type channels
       need no verification (that is an SMS concept); the channel reads
       `enabled: true` with no verification field. First real alert is the
       end-to-end proof.
8. [x] Decommission — the Render service, Vercel project, and Neon database
       were deleted on 2026-08-30 (rollback hold waived: test data only,
       nothing was migrated); both legacy URLs now 404. No external uptime
       pinger ever existed. The `personal` mirror push flow is retired; the
       mirror repo (`Esgartaq04/shpe-web-app`) can be archived at leisure.

9. [x] Cleanup commit: `render.yaml` and `frontend/vercel.json` deleted,
       migration banners dropped from `README.md` and `docs/DEPLOYMENT.md`
       (README now names the live URLs), and the `no_route` deploy-skew
       explainer retired from
       [client.ts](frontend/lib/api/client.ts) — deploys are ordered now.
       The cold-start "waking up" copy was already retired in Phase B.

**The migration is complete.** Everything serves from the `shpe-webapp` GCP
project.

A follow-up pass on 2026-08-31 finished the job in the code: comments still
describing Render, Neon, and a never-existent uptime pinger were corrected,
the last JWT-era dead code was removed, and `users.password_hash` was dropped.
That pass also found a **committed Terraform plan file** carrying the database
password, the check-in token secret, and the sync secret into a public
repository — all three were rotated, and `.gitignore` now covers plan
archives, which `*.tfstate` never did.

## Verification

- Per phase: `npm run typecheck && npm test` (root) and `cd frontend && npx tsc --noEmit && npm test` stay green; `terraform validate`/`plan` clean.
- Phase A end-to-end: deployed `*.web.app` frontend exercises the Cloud Run API against Cloud SQL (register/login with JWT auth still, events list, dashboard); Scheduler run visible in logs; Docker image runs locally with a local Postgres DSN.
- Phase B end-to-end: full auth lifecycle on GCP stack (register → Firebase user appears with correct uid → login → role-gated route → logout); import script tested against a copy of prod data before cutover.
- Phase C: the runbook's own smoke steps are the verification.

## Risks

- Cost sign-off (~$10–13/mo); db-f1-micro has no SLA (one-line tfvars upgrade if needed).
- firebase-tools-on-WIF and metadata-server ADC for Calendar are the two integrations to verify early in Phase A (both have documented fallbacks; never SA keys as first resort).
- Identity Platform/Firebase attachment is irreversible on the project (fine — it's the target state).
- Which repo runs Actions needs an admin decision (team repo recommended); WIF condition follows it.
