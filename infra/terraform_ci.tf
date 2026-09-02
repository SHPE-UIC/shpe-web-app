# The identity the Terraform workflow runs as.
#
# This account can reshape the whole project, so it is deliberately separate
# from the deployer (which only ships images and static files) and is granted
# per-service admin roles rather than roles/owner — the difference is small in
# practice but it keeps the blast radius readable.
#
# Note it manages itself: removing a role below removes Terraform's own
# ability to manage that service. Grant changes are worth a second look.
resource "google_service_account" "terraform" {
  account_id   = "shpe-terraform"
  display_name = "SHPE Terraform CI"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

resource "google_project_iam_member" "terraform" {
  for_each = toset([
    "roles/artifactregistry.admin",
    "roles/cloudscheduler.admin",
    "roles/cloudsql.admin",
    "roles/dns.admin",
    "roles/firebase.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/monitoring.editor",
    # Lets the workflow grant project roles — the reason this account is
    # gated behind a manual approval rather than run on every push.
    "roles/resourcemanager.projectIamAdmin",
    "roles/run.admin",
    "roles/secretmanager.admin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/storage.admin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.terraform.email}"
}

# Reading a secret's current value is part of refreshing its version resource;
# the admin role above governs the secret, not its payload.
resource "google_project_iam_member" "terraform_secret_access" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.terraform.email}"
}

# Terraform state, including its lock. The bucket belongs to the bootstrap
# stack, so it is referenced by name rather than by resource.
resource "google_storage_bucket_iam_member" "terraform_state" {
  bucket = "${var.project_id}-tfstate"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.terraform.email}"
}

# Deploying Cloud Run services that run as the runtime account requires
# actAs on it, the same grant the deployer needs.
resource "google_service_account_iam_member" "terraform_act_as_runtime" {
  service_account_id = google_service_account.api_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_service_account_iam_member" "terraform_wif" {
  service_account_id = google_service_account.terraform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
