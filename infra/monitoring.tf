# Cloud Run stdout already lands in Cloud Logging; the only monitoring worth
# codifying at this scale is "is the API up, and who gets emailed if not".
resource "google_monitoring_uptime_check_config" "healthz" {
  display_name = "shpe-api /healthz"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/healthz"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"

    labels = {
      project_id = var.project_id
      host       = trimprefix(google_cloud_run_v2_service.api.uri, "https://")
    }
  }

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}

resource "google_monitoring_notification_channel" "email" {
  display_name = "SHPE alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}

resource "google_monitoring_alert_policy" "api_down" {
  display_name = "shpe-api down"
  combiner     = "OR"

  conditions {
    display_name = "/healthz uptime check failing"

    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.healthz.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "600s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}
