variable "project_id" {
  description = "GCP project id (also the Firebase Hosting default site id)"
  type        = string
}

variable "region" {
  description = "Region for all regional resources"
  type        = string
  default     = "us-central1"
}

variable "github_repository" {
  description = "GitHub repo allowed to deploy via WIF, as owner/name"
  type        = string
}

variable "google_calendar_id" {
  description = "Calendar the sync pulls events from; empty disables sync"
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Where uptime alerts go"
  type        = string
}

variable "api_image" {
  description = <<-EOT
    Cloud Run image for the first apply only. CI owns the image afterwards
    (the service and job ignore image changes), so the placeholder default
    lets `terraform apply` succeed before anything has been pushed.
  EOT
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cors_origins" {
  description = "Browser origins the API accepts; empty means the Hosting defaults"
  type        = list(string)
  default     = []
}

variable "domain_name" {
  description = "Domain member email is sent from; empty until one is registered"
  type        = string
  default     = ""
}

locals {
  cors_origins = length(var.cors_origins) > 0 ? var.cors_origins : [
    "https://${var.project_id}.web.app",
    "https://${var.project_id}.firebaseapp.com",
  ]
}
