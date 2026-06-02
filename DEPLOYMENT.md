# Deployment Guide — DatacenterMarket

Production runbook for the tRPC + React + Express stack.

## 1. Prerequisites

- **Node.js 22** and **pnpm** (via `corepack enable` — the version is pinned in `package.json`).
- A **MySQL / TiDB** database, reachable via `DATABASE_URL`.
- Manus OAuth credentials and the built-in Forge API key (see `.env.example`).

## 2. Environment variables

Copy `.env.example` to `.env` and fill it in. Two categories:

- **Runtime (server)** — `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`,
  `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `PORT`, `LEAD_RETENTION_DAYS`.
- **Build time (`VITE_*`)** — `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`,
  `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY`, analytics (optional).

> ⚠️ **Build-time vs runtime.** `VITE_*` variables are **inlined into the client bundle by
> Vite when you run `pnpm build`**. Setting them only at runtime has no effect — they must be
> present during the build (Docker: pass as `--build-arg`; CI: set as secrets).

## 3. Install, migrate, build, run

```bash
corepack enable
pnpm install --frozen-lockfile     # full install (see note below)
pnpm db:push                       # create/apply schema migrations (drizzle-kit)
pnpm db:seed                       # seed the offers catalogue (idempotent)
pnpm build                         # vite build -> dist/public, esbuild -> dist/index.js
pnpm start                         # NODE_ENV=production node dist/index.js
```

Build output:
- `dist/public/` — static client assets (served by Express in production).
- `dist/index.js` — bundled server (~46 KB).

> ⚠️ **Do not prune to production-only dependencies.** The server is bundled with
> `esbuild --packages=external` and statically imports `vite` (via the dev/prod branch in
> `server/_core/vite.ts`). Running with only `--prod` deps crashes at startup on the missing
> `vite` import. Install the **full** dependency set in the runtime environment.

## 4. Docker

A production `Dockerfile` is included.

```bash
docker build \
  --build-arg VITE_APP_ID=... \
  --build-arg VITE_OAUTH_PORTAL_URL=... \
  --build-arg VITE_FRONTEND_FORGE_API_URL=... \
  --build-arg VITE_FRONTEND_FORGE_API_KEY=... \
  -t datacenter-market .

docker run -p 3000:3000 --env-file .env datacenter-market
```

(Runtime/server env vars come from `--env-file`; `VITE_*` are baked in at build time via
the build args above.)

## 5. Database migrations

- `pnpm db:push` runs `drizzle-kit generate && drizzle-kit migrate`. Run it on every deploy
  that changes `drizzle/schema.ts`.
- Migrations live in `drizzle/`. Review generated SQL before applying in production.

## 6. RGPD data retention (cron)

Schedule the retention job to purge stale, unconverted leads (default 24 months,
`LEAD_RETENTION_DAYS`). It never deletes leads tied to an order.

```bash
pnpm db:purge
```

Example daily cron: `0 3 * * *  cd /app && pnpm db:purge >> /var/log/purge.log 2>&1`

Also schedule **`pnpm db:cancel-stale`** (e.g. hourly) to cancel abandoned checkouts — orders left
pending/unpaid past `STALE_ORDER_HOURS` (default 24h). Paid orders are never affected.

## 7. Backups

- Enable **automated backups / point-in-time recovery** on the managed MySQL/TiDB instance.
- Verify restores periodically. The app keeps no other persistent state (uploads go to S3 via
  the Forge storage proxy).

## 8. Continuous integration

`.github/workflows/ci.yml` runs `install → check → test → build` on push/PR. Add the
`VITE_*` repo secrets for a deploy-ready build artifact.

## 9. Health & observability — known gaps

- **Health endpoint**: `GET /health` returns `{ "status": "ok" }` for liveness probes.
- **No structured logging / error monitoring** (Sentry) — deferred (needs a dependency).
- **Rate limiting** on the public `leads.create` endpoint is in place (in-memory, 5 req/min per
  IP — `server/rateLimit.ts`). It is **process-local**; for multi-instance deployments back it
  with a shared store such as Redis. Set `app.set("trust proxy", ...)` so `req.ip` is accurate
  behind a load balancer.

## 10. Payments (Stripe)

Checkout uses **Stripe-hosted Checkout** (subscription mode) with a signed webhook as the
source of truth for payment status.

1. Set `STRIPE_SECRET_KEY` (runtime).
2. In the Stripe dashboard, add a webhook endpoint pointing at `POST /api/stripe/webhook`,
   subscribe to `checkout.session.completed`, and put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.
3. Behind a load balancer, set `app.set("trust proxy", ...)` so request origins / IPs resolve.

Flow: `orders.checkout` creates a pending order + a Checkout Session and returns its URL; the
browser is redirected to Stripe; on success Stripe returns to `/confirmation?orderId=...`; the
webhook flips the order to `paymentStatus: succeeded` / `status: processing`. Until
`STRIPE_SECRET_KEY` is set, `orders.checkout` returns `SERVICE_UNAVAILABLE`.
`orders.updatePaymentStatus` / `updateStatus` stay admin-only (the webhook writes status).

> The setup fee is sent as a one-time line item alongside the recurring monthly price. If your
> Stripe API version rejects one-time items in subscription mode, move it to
> `subscription_data.add_invoice_items`.

## 11. Still simulated / absent

- **GPU/CPU telemetry**: the client dashboard shows "Awaiting telemetry" — nothing writes to
  `infrastructureMetrics` yet (no provider ingestion).
- **Error monitoring (Sentry)**: not wired (needs a DSN + dependency).
