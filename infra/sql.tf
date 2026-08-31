# The cheapest reasonable Postgres: shared-core, zonal, HDD, no PITR. The
# instance has a public IP but zero authorized networks — the only ways in are
# the Cloud SQL connectors (Cloud Run's built-in socket mount, or the Auth
# Proxy locally), both IAM-gated. Upgrading to a private VPC later only
# changes ip_configuration here plus a VPC connector on the Cloud Run side.
resource "google_sql_database_instance" "main" {
  name                = "shpe-pg"
  database_version    = "POSTGRES_17"
  region              = var.region
  deletion_protection = true

  settings {
    edition           = "ENTERPRISE"
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_type         = "PD_HDD"
    disk_size         = 10
    disk_autoresize   = true

    backup_configuration {
      enabled = true

      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled = true
    }
  }

  # The API returns these two blocks with disabled/zero values whether or not
  # they are configured, so every plan wanted to "remove" them. Neither is
  # managed here: backups are configured above, and maintenance timing is left
  # to Google.
  lifecycle {
    ignore_changes = [
      settings[0].final_backup_config,
      settings[0].maintenance_window,
    ]
  }

  depends_on = [google_project_service.apis["sqladmin.googleapis.com"]]
}

resource "google_sql_database" "app" {
  name     = "shpe"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "api" {
  name     = "shpe_api"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}
