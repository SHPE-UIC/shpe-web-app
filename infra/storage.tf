# Profile pictures. Objects are public-read at unguessable paths — the roster
# is small and internal, and signed read URLs would tax every avatar render
# for privacy the chapter does not need. Nothing sensitive is ever stored here.
resource "google_storage_bucket" "avatars" {
  name     = "${var.project_id}-avatars"
  location = var.region

  uniform_bucket_level_access = true

  # The browser PUTs straight to GCS with a signed URL, so the bucket itself
  # has to allow the app's origins. Local development uploads through
  # localhost are deliberately not allowed.
  cors {
    origin          = local.cors_origins
    method          = ["PUT", "GET"]
    response_header = ["Content-Type", "x-goog-content-length-range"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.apis["storage.googleapis.com"]]
}

resource "google_storage_bucket_iam_member" "avatars_public_read" {
  bucket = google_storage_bucket.avatars.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
