# The bucket comes from infra/bootstrap and is passed at init time, because
# backend blocks cannot reference variables:
#
#   terraform init -backend-config="bucket=<PROJECT_ID>-tfstate"
terraform {
  backend "gcs" {
    prefix = "app"
  }
}
