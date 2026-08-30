# All generated values are alphanumeric so they can be embedded in a DSN or
# an HTTP header without escaping. They live in Terraform state too — the
# state bucket is private and versioned, which is the accepted trade-off here.

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "random_password" "checkin_token_secret" {
  length  = 64
  special = false
}

resource "random_password" "sync_secret" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "shpe-db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# The full DSN the API consumes. `host` pointing under /cloudsql is the unix
# socket Cloud Run mounts; backend/src/db/ssl.ts recognizes it and skips TLS.
resource "google_secret_manager_secret" "database_url" {
  secret_id = "shpe-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.api.name}:${random_password.db_password.result}@localhost/${google_sql_database.app.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
}

# Signs check-in QR tokens only — member sessions are Firebase ID tokens.
resource "google_secret_manager_secret" "checkin_token_secret" {
  secret_id = "shpe-checkin-token-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "checkin_token_secret" {
  secret      = google_secret_manager_secret.checkin_token_secret.id
  secret_data = random_password.checkin_token_secret.result
}

resource "google_secret_manager_secret" "sync_secret" {
  secret_id = "shpe-sync-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "sync_secret" {
  secret      = google_secret_manager_secret.sync_secret.id
  secret_data = random_password.sync_secret.result
}
