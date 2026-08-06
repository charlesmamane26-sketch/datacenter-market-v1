# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Install dependencies first (better layer caching). pnpm-workspace.yaml is
# required here: it owns the security overrides, patchedDependencies mapping and
# build-script allow-list used by this install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# patches/ is required because pnpm applies a patched dependency (wouter).
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# VITE_* variables are inlined into the client bundle at BUILD time — pass them as
# build args (e.g. --build-arg VITE_APP_ID=...). The build still succeeds without
# them, but the login URL / frontend API calls will be misconfigured.
ARG VITE_APP_ID
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_FRONTEND_FORGE_API_URL
ARG VITE_FRONTEND_FORGE_API_KEY
ARG VITE_ANALYTICS_ENDPOINT
ARG VITE_ANALYTICS_WEBSITE_ID
# Canonical public origin (SEO: canonicals, Open Graph, sitemap.xml, robots.txt,
# prerendered pages). Falls back to https://www.datacentermarket.fr if unset.
ARG VITE_SITE_URL
ARG VITE_SENTRY_DSN

COPY . .
RUN pnpm build
# Vite and the CSS/test toolchain are loaded dynamically in development only.
# Prune them after the build so the runtime image contains production packages.
RUN pnpm prune --prod

# ---- Runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# The server bundle externalizes npm packages, so retain all production and
# optional dependencies (including mysql2/ioredis) but no build/test toolchain.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/package.json ./package.json

# Run unprivileged: a compromise of the Node process must not yield container root.
USER node

EXPOSE 3000
# Refuse to activate a new container when its database cannot be reached or the
# timestamp/hash of any committed migration is absent or different. The preflight issues SELECTs only; it
# never applies migrations. `exec` preserves correct SIGTERM handling for Node.
CMD ["sh", "-c", "node dist/db-preflight.js && exec node dist/index.js"]
