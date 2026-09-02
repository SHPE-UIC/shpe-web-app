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

# SendGrid's domain authentication, and the DMARC policy that makes it count.
#
# CNAMEs rather than DKIM keys of our own because automated security is on:
# SendGrid rotates the keys without a DNS change, and the bounce domain lands
# on em416.<domain> — a subdomain of the From address — so SPF aligns as well
# as DKIM. Alignment is the whole point; the old sender signed and passed SPF
# perfectly well and still failed DMARC. See docs/EMAIL-DELIVERY.md.
resource "google_dns_record_set" "sendgrid" {
  for_each = var.domain_name == "" ? {} : {
    "em416"         = "u114082379.wl130.sendgrid.net."
    "s1._domainkey" = "s1.domainkey.u114082379.wl130.sendgrid.net."
    "s2._domainkey" = "s2.domainkey.u114082379.wl130.sendgrid.net."
  }

  name         = "${each.key}.${var.domain_name}."
  type         = "CNAME"
  ttl          = 3600
  managed_zone = google_dns_managed_zone.primary[0].name
  rrdatas      = [each.value]
}

# Enforced, because the sender has been proven. A test send on 2026-09-02 came
# back SPF PASS, DKIM PASS signing as shpeuicapp.org, DMARC PASS, delivered to
# the inbox — so mail that fails DMARC for this domain is not ours, and there
# is no longer a reason to ask receivers to deliver it anyway.
#
# The cost of enforcing: a sender added later and not authenticated here gets
# quarantined, silently. Anything new that sends as @shpeuicapp.org needs its
# DKIM published in this file first.
#
# No rua. Aggregate reports to an address outside the policy domain require
# that domain to authorise it (a shpeuicapp.org._report._dmarc.<host> record),
# which no public mail host publishes for us — so the old rua pointed at an
# inbox that would never receive a report. Monitoring that does not happen is
# worse than none, because it reads as covered.
#
# No SPF record on the apex on purpose. With automated security the bounce
# domain is em416.<domain>, so SPF is resolved through the CNAME above and the
# apex is never consulted; a record here would look reassuring and do nothing.
resource "google_dns_record_set" "dmarc" {
  count = var.domain_name == "" ? 0 : 1

  name         = "_dmarc.${var.domain_name}."
  type         = "TXT"
  ttl          = 3600
  managed_zone = google_dns_managed_zone.primary[0].name
  rrdatas      = ["\"v=DMARC1; p=quarantine\""]
}
