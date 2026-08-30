# The API runs TypeScript directly through tsx (a runtime dependency), so the
# image needs no build stage — just production dependencies and source.
FROM node:22-slim

# Repo root as the working directory: migrate.ts resolves its migrationsFolder
# ('drizzle') relative to cwd, and npm start expects backend/src from here.
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY backend ./backend

USER node

# Cloud Run injects PORT=8080; env.ts honors it.
CMD ["npm", "start"]
