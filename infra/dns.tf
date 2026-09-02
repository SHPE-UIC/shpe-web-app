# DNS for the domain member email is sent from.
#
# Firebase's own sender cannot be authenticated. Mail leaves as
# noreply@<project>.firebaseapp.com while DKIM signs as firebaseapp.com, and
# firebaseapp.com is on the Public Suffix List — so those are two different
# organizational domains and DMARC can never align. Google runs that zone, so
# there is no record we could add to fix it. Sending from a domain we control
# is the only way member mail authenticates at all. The measurement behind
# that is in docs/EMAIL-DELIVERY.md.
#
# Inert until domain_name is set, so this can land before anything is bought.
# The zone has to exist before `gcloud domains registrations register
# --cloud-dns-zone`, which is why it is here rather than created by hand.
resource "google_dns_managed_zone" "primary" {
  count = var.domain_name == "" ? 0 : 1

  name        = "shpe-primary"
  dns_name    = "${var.domain_name}."
  description = "DNS for ${var.domain_name}"

  depends_on = [google_project_service.apis["dns.googleapis.com"]]
}
