# Replaces the in-process sync timer. Header secret rather than OIDC because
# the endpoint already implements the check and the service is public anyway;
# the blast radius of the secret is "can trigger a calendar sync".
resource "google_cloud_scheduler_job" "calendar_sync" {
  name      = "shpe-calendar-sync"
  region    = var.region
  schedule  = "*/15 * * * *"
  time_zone = "America/Chicago"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api.uri}/api/sync/calendar"

    headers = {
      "x-sync-secret" = random_password.sync_secret.result
    }
  }

  retry_config {
    retry_count = 1
  }

  depends_on = [google_project_service.apis["cloudscheduler.googleapis.com"]]
}
