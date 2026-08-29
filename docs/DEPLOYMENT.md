# Deployment

Three free services. Nothing here costs money, and nothing expires on its own.

| Piece | Runs on | Why there |
|---|---|---|
| Postgres | **Neon**, via the Vercel Marketplace | Render's own free Postgres expires after 30 days. Neon's does not. |
| API | **Render** | Free web service. Sleeps when idle — see [Keeping it awake](#keeping-it-awake). |
| App | **Vercel** | Static Expo web export off the CDN. |

There is no first-party "Vercel Postgres" any more. A database on Vercel is a
Marketplace integration, and the engine is Neon.

---

## Still to do

### Set up the uptime pinger

**Not done yet.** Until it is, the first request after about 15 minutes of quiet
takes up to a minute while Render wakes the instance. Everything works, it is
just slow — and it lands on the login screen, which is the worst place for it.

1. Sign up at [UptimeRobot](https://uptimerobot.com) or
   [cron-job.org](https://cron-job.org). Both are free and neither needs a card.
2. Add an **HTTP(s)** monitor pointing at:

   ```
   https://shpe-api.onrender.com/healthz
   ```

3. Set the interval to **10 minutes** — comfortably under Render's ~15 minute
   idle timeout.

Three things to get right:

- **Use `/healthz`, not `/healthz/db`.** The deep check opens a Neon connection
  on every call, which would hold the database awake around the clock for no
  benefit. The shallow check is deliberately cheap and touches nothing.
- **Do not build this on GitHub Actions.** On a private repo a 10-minute
  schedule bills roughly 4,300 minutes a month against a 2,000-minute free
  allowance. An external pinger is free and unmetered.
- **One service only.** Render's free tier gives 750 instance-hours a month and
  a month is about 730, so keeping a single service awake fits with nothing to
  spare. A second always-on free service would exhaust the allowance and both
  would be suspended.

To confirm it is working: leave the app alone for 20 minutes, then load it. If
sign-in responds immediately, the pinger is doing its job.

### Make the first Top 8

**Not done yet.** Levels are `0` member, `1` board member, `2` top 8. A Top 8
can change anyone's level from inside the app, but only a Top 8 can — so the
first one has to be made by hand. Until one exists nobody can promote anyone.

If you are upgrading an existing deployment: the migration turned every old
`is_admin = true` account into a **board member (1)**, so events and
announcements keep working. Nobody is a Top 8 until you run the statement
below.

Register your own account in the app first, then in the Neon console's SQL
editor (Vercel > Storage > your database > Open in Neon):

```sql
UPDATE users SET role = 2 WHERE email = 'you@uic.edu';
```

It takes effect on your next request; you do not need to sign out. See
[PERMISSIONS.md](PERMISSIONS.md) for the full picture of who can do what.

### Turn on the Google Calendar sync

**Not done yet.** The code is deployed and inert: with no calendar configured
the API logs `[calendar-sync] GOOGLE_CALENDAR_ID is not set, sync loop not
started` and carries on serving. Until this is done, events exist only if an
officer creates them in the app.

What it buys you: officers manage events in Google Calendar, which they already
use, and the event's **colour** sets its category and point value. The mapping
lives in [`backend/src/calendar/eventTags.ts`](../backend/src/calendar/eventTags.ts) —
Blueberry is a GBM worth 3 points, Tangerine is Career, and so on.

1. In the [Google Cloud console](https://console.cloud.google.com), create a
   project (or reuse one) and **enable the Google Calendar API**.
2. Create a **service account** and download its JSON key. No IAM roles are
   needed — access comes from sharing the calendar, not from the project.
3. In Google Calendar, open the SHPE calendar's settings and **share it with the
   service account's `client_email`**, with "See all event details". This step
   is the one people forget; without it the sync returns an empty calendar
   rather than an error.
4. Copy the Calendar ID from **Settings > Integrate calendar**.
5. On the Render service, set:
   - `GOOGLE_CALENDAR_ID` — the calendar ID
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — the entire key file, pasted as one line

Render restarts on save and the sync loop starts on boot.

**The loop only runs while the service is awake**, so it depends on the uptime
pinger above. Without the pinger, syncs happen only when someone happens to be
using the app. To force one by hand:

```bash
curl -X POST https://shpe-api.onrender.com/api/sync/calendar -H "x-sync-secret: <SYNC_SECRET from Render>"
```

Add `?full=1` to ignore the stored sync token and re-import the last 30 days.

Editing a synced event in the app is safe: each field you change is recorded,
and the sync leaves those fields alone afterwards while everything else keeps
tracking the calendar.

---

## The current deployment

| Piece | Where |
|---|---|
| App | https://shpe-web-app.vercel.app |
| API | https://shpe-api.onrender.com |
| Database | Neon, free plan, via the Vercel Marketplace |
| Deploy repo | `Esgartaq04/shpe-web-app` (private) |
| Team repo | `communicationsshpeuic/shpe-web-app` |

The team repo cannot be used by Vercel or Render: linking it needs GitHub app
access on an account we do not control. `Esgartaq04/shpe-web-app` is the
deployment mirror and shares the same git history.

Vercel and Render both build **`main`** on the mirror. Publishing a change is
therefore two pushes — one to keep the team repo current, one to deploy:

```bash
git push origin free-deploy && git push personal free-deploy:main
```

Once `free-deploy` merges upstream, the second push goes away.

---

## Order matters

Vercel needs the Render URL, and Render needs the Vercel URL for CORS. That is a
loop, so it is broken by doing Render first and coming back to set `CORS_ORIGINS`
at the end.

```
1. Neon            → DATABASE_URL
2. Render          → API URL          (needs DATABASE_URL)
3. Vercel          → app URL          (needs API URL)
4. Back to Render  → CORS_ORIGINS     (needs app URL)
```

---

## 1. Database (Neon)

In the Vercel dashboard: **Storage → Create Database → Neon → Free**.

Then open the database and copy the **pooled** connection string. It looks like:

```
postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
```

Take the pooled one, not the direct one — the API keeps a small connection pool
and Neon's free plan caps direct connections.

## 2. API (Render)

**New → Blueprint**, pick this repository. Render reads [`render.yaml`](../render.yaml)
and fills in the build, start command, health check, and Node version itself.

It will prompt for the variables marked `sync: false`. At this stage only one
matters:

- `DATABASE_URL` — the Neon string from step 1
- `CORS_ORIGINS` — leave blank for now, filled in at step 4
- `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` — leave blank until the
  calendar sync lands

`JWT_SECRET` and `SYNC_SECRET` are generated by Render. You never need to see
them. Regenerating `JWT_SECRET` signs every member out.

The build runs `npm run db:migrate`, so the schema is applied as part of
deploying. A deploy whose migration fails will not start, which is intended.

When it goes green, note the URL: `https://shpe-api.onrender.com`.

Check it:

```bash
curl https://shpe-api.onrender.com/healthz/db
```

`{"ok":true,...}` means the API is up **and** reached Neon.

## 3. App (Vercel)

**Add New → Project**, pick this repository, and set:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Build Command | *(leave default)* — [`frontend/vercel.json`](../frontend/vercel.json) sets it |
| Output Directory | *(leave default)* — same |
| Environment Variable | `EXPO_PUBLIC_API_URL` = the Render URL, **no trailing slash** |

Both services deploy from **`main`**. While this work lives on `free-deploy`,
publish it by fast-forwarding main on the deployment repo:

```bash
git push personal free-deploy:main
```

Once `free-deploy` merges upstream, that step goes away.

> `EXPO_PUBLIC_` is load-bearing. Expo ignores any other prefix, and the app then
> fails at its first API call with no explanation. The value is inlined at build
> time, so **changing it requires a redeploy**, not just a restart.

## 4. CORS (back to Render)

Add the Vercel URL to `CORS_ORIGINS` on the Render service:

```
https://shpe-web-app.vercel.app
```

Comma-separate to add preview URLs. An empty value allows every origin — fine
locally, wrong in production.

---

## Keeping it awake

A Render free web service **sleeps after about 15 minutes idle**, and waking it
takes up to a minute. Landing on the login screen and waiting that long is the
worst thing this stack does. The app says "it may be waking up" rather than
"network error", but the fix is to stop it sleeping:

Point a free uptime pinger — [UptimeRobot](https://uptimerobot.com) or
[cron-job.org](https://cron-job.org) — at `https://shpe-api.onrender.com/healthz`
every 10 minutes.

Use `/healthz`, not `/healthz/db`: the pinger should not hold Neon awake too.

**Do not use GitHub Actions for this.** On a private repo a 10-minute ping bills
roughly 4,300 minutes a month against a 2,000-minute allowance. An external
pinger is free and unmetered.

Render's free tier allows 750 instance-hours a month and a month is about 730,
so one always-awake service fits — with no room for a second.

---

## Local development

```bash
cp example.env .env
```

Fill in `DATABASE_URL` and `JWT_SECRET`. Any long random string works for the
secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

A throwaway local database, if you would rather not point at Neon:

```bash
docker run -d --name shpe-pg -e POSTGRES_USER=shpe -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=shpe -p 55432:5432 postgres:17-alpine
```

That maps to `postgresql://shpe:devpass@localhost:55432/shpe`.

Apply the schema, then run both halves:

```bash
npm install && npm run db:migrate && npm start
```

```bash
cd frontend && cp example.env .env && npm install && npx expo start -c --web
```

`frontend/.env` needs `EXPO_PUBLIC_API_URL=http://localhost:5000`.

---

## Checks

```bash
npm run typecheck && npm test
```

```bash
cd frontend && npx tsc --noEmit && npx expo lint
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| First request takes ~50s, then everything is fast | Render woke from sleep. Set up the pinger. |
| "Could not reach the server" | Render asleep or down, or `EXPO_PUBLIC_API_URL` is wrong. |
| CORS error in the browser console | The Vercel origin is missing from `CORS_ORIGINS`. Exact scheme and host, no trailing slash. |
| Every API call fails right after a config change | `EXPO_PUBLIC_API_URL` is baked in at build time — redeploy Vercel. |
| Hard refresh on `/events-info/<id>` 404s | The rewrite in `frontend/vercel.json` is missing or Output Directory is wrong. |
| Deploy fails during build on `db:migrate` | `DATABASE_URL` unset or unreachable from Render. |
| Everyone signed out at once | `JWT_SECRET` changed. |
