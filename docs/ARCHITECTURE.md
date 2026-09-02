# Architecture

How the pieces fit together, drawn rather than described. Every diagram
answers one question; the prose above each says which.

For running and deploying the system see [DEPLOYMENT.md](DEPLOYMENT.md); for
who may call what, [PERMISSIONS.md](PERMISSIONS.md); for the Terraform layout,
[infra/README.md](../infra/README.md).

## Contents

- [What runs where](#what-runs-where)
- [How a request is authorized](#how-a-request-is-authorized)
- [How an account is created](#how-an-account-is-created)
- [How a profile picture gets uploaded](#how-a-profile-picture-gets-uploaded)
- [How the backend modules depend on each other](#how-the-backend-modules-depend-on-each-other)
- [What the authorization pieces actually expose](#what-the-authorization-pieces-actually-expose)
- [What changes over time](#what-changes-over-time)
- [What the database holds](#what-the-database-holds)
- [What Terraform builds, and who may touch it](#what-terraform-builds-and-who-may-touch-it)
- [How a change reaches production](#how-a-change-reaches-production)
- [Why it differs from the plan](#why-it-differs-from-the-plan)

---

## What runs where

One GCP project, `shpe-webapp`. The browser talks to two things — the static
site and the API — and the API is the only thing that talks to the database.
Google Calendar is an inbound source, not something members reach.

```mermaid
graph TB
    subgraph client["Member's browser"]
        APP["Expo web app"]
    end

    subgraph gcp["GCP project: shpe-webapp"]
        HOST["Firebase Hosting<br/>shpeuicapp.org<br/>+ shpe-webapp.web.app"]
        AUTH["Firebase Authentication<br/>email + password"]
        RUN["Cloud Run: shpe-api<br/>Express + Drizzle"]
        JOB["Cloud Run job: shpe-migrate<br/>runs before every deploy"]
        SQL[("Cloud SQL<br/>PostgreSQL 17")]
        GCS[("Cloud Storage<br/>avatars")]
        SCHED["Cloud Scheduler<br/>every 15 min"]
        SEC["Secret Manager"]
        MON["Cloud Monitoring<br/>uptime + email alert"]
    end

    CAL["Google Calendar<br/>the chapter's calendar"]

    APP -->|"loads the app"| HOST
    APP -->|"sign in / refresh"| AUTH
    APP -->|"API calls, ID token attached"| RUN
    APP -->|"PUT image, signed URL"| GCS
    APP -->|"GET image, public URL"| GCS

    RUN -->|"verify ID token"| AUTH
    RUN -->|"Unix socket, IAM gated"| SQL
    RUN -->|"sign upload URLs, delete replaced"| GCS
    RUN -->|"DATABASE_URL, secrets"| SEC
    RUN -->|"read events"| CAL
    SCHED -->|"POST /api/sync/calendar"| RUN
    JOB --> SQL
    MON -->|"GET /healthz/db"| RUN

    classDef store fill:#e8f0fe,stroke:#3367d6
    class SQL,GCS store
```

## How a request is authorized

The question this answers: *why does promoting someone take effect
immediately, without them signing out?*

Because the role is never read from the token. The token proves identity;
Postgres decides what that identity may do, and it is consulted on every
single request.

```mermaid
sequenceDiagram
    participant App as Expo app
    participant FB as Firebase Auth
    participant API as Cloud Run (Express)
    participant DB as Cloud SQL

    App->>FB: signInWithEmailAndPassword
    FB-->>App: ID token (cached, auto-refreshed)

    Note over App: every request from here on
    App->>API: GET /api/admin/members<br/>Authorization: Bearer <ID token>
    API->>FB: verifyIdToken (Admin SDK)
    FB-->>API: { uid, email_verified }
    API->>DB: select * from users where firebase_uid = uid
    DB-->>API: member row, including role

    alt row missing
        API-->>App: 401 user_gone
    else role too low
        API-->>App: 403 not_board / not_top8
    else allowed
        API->>DB: run the query
        API-->>App: 200 payload
    end
```

**The verification claim is read here but not acted on.** `loadSession` puts
`email_verified` on the request and `GET /api/auth/me` passes it to the app.
No route refuses on it, and no screen prompts for it. Enforcing was
shipped and reverted twice because mail to `uic.edu` does not arrive, and a
gate on an unreliable channel locks out the wrong people; see
[EMAIL-DELIVERY.md](EMAIL-DELIVERY.md) and [PERMISSIONS.md](PERMISSIONS.md).

## How an account is created

The question this answers: *what stops someone signing up with a personal
email, or with somebody else's?*

Two separate mechanisms, and they answer two different halves of the question.
The `@uic.edu` check proves the address is the right *shape*; the verification
link proves the person asking can actually *read* it. Neither alone is enough —
anyone can type a colleague's UIC address into the form.

Client-side signup is switched off in Identity Platform, so the Firebase SDK
cannot create a user at all. The only path to an account runs through the API,
which checks the address first. The rollback matters: the row is the source of
truth, so a Firebase user without one would be an orphan squatting on an email.

```mermaid
sequenceDiagram
    participant App as Expo app
    participant API as Cloud Run
    participant FB as Firebase Auth
    participant DB as Cloud SQL

    App->>API: POST /api/auth/register
    API->>API: parseRegistration — @uic.edu or reject

    alt not a UIC address
        API-->>App: 400 email_not_uic
    else accepted
        API->>DB: is the email already taken?
        API->>FB: createUser(uid = new row id)
        alt Firebase says the email exists
            FB-->>API: auth/email-already-exists
            API-->>App: 409 email_taken
        else created
            API->>DB: insert member row (same id)
            alt insert lost the race
                DB-->>API: unique violation
                API->>FB: deleteUser(uid) — no orphan left behind
                API-->>App: 409 email_taken
            else inserted
                API-->>App: 201 { user }
                App->>FB: signInWithEmailAndPassword
                App->>FB: sendEmailVerification
                Note over FB: relayed via SendGrid as<br/>noreply@shpeuicapp.org
                FB-->>App: link sent to the address
            end
        end
    end
```

**Firebase mints that link, but does not deliver it.** Identity Platform is
configured for `CUSTOM_SMTP` and relays through SendGrid as
`noreply@shpeuicapp.org`, a domain the chapter owns and publishes DKIM for.
Its own default sender is `noreply@<project>.firebaseapp.com` signed by
`firebaseapp.com` — two different organizational domains under the Public
Suffix List, so DMARC can never align, and `uic.edu` drops the mail without a
bounce. That is a property of the arrangement rather than a misconfiguration,
which is why the fix was a domain and not a code change. See
[EMAIL-DELIVERY.md](EMAIL-DELIVERY.md).

## How a profile picture gets uploaded

The question this answers: *why doesn't the image go through the API?*

Because it does not need to. Cloud Run would spend memory and request time
buffering bytes it has nothing to say about. The API signs a URL for one
specific object and steps out of the way; the size cap is signed into that URL,
so Cloud Storage enforces it rather than the client being trusted.

```mermaid
sequenceDiagram
    participant App as Expo app
    participant API as Cloud Run
    participant GCS as Cloud Storage
    participant DB as Cloud SQL

    App->>API: POST /api/profile/avatar/upload-url { contentType }
    API->>API: allowlist check (jpeg / png / webp)
    API->>GCS: sign a V4 PUT URL for users/<uid>/<random>.<ext><br/>via IAM signBlob — no key file exists
    API-->>App: 201 { url, objectPath, maxBytes }

    App->>GCS: PUT the image bytes directly
    GCS-->>App: 200

    App->>API: PUT /api/profile/avatar { objectPath }
    API->>API: does objectPath start with this member's prefix?
    Note right of API: re-checked because adopting is a<br/>separate request from signing
    API->>DB: update users set avatar_path
    API->>GCS: delete the object it replaced (best effort)
    API-->>App: 200 { user }
```

## How the backend modules depend on each other

The question this answers: *why does the migration job need a QR-signing
secret?*

Because `env.ts` validates every required variable the moment it is imported,
and it sits underneath everything — including the database client that
`migrate.ts` pulls in. Any entry point therefore has to satisfy the whole
contract, whether it uses it or not.

```mermaid
graph LR
    IDX["index.ts<br/>server entry"] --> APP["app.ts"]
    MIG["db/migrate.ts<br/>job entry"] --> DBC
    SYNC1["syncOnce.ts<br/>CLI entry"] --> CAL

    APP --> R["routes/*"]
    R --> MW["middleware/auth.ts"]
    MW --> FBA["auth/firebase.ts"]
    MW --> DBC["db/index.ts"]
    R --> TOK["auth/tokens.ts"]
    R --> AV["avatars/storage.ts"]
    R --> AUD["audit.ts"]
    R --> CAL["calendar/*"]
    R --> VAL["validation.ts"]

    DBC --> SSL["db/ssl.ts"]
    DBC --> SCH["db/schema.ts"]

    FBA --> ENV
    DBC --> ENV
    TOK --> ENV
    AV --> ENV
    CAL --> ENV
    APP --> ENV

    ENV["env.ts<br/>validates ALL required vars on import"]

    classDef root fill:#fde7e9,stroke:#c5221f
    class ENV root
```

## What the authorization pieces actually expose

The graph above shows *that* modules depend on each other; this shows *what*
they hand each other. Signatures are the real ones — if this drifts from
`backend/src/`, the code is right and this is wrong.

The shape worth noticing: `AuthMiddleware` is the only thing that touches both
Firebase and the database, and it is where identity stops and authorization
starts. Everything to its right deals in a `User` row that has already been
proven to exist.

```mermaid
classDiagram
    direction LR

    class AuthMiddleware {
        +requireAuth(req, res, next) void
        +requireBoard(req, res, next) void
        +requireTop8(req, res, next) void
        +findUserByEmail(email) User
    }

    class FirebaseAdmin {
        +verifyIdToken(token) DecodedIdToken
        +createFirebaseUser(input) UserRecord
        +deleteFirebaseUser(uid) void
        +isEmailTakenError(err) boolean
        +isTokenExpiredError(err) boolean
    }

    class Roles {
        <<enumeration>>
        MEMBER = 0
        BOARD = 1
        TOP8 = 2
        +isRole(value) boolean
        +isBoardOrAbove(role) boolean
        +isTop8(role) boolean
        +roleLabel(role) string
    }

    class CheckinTokens {
        +signCheckinToken(eventId) SignedToken
        +verifyCheckinToken(token) CheckinClaims
    }

    class CheckinClaims {
        +eventId string
        +kind checkin
    }

    class Validation {
        +UIC_EMAIL_DOMAIN string
        +MIN_PASSWORD_LENGTH number
        +isUicEmail(email) boolean
        +parseRegistration(body) RegistrationInput
    }

    class RegistrationInput {
        +email string
        +password string
        +name string
        +gender Gender
        +genderSelfDescribed string
        +schoolLevel SchoolLevel
        +memberId string
    }

    class PublicUserMapper {
        +toPublicUser(user) PublicUser
    }

    class PublicUser {
        +id string
        +email string
        +name string
        +gender string
        +memberId string
        +avatarUrl string
        +role Role
        +roleLabel string
    }

    class AvatarStorage {
        +AVATAR_MAX_BYTES number
        +AVATAR_CONTENT_TYPES map
        +avatarPrefix(userId) string
        +createUploadUrl(userId, contentType) UploadTicket
        +deleteObject(objectPath) void
        +publicUrl(objectPath) string
        +avatarUrlFor(objectPath) string
    }

    class CheckinWindowRules {
        +checkinWindow(event, now, earlyMinutes) CheckinWindow
        +describeClosedWindow(window) string
    }

    class Audit {
        +recordAudit(input) void
    }

    AuthMiddleware ..> FirebaseAdmin : verifies the ID token
    AuthMiddleware ..> Roles : compares the level
    AuthMiddleware --> PublicUser : attaches req.currentUser
    CheckinTokens --> CheckinClaims : issues and verifies
    Validation --> RegistrationInput : produces
    PublicUserMapper --> PublicUser : builds field by field
    PublicUserMapper ..> AvatarStorage : avatarUrlFor
    PublicUserMapper ..> Roles : roleLabel
    Audit ..> PublicUser : snapshots actor email
```

## What changes over time

Three things in this system are state machines, and each one has a transition
that surprises people.

**An announcement is never "published" by anything.** There is no job and no
flag flip — the read query compares `published_at` to `now()`, so a scheduled
post becomes visible because the clock moved, not because code ran.

```mermaid
stateDiagram-v2
    [*] --> Draft : created without published_at
    Draft --> Scheduled : published_at set to a future time
    Draft --> Published : published_at set to now or earlier
    Scheduled --> Published : the clock passes published_at
    Scheduled --> Draft : published_at cleared
    Published --> Draft : published_at cleared
    Draft --> [*] : deleted
    Scheduled --> [*] : deleted
    Published --> [*] : deleted

    note right of Scheduled
        Officers see drafts and scheduled posts;
        members see neither. Same row, different
        query - not a separate table.
    end note
```

**A session can fail to confirm without ending.** The deliberate part is the
network branch: a member on a bad connection is not signed out, because the
Firebase session is still perfectly valid and the next token refresh retries.
Only a 401 — the member row is gone — actually ends it.

```mermaid
stateDiagram-v2
    [*] --> Restoring : app boots

    Restoring --> SignedOut : Firebase has nobody
    Restoring --> Confirming : Firebase restored a session
    SignedOut --> Confirming : sign-in succeeds

    Confirming --> SignedIn : GET /api/auth/me returns the member
    Confirming --> SignedOut : 401 - the member row is gone
    Confirming --> Unconfirmed : network error

    Unconfirmed --> Confirming : next ID token refresh
    SignedIn --> Confirming : ID token refreshed
    SignedIn --> SignedOut : signs out

    note right of Unconfirmed
        Still signed in to Firebase, just not
        confirmed against the API yet. Signing
        out here would punish a bad connection.
    end note
```

**A check-in window opens early and closes exactly on time.** Members arrive
before the doors open, so scanning starts ahead of the start time; nothing
reopens it once the event has ended.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> TooEarly : event created
    TooEarly --> Open : starts_at minus CHECKIN_EARLY_MINUTES
    Open --> TooLate : ends_at
    TooLate --> [*]

    note right of Open
        The QR token is a separate, 60-second
        clock. A code can expire while the
        window is still wide open.
    end note
```

## What the database holds

Six tables. Two things are deliberate and easy to miss: a check-in stores the
points it was worth *at the time*, so re-tagging an event later cannot revalue
attendance already earned; and the audit log snapshots the actor's email and
the thing's name rather than joining, so an entry still reads after either row
is deleted.

```mermaid
erDiagram
    users ||--o{ check_ins : "attends"
    events ||--o{ check_ins : "is attended at"
    users ||--o{ announcements : "authors"
    users ||--o{ audit_log : "acts in"

    users {
        uuid id PK
        text email UK "unique on lower(email)"
        text firebase_uid UK "equals id by convention"
        text name
        text gender "Male | Female | Other"
        text gender_self_described "set only alongside Other, required there"
        text school_level
        text member_id "SHPE membership number"
        text avatar_path "object in the avatars bucket"
        int role "0 member, 1 board, 2 top 8"
        timestamptz created_at
    }
    events {
        uuid id PK
        text google_calendar_event_id UK "null when made in-app"
        text source "google_calendar | manual"
        text name
        int points
        timestamptz starts_at
        timestamptz ends_at
        bool all_day
        text_array overridden_fields "fields the sync must not touch"
    }
    check_ins {
        uuid id PK
        uuid user_id FK
        uuid event_id FK
        int points "snapshot, not a join"
        timestamptz created_at
    }
    announcements {
        uuid id PK
        uuid author_id FK
        text title
        text body
        timestamptz published_at "null = draft, future = scheduled"
    }
    audit_log {
        uuid id PK
        uuid actor_id FK
        text actor_email "snapshotted"
        text entity "event | announcement | member"
        text entity_label "snapshotted"
        text_array changed_fields
    }
    sync_state {
        text key PK
        text next_sync_token "Google's incremental cursor"
        timestamptz last_synced_at
    }
```

## What Terraform builds, and who may touch it

The question this answers: *why are there three service accounts?*

So that a compromise of the deploy pipeline is not a compromise of the
project. The API can reach the database and its own secrets and nothing else;
the deployer can ship images and static files but cannot create infrastructure;
only the Terraform account can reshape the project, and it runs only when a
human starts it.

```mermaid
graph TB
    subgraph sa["Service accounts"]
        RT["shpe-api-runtime<br/>what the API runs as"]
        DEP["shpe-deployer<br/>what Deploy runs as"]
        TFA["shpe-terraform<br/>what Infrastructure runs as"]
    end

    subgraph res["Resources Terraform manages"]
        RUN["Cloud Run<br/>service + migrate job"]
        SQL[("Cloud SQL: shpe-pg")]
        SEC["Secret Manager<br/>database-url, checkin-token, sync"]
        GCS[("GCS: shpe-webapp-avatars")]
        AR["Artifact Registry"]
        FIRE["Firebase project, Hosting site,<br/>web app, Identity Platform"]
        SCHED["Cloud Scheduler"]
        MON["Uptime check + alert"]
    end

    WIF["Workload Identity Federation<br/>pinned to owner/repo"]
    GH["GitHub Actions"]

    GH --> WIF
    WIF -->|"Deploy workflow"| DEP
    WIF -->|"Infrastructure workflow"| TFA

    RT -->|"cloudsql.client"| SQL
    RT -->|"secretAccessor, per secret"| SEC
    RT -->|"objectAdmin + sign as itself"| GCS
    RT -->|"firebaseauth.admin"| FIRE

    DEP -->|"run.developer, actAs runtime"| RUN
    DEP -->|"artifactregistry.writer"| AR
    DEP -->|"firebasehosting.admin"| FIRE

    TFA -->|"per-service admin, incl.<br/>projectIamAdmin"| res

    classDef danger fill:#fde7e9,stroke:#c5221f
    class TFA danger
```

## How a change reaches production

Two workflows, deliberately different in how far they go on their own. App
code deploys itself when it merges; infrastructure does not, because the
Terraform account can change who has access to the project.

```mermaid
graph LR
    subgraph ci["CI — every PR and branch push"]
        T1["typecheck + tests<br/>backend and frontend"]
    end

    subgraph dep["Deploy — push to main"]
        D1["build image"] --> D2["push to<br/>Artifact Registry"]
        D2 --> D3["run shpe-migrate job"]
        D3 -->|"migration fails"| DX(["pipeline stops<br/>before any new code serves"])
        D3 -->|"applied"| D4["deploy Cloud Run"]
        D4 --> D5["expo export"]
        D5 --> D6["deploy Firebase Hosting"]
    end

    subgraph inf["Infrastructure"]
        I1["PR touching infra/**"] --> I2["terraform plan<br/>posted as a PR comment"]
        I3["manual dispatch<br/>+ infra environment"] --> I4["terraform apply"]
    end

    classDef stop fill:#fde7e9,stroke:#c5221f
    class DX stop
```

The web build waits for the API on purpose: shipping a screen that calls an
endpoint the server does not have yet is the failure the ordering removes.

---

## Why it differs from the plan

The original design is in [migration.md](../migration.md) and the plans under
[superpowers/plans](superpowers/plans/). Where the built system departs from
them, here is why — several of these were only discoverable by running the
thing.

**Cloud SQL over the managed socket, not a private VPC.** The architecture
diagram that started the migration showed a VPC with a Serverless VPC Access
connector. That connector carries a fixed monthly cost roughly double the
database itself, and buys little here: with no authorized networks, the
instance is already reachable only through IAM-gated connectors. If the
chapter ever needs private IP, it is a change to `ip_configuration` and a
connector — not a redesign.

**No data migration, and no Firebase user import.** The plan budgeted a
downtime window for `pg_dump`/`pg_restore` and a bcrypt hash import so members
would keep their passwords. Both were cancelled once it was clear the old
database held only test accounts. The import script was kept "just in case"
for a while and has now been deleted along with `users.password_hash`, because
keeping an unusable script and a column no row uses is worse than the small
chance of wanting them.

**The uptime check watches `/healthz/db`, not `/healthz`.** Google's frontend
reserves that exact path on `run.app` URLs and answers its own 404 before the
request reaches the container — so the check was failing against a perfectly
healthy service. Cloud Run's own startup probe was unaffected, because probes
bypass that frontend, which is why deploys stayed green while monitoring
claimed the opposite. The deep check is the better target anyway: a database
outage now trips the alert.

**Identity Platform needed `provider = google-beta`.** Every other Firebase
resource declared it; this one did not, so it ran without
`user_project_override`, billed the API call to a Google-owned project, and
failed with a 403 saying `identitytoolkit.googleapis.com` was disabled — on a
project where it is enabled. Setting the ADC quota project does not help: the
provider only sends the override header when told to.

**The migration job is given `CHECKIN_TOKEN_SECRET`,** despite never signing a
token. `env.ts` validates every required variable on import, and `migrate.ts`
reaches it through the database client, so the job crashed before applying
anything. Making that validation lazy per entry point is the real fix and is
on the [todo list](TODO.md); mid-cutover was the wrong moment for it.

**Terraform applies by manual dispatch, not on merge.** Auto-applying is the
tidier GitOps story, but this stack's Terraform manages the project's own IAM,
so the workflow's account holds `roles/resourcemanager.projectIamAdmin`.
Applying on merge would make "who can reach production" a side effect of
approving a pull request. It sits behind the `infra` environment instead,
which since 2026-09-01 requires a second person to approve the run — the
reviewer cannot be whoever dispatched it.

**Deploys run from the team repository.** The old hosts could only build from
a personal mirror, which meant every release needed two pushes and depended on
one officer's account. GitHub Actions has no such constraint, so the mirror
was retired — the deployment now outlives whoever set it up.

**`.gitattributes` pins LF.** Not a design decision, a survival one: editing on
Windows made Git report every file as entirely rewritten, which made pull
requests unreviewable.

**Two Cloud SQL settings are explicitly unmanaged.** The instance API returns
`final_backup_config` and `maintenance_window` whether or not they are
configured, so every plan proposed "removing" them from the production
database. Noise on a plan is not harmless — it is where real drift hides — so
both are declared out of scope with `ignore_changes`.

**Firebase Authentication was in scope at all.** It was originally offered as a
later phase, separable from the hosting move, on the grounds that swapping auth
and swapping infrastructure at once is two risks in one change. The chapter
chose to take both together, which turned out well: the JWT code was deleted
once rather than migrated twice.
