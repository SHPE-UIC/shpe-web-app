# Profile pictures. Objects are public-read at unguessable paths, and the
# bucket cannot be listed, since a listing would hand out every path at once.
# The roster is small and internal, and signed read URLs would tax every
# avatar render for privacy the chapter does not need. Nothing sensitive is
# ever stored here.
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

# Read by exact path, never list. roles/storage.objectViewer would also carry
# storage.objects.list, and with it anyone could enumerate users/<id>/…: every
# member's id and every picture. legacyObjectReader is storage.objects.get
# alone. Despite the name it is an ordinary bucket-level IAM role, and Google's
# uniform-access docs use it as the stand-in for an object READER ACL.
resource "google_storage_bucket_iam_member" "avatars_public_read" {
  bucket = google_storage_bucket.avatars.name
  role   = "roles/storage.legacyObjectReader"
  member = "allUsers"
}
