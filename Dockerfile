# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Install dependencies first (better layer caching).
# patches/ is required because pnpm applies a patched dependency (wouter).
COPY package.json pnpm-lock.yaml ./
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

COPY . .
RUN pnpm build

# ---- Runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# The server is bundled with `esbuild --packages=external`, AND it statically imports
# `vite` (via the dev/prod branch in server/_core/vite.ts). The FULL dependency set
# must therefore be present at runtime — do NOT prune to production-only deps.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
# NODE_ENV is set above, so we run node directly (no need for cross-env here).
CMD ["node", "dist/index.js"]
