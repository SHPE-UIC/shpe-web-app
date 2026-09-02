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

# The app's own domain, added alongside the .web.app name rather than replacing
# it — Hosting serves both, so nothing pointing at the old URL breaks.
#
# It also fixes a mail problem. Firebase serves the email action handler at
# /__/auth/action on any domain attached to the site, so once this verifies the
# verification link can sit on the same domain the mail is sent from. A link
# whose domain has nothing to do with its sender is one of the signals that got
# the first message to a uic.edu address quarantined; see
# docs/EMAIL-DELIVERY.md.
#
# wait_dns_verification is false on purpose: the A records cannot exist until
# this resource says which ones it wants. Apply, read the
# custom_domain_dns_updates output, add them to dns.tf, then apply again.
resource "google_firebase_hosting_custom_domain" "app" {
  count = var.domain_name == "" ? 0 : 1

  provider              = google-beta
  project               = var.project_id
  site_id               = google_firebase_hosting_site.default.site_id
  custom_domain         = var.domain_name
  wait_dns_verification = false

  depends_on = [google_firebase_hosting_site.default]
}

# Identity Platform is the GA face of Firebase Auth. Creating the config
# enables it — and it cannot be disabled again (terraform destroy needs a
# `terraform state rm` for this resource).
resource "google_identity_platform_config" "auth" {
  # google-beta like the rest of this file: it carries
  # user_project_override, without which this call bills to a Google-owned
  # default project and 403s on identitytoolkit being "disabled" there.
  provider = google-beta
  project  = var.project_id

  sign_in {
    email {
      enabled           = true
      password_required = true
    }

    # Declared disabled because the API returns this block on every read;
    # leaving it out makes every plan show a phantom in-place update.
    phone_number {
      enabled = false
    }
  }

  # Firebase refuses sign-in from any origin not on this list, so the app's own
  # domain has to be here before it can serve a login screen. compact() drops
  # domain_name while it is still empty.
  authorized_domains = compact([
    "localhost",
    "${var.project_id}.web.app",
    "${var.project_id}.firebaseapp.com",
    var.domain_name,
  ])

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
