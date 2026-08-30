# One-time bootstrap, run with LOCAL state (the statefile is gitignored):
#
#   cd infra/bootstrap
#   terraform init
#   terraform apply -var project_id=<PROJECT_ID>
#
# It creates the GCS bucket the main stack stores its state in, and enables
# the two APIs Terraform itself needs before `google_project_service` works.
# If the local statefile is ever lost, re-import with:
#   terraform import google_storage_bucket.tfstate <PROJECT_ID>-tfstate

terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 8.0"
    }
  }
}

variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "Region for the state bucket"
  type        = string
  default     = "us-central1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "bootstrap" {
  for_each = toset([
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "storage.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "tfstate" {
  name     = "${var.project_id}-tfstate"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # State contains generated secrets; versioning is the recovery story for a
  # corrupted or mistakenly overwritten statefile.
  versioning {
    enabled = true
  }

  depends_on = [google_project_service.bootstrap]
}

output "state_bucket" {
  value       = google_storage_bucket.tfstate.name
  description = "Pass to the main stack: terraform init -backend-config=\"bucket=<this>\""
}
