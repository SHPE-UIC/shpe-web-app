# Attaching Firebase to the project is effectively irreversible — there is no
# clean "detach". That is the intended end state here.
resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis["firebase.googleapis.com"]]
}

resource "google_firebase_web_app" "app" {
  provider     = google-beta
  project      = var.project_id
  display_name = "SHPE Web App"

  depends_on = [google_firebase_project.default]
}

# api_key / auth_domain / app_id for the frontend build — public by design.
data "google_firebase_web_app_config" "app" {
  provider   = google-beta
  web_app_id = google_firebase_web_app.app.app_id
}

resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.project_id

  depends_on = [
    google_firebase_project.default,
    google_project_service.apis["firebasehosting.googleapis.com"],
  ]
}

# Identity Platform is the GA face of Firebase Auth. Creating the config
# enables it — and it cannot be disabled again (terraform destroy needs a
# `terraform state rm` for this resource).
resource "google_identity_platform_config" "auth" {
  project = var.project_id

  sign_in {
    email {
      enabled           = true
      password_required = true
    }
  }

  authorized_domains = [
    "localhost",
    "${var.project_id}.web.app",
    "${var.project_id}.firebaseapp.com",
  ]

  # The load-bearing setting for the @uic.edu gate: clients cannot create
  # accounts. Only the API's Admin SDK creates users, after validating the
  # email domain server-side.
  client {
    permissions {
      disabled_user_signup = true
    }
  }

  depends_on = [
    google_firebase_project.default,
    google_project_service.apis["identitytoolkit.googleapis.com"],
  ]
}
