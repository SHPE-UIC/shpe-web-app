output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Cloud Run URL — the frontend build's EXPO_PUBLIC_API_URL"
}

output "hosting_url" {
  value       = "https://${google_firebase_hosting_site.default.site_id}.web.app"
  description = "Where the app is served"
}

output "sql_connection_name" {
  value       = google_sql_database_instance.main.connection_name
  description = "For the Cloud SQL Auth Proxy during data migration"
}

output "api_runtime_service_account" {
  value       = google_service_account.api_runtime.email
  description = "Share the Google Calendar with this address (See all event details)"
}

output "deployer_service_account" {
  value       = google_service_account.deployer.email
  description = "GitHub secret GCP_DEPLOYER_SA"
}

output "terraform_service_account" {
  value       = google_service_account.terraform.email
  description = "GitHub secret GCP_TERRAFORM_SA, used by the Infrastructure workflow"
}

output "wif_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "GitHub secret GCP_WIF_PROVIDER"
}

output "avatars_bucket" {
  value       = google_storage_bucket.avatars.name
  description = "Profile pictures; objects are public-read"
}

output "artifact_repo" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
  description = "Image path prefix CI pushes to"
}

# All public-by-design client identifiers; they go in GitHub Actions
# *variables* for the frontend build, not secrets.
output "firebase_web_config" {
  value = {
    api_key     = data.google_firebase_web_app_config.app.api_key
    auth_domain = data.google_firebase_web_app_config.app.auth_domain
    project_id  = var.project_id
    app_id      = google_firebase_web_app.app.app_id
  }
  description = "EXPO_PUBLIC_FIREBASE_* values for the frontend build"
}
