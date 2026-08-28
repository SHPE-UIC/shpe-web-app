# shpe-web-app

The SHPE @ UIC member app. Two halves in one repository:

- `frontend/` — the Expo app (web, iOS, Android), deployed to Vercel
- `backend/` — an Express + Drizzle API over Postgres, deployed to Render

## Docs

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — how it is hosted, what is still
  to set up, and troubleshooting
- **[docs/PERMISSIONS.md](docs/PERMISSIONS.md)** — who can do what, and where
  each rule is enforced

## Running it locally

Both halves need to be running. The API first:

```bash
cp example.env .env && npm install && npm run db:migrate && npm start
```

`.env` needs a `DATABASE_URL` and a `JWT_SECRET`; see the file's comments, or
`docs/DEPLOYMENT.md` for a throwaway Postgres in Docker.

Then the app, in a second terminal:

```bash
cd frontend && cp example.env .env && npm install && npx expo start -c
```

`frontend/.env` needs `EXPO_PUBLIC_API_URL=http://localhost:5000`. Press `w` for
web, or scan the QR code with Expo Go.

## Checks

```bash
npm run typecheck && npm test
```

```bash
cd frontend && npx tsc --noEmit && npx expo lint
```
