provider "google" {
  project = var.project_id
  region  = var.region
}

# The google_firebase_* resources live in the beta provider and bill their
# API calls to the target project rather than a separate quota project.
provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
}
