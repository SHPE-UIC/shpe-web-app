# Terraform owns the service's shape; CI owns its image. The placeholder
# image makes the first apply work before CI has ever pushed, and the
# ignore_changes below keeps later `gcloud run deploy` calls from fighting
# Terraform.
resource "google_cloud_run_v2_service" "api" {
  name                = "shpe-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.api_runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    volumes {
      name = "cloudsql"

      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.api_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      # Cloud Scheduler drives the sync; the in-process timer would not
      # survive Cloud Run's CPU throttling anyway.
      env {
        name  = "DISABLE_SYNC_LOOP"
        value = "1"
      }

      env {
        name  = "CORS_ORIGINS"
        value = join(",", local.cors_origins)
      }

      env {
        name  = "GOOGLE_CALENDAR_ID"
        value = var.google_calendar_id
      }

      env {
        name = "DATABASE_URL"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "CHECKIN_TOKEN_SECRET"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.checkin_token_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SYNC_SECRET"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.sync_secret.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_iam_member.runtime_secrets,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.checkin_token_secret,
    google_secret_manager_secret_version.sync_secret,
  ]
}

# Public API, same posture as today: CORS plus the app's own auth guard it.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Migrations run as a job CI executes before each deploy — the same fail-the-
# pipeline-before-boot guarantee render.yaml's buildCommand gave.
resource "google_cloud_run_v2_job" "migrate" {
  name                = "shpe-migrate"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.api_runtime.email
      max_retries     = 0

      volumes {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }

      containers {
        image   = var.api_image
        command = ["npm"]
        args    = ["run", "db:migrate"]

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name = "DATABASE_URL"

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_iam_member.runtime_secrets,
    google_secret_manager_secret_version.database_url,
  ]
}
