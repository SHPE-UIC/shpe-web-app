# Email delivery

Why mail sent by Firebase Authentication does not reach `@uic.edu` inboxes,
and what would fix it.

This is about the **sender**, not about any one feature. It applies to every
message Firebase Auth sends on our behalf — email verification, password
reset, email-change notices — so it stays true whichever of those the app
happens to ship.

> **Resolved 2026-09-02.** Mail now sends from `noreply@shpeuicapp.org` through
> SendGrid and authenticates: SPF PASS, DKIM PASS signing as `shpeuicapp.org`,
> **DMARC PASS**, delivered to the inbox rather than spam. What follows is kept
> as the record of why the old sender could not be made to work — the reasoning
> applies to any future sender, and re-deriving it took a while.

## The finding

Firebase's default sender cannot be authenticated, and the domain it sends
from cannot be made to authenticate.

Mail leaves as `noreply@shpe-webapp.firebaseapp.com`, while DKIM signs as
`firebaseapp.com`. Those are two different domains, so DMARC fails alignment.
There is no policy to fall back on either — the DMARC lookup returns a
wildcard TXT record carrying SPF and DKIM values rather than a `v=DMARC1`
policy:

```
$ dig +short TXT _dmarc.shpe-webapp.firebaseapp.com
"v=spf1 redirect=_spf.google.com"
"v=DKIM1; k=rsa; t=s; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCB..."
```

`_dmarc.firebaseapp.com` returns the identical wildcard, so nothing is hiding
one level up.

## How this was established

Measured, not inferred. A verification mail was sent through the exact path
the app uses — Admin SDK `createUser`, client `signInWithPassword` with the
public API key, then `accounts:sendOobCode` with `VERIFY_EMAIL` — to an inbox
we could read in full.

It arrived, and `Show original` reported:

| Check | Result |
|---|---|
| SPF | **PASS** — for `209.85.220.69`, a Google IP |
| DKIM | **PASS** — signing as `firebaseapp.com` |
| DMARC | **FAIL** |

Gmail filed it as spam. Two independent providers reaching the same verdict is
what rules out a UIC-specific policy quirk: UIC's Microsoft 365 tenant drops it
outright, which is why affected members find nothing in either the inbox or
quarantine.

Everything on our side was ruled out first, by direct check against the
production tenant: the deployed bundle really does call the send, the
`sendOobCode` endpoint is reachable on the production browser key,
`verifyEmailTemplate` and `callbackUri` are configured, the hosted action
handler at `/__/auth/action` serves correctly on both domains, and a minted
link verifies an account end to end. The send is accepted every time. It is
delivery that fails.

## Why it cannot be fixed where it is

`firebaseapp.com` is on the [Public Suffix List][psl] — the same fact that
gives every Firebase project its own browser origin. That makes
`shpe-webapp.firebaseapp.com` its own organizational domain, so Google's
`firebaseapp.com` signature can never align with it under DMARC.

And we cannot publish records to correct it, because Google runs that zone.
Neither we nor Google can change this. It is a property of the arrangement,
not a misconfiguration.

The same applies to `shpe-webapp.web.app`. Both are free subdomains of
Google-owned zones; neither was purchased, and neither can hold DNS records of
ours.

[psl]: https://publicsuffix.org/

## What fixed it

Sending from a domain we control, with aligned DKIM. $12/year for the domain
plus about $2.40 for the Cloud DNS zone; SendGrid is free at this volume.

1. **A domain.** Registrable through Cloud Domains so it bills to the existing
   GCP account rather than to an individual, with its zone in Cloud DNS. The
   registration is a human step, not Terraform — see the Design notes in
   [`infra/README.md`](../infra/README.md) for why.
2. **A transactional sender.** Google Cloud has no email service and blocks
   outbound 25, 465, and 587, so this is necessarily third-party. Free tiers
   cover our volume comfortably.
3. **SPF, DKIM, and DMARC** on that domain, in Cloud DNS. Start DMARC at
   `p=none` and tighten once passing.
4. **Point Identity Platform at it** — `notification.sendEmail` with
   `method: CUSTOM_SMTP`. This is a REST `PATCH`, not Terraform:
   `google_identity_platform_config` has no `notification` block
   ([provider issue #20752][issue]). Identity Platform opens that SMTP
   connection rather than our Cloud Run service, so the port block above does
   not apply, and **no application code changes**.

[issue]: https://github.com/hashicorp/terraform-provider-google/issues/20752

The success criterion was the table above reading **PASS, PASS, PASS** with
delivery to the inbox. Confirmed on 2026-09-02:

| Check | Before | After |
|---|---|---|
| SPF | PASS (`209.85.220.69`, Google) | PASS (`149.72.154.232`, SendGrid) |
| DKIM | PASS — `firebaseapp.com` | PASS — **`shpeuicapp.org`** |
| DMARC | **FAIL** | **PASS** |
| Placement | Spam | **Inbox** |

Nothing about the application changed. The same code that could not deliver a
message now delivers one, because the sender it hands off to authenticates.

What actually shipped:

- `shpeuicapp.org`, registered through Cloud Domains, auto-renewing, contact
  `externalvp.shpe.uic@gmail.com` — a role address rather than a person's.
- `infra/dns.tf` — the Cloud DNS zone, SendGrid's three authentication CNAMEs,
  and the DMARC policy.
- Identity Platform on `CUSTOM_SMTP` via `smtp.sendgrid.net:587`, sending as
  `noreply@shpeuicapp.org`. Applied with a narrow `updateMask` of
  `notification.sendEmail.method,notification.sendEmail.smtp`, because the
  templates and `callbackUri` live in the same object and a wider mask
  replaces them.

One thing left untested at the time of writing: delivery to a `uic.edu`
inbox specifically. Gmail was the readable inbox used for the proof above,
and it was always the more permissive of the two — it spam-foldered the old
mail where UIC dropped it outright.

## Authenticating is necessary, not sufficient

**2026-09-02.** The first message this domain ever sent to a `uic.edu` address
authenticated perfectly and still never reached the mailbox. SendGrid's
activity feed:

```
Processed  05:01  SendGrid, shared IP 149.72.126.143
Delivered  05:02  uic-edu.mail.protection.outlook.com
Opened     05:02
```

`Delivered` means Exchange Online Protection accepted the SMTP handoff. It does
**not** mean the message reached a mailbox — EOP accepts first and filters
after. A search across all folders, Junk and Archive included, found nothing,
which is what quarantine looks like from the recipient's side.

**The `Opened` event is not the member.** Delivered and opened in the same
minute is a scanner fetching the tracking pixel, and it is worth knowing before
someone reads it as proof the mail was received. It also means a link scanner
was in the message, so treat the one-time `oobCode` as possibly already spent.

Why EOP quarantined mail that passes SPF, DKIM and DMARC: authentication proves
who sent it, not that the content looks trustworthy. The message carried four
signals at once —

| Signal | What we sent |
|---|---|
| Display name | `SHPE@UIC Bot` — asserts UIC affiliation from a domain that is not `uic.edu` |
| Subject | `Verify your email for project-335746674027` — `%APP_NAME%` unresolved |
| Link domain | `shpe-webapp.firebaseapp.com`, unrelated to the sending domain |
| Reputation | first message the domain had ever sent |

Any one is survivable; together they are a phishing profile, and quarantining
is a defensible call. The display name is the worst of them, because it asserts
exactly the affiliation the authentication contradicts.

The subject and display name live in email templates, which the Admin API
refuses to change — `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` — so they are edited in
the Firebase console under Authentication → Templates. The link domain is
fixed by attaching the app's domain to Hosting, which moves the action handler
onto the same domain the mail comes from.

## Two things to expect

**Link scanners.** Microsoft Defender Safe Links pre-fetches URLs in mail. A
Firebase action link carries a single-use `oobCode`, so a scanner that follows
it burns the code and the member sees "link expired". Worth watching for once
delivery works; the answer would be a typed code rather than more mail tuning.

**Sender display names.** The verify template's `senderDisplayName` was
`SHPE@UIC Bot`. A display name containing `@UIC` on mail that is not
authenticated for a UIC domain is a display-name spoofing pattern that
Microsoft's anti-impersonation rules score against. It is not the cause of
anything here, but it is worth dropping.

## Unblocking one person by hand

Not needed any more, kept because it is the fastest way past a mail problem
that has not been diagnosed yet.

Until this is fixed, a verification link can be minted directly and handed
over, bypassing mail entirely:

```bash
curl -X POST "https://identitytoolkit.googleapis.com/v1/projects/<project>/accounts:sendOobCode" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "X-Goog-User-Project: <project>" \
  -H "Content-Type: application/json" \
  -d '{"requestType":"VERIFY_EMAIL","email":"someone@uic.edu","returnOobLink":true}'
```

`returnOobLink` returns the link instead of sending it. Note that each new code
invalidates the previous one for that account, so a member who taps Resend
after being handed a link will invalidate it. This does not scale past a few
people.
