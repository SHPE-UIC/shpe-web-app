# What the API runs as. It can reach Cloud SQL and read its own secrets —
# nothing else. Calendar access comes from sharing the calendar with this
# account's email, not from an IAM role.
resource "google_service_account" "api_runtime" {
  account_id   = "shpe-api-runtime"
  display_name = "SHPE API runtime"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

resource "google_project_iam_member" "runtime_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api_runtime.email}"
}

# Registration creates Firebase users server-side (and deletes them when the
# matching row insert fails); verifying ID tokens alone would need nothing.
resource "google_project_iam_member" "runtime_firebase_auth" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.api_runtime.email}"
}

# Writes avatars and deletes the ones they replace.
resource "google_storage_bucket_iam_member" "runtime_avatars_write" {
  bucket = google_storage_bucket.avatars.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api_runtime.email}"
}

# Signing a V4 URL under Application Default Credentials has no private key to
# sign with, so the SDK calls IAM signBlob instead — which the account must be
# allowed to do as itself.
resource "google_service_account_iam_member" "runtime_self_signer" {
  service_account_id = google_service_account.api_runtime.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_secrets" {
  for_each = {
    database_url         = google_secret_manager_secret.database_url.secret_id
    checkin_token_secret = google_secret_manager_secret.checkin_token_secret.secret_id
    sync_secret          = google_secret_manager_secret.sync_secret.secret_id
  }

  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api_runtime.email}"
}

# What GitHub Actions runs as, via Workload Identity Federation — no keys.
resource "google_service_account" "deployer" {
  account_id   = "shpe-deployer"
  display_name = "SHPE CI deployer"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

resource "google_project_iam_member" "deployer_run" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Deploying a service that runs as the runtime SA requires actAs on it —
# granted on that one account, not project-wide.
resource "google_service_account_iam_member" "deployer_act_as_runtime" {
  service_account_id = google_service_account.api_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_artifact_registry_repository_iam_member" "deployer_push" {
  repository = google_artifact_registry_repository.docker.name
  location   = var.region
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_hosting" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# firebase-tools probes enabled APIs during deploys.
resource "google_project_iam_member" "deployer_serviceusage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_artifact_registry_repository" "docker" {
  repository_id = "shpe"
  location      = var.region
  format        = "DOCKER"
  description   = "SHPE API images, pushed by CI"

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}
