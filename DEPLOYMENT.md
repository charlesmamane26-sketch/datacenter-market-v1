# Deployment Guide — DatacenterMarket

Production runbook for the tRPC + React + Express stack.

## 0. Deployment checklist

Tick these before every production deploy. Details in the linked sections.

**Environment (§2)**
- [ ] `PUBLIC_BASE_URL` set to the public origin, e.g. `https://app.example.com` — **required in
      production**: the server throws on startup of any Stripe/OAuth flow if it is missing (it is
      the trusted source for Stripe success/cancel URLs and OAuth state validation, replacing the
      spoofable `Host` header).
- [ ] `CSP_EXTRA_ORIGINS` set (space-separated) with the analytics (Umami), OAuth portal, and
      Sentry-ingest origins your build uses — anything beyond Google Fonts + the Forge maps proxy,
      which are already allowed. Omit if none apply.
- [ ] `REDIS_URL` set **if running more than one instance** — enables the shared rate-limit store
      **and** server-side session revocation. Without it both fall back to per-process / disabled
      (fine for a single instance). One Redis connection is shared by both features.
- [ ] All prior runtime + `VITE_*` build-time vars filled (§2). Remember `VITE_*` are baked in at
      **build** time.

**Database (§5)**
- [ ] `pnpm db:push` applies migrations **`0002`** (indexes on FK columns) and **`0003`**
      (drops the unused `offers.category` column). Review the SQL first; both are non-destructive
      to data except the intended `DROP COLUMN category`.

**Install / build (§3)**
- [ ] `pnpm install` (full set — not `--prod`; regenerates `pnpm-lock.yaml` and pulls the optional
      `ioredis` if `REDIS_URL` is used).
- [ ] `pnpm build` with the `VITE_*` vars present.

**Smoke test (staging)**
- [ ] OAuth login + logout (with Redis: confirm the session is actually revoked after logout).
- [ ] A page with the map renders (CSP not blocking the Forge maps proxy / Google Fonts).
- [ ] One end-to-end Stripe payment reaches `paymentStatus: succeeded` via the webhook.

## 1. Prerequisites

- **Node.js 22** and **pnpm** (via `corepack enable` — the version is pinned in `package.json`).
- A **MySQL / TiDB** database, reachable via `DATABASE_URL`.
- Manus OAuth credentials and the built-in Forge API key (see `.env.example`).

## 2. Environment variables

Copy `.env.example` to `.env` and fill it in. Two categories:

- **Runtime (server)** — `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`,
  `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `PORT`, `LEAD_RETENTION_DAYS`,
  **`PUBLIC_BASE_URL`** (required in prod — trusted origin), **`CSP_EXTRA_ORIGINS`** (optional —
  extra CSP origins, space-separated), **`REDIS_URL`** (optional — shared rate-limit + session
  revocation; needed for multi-instance).
- **Build time (`VITE_*`)** — `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`,
  `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY`, analytics (optional).

> ⚠️ **Build-time vs runtime.** `VITE_*` variables are **inlined into the client bundle by
> Vite when you run `pnpm build`**. Setting them only at runtime has no effect — they must be
> present during the build (Docker: pass as `--build-arg`; CI: set as secrets).

## 3. Install, migrate, build, run

```bash
corepack enable
pnpm install --frozen-lockfile     # full install (see notes below)
pnpm db:push                       # create/apply schema migrations (drizzle-kit)
pnpm db:seed                       # seed the offers catalogue (idempotent)
pnpm build                         # vite build -> dist/public, esbuild -> dist/index.js
pnpm start                         # NODE_ENV=production node dist/index.js
```

Build output:
- `dist/public/` — static client assets (served by Express in production).
- `dist/index.js` — bundled server (~46 KB).

> ⚠️ **First install after the phase-2 merge.** The `pnpm.overrides` were consolidated, so the
> committed `pnpm-lock.yaml` is stale. Run a plain `pnpm install` once (without `--frozen-lockfile`)
> to regenerate the lockfile and commit it; subsequent installs can use `--frozen-lockfile` again.

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
- Current pending migrations: **`0002`** adds indexes on the FK columns (`leads.userId`,
  `orders.userId`+`createdAt`, `orders.leadId`, `orders.offerId`, `provisioningEvents.orderId`,
  `infrastructureMetrics.orderId`+`recordedAt`) — query-pattern aligned, no data change; **`0003`**
  drops the unused `offers.category` column (the matching engine computes views per lead, and the
  API still attaches `category` to each offer at response time).

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
- **Rate limiting** covers `leads.create` (5/min/IP), `/api/oauth/callback` (20/min/IP), the Stripe
  webhook (100/min/IP), and `checkout` (10/min/user). The store is in-memory by default
  (**process-local**) and switches to a shared Redis sliding-window when `REDIS_URL` is set — set it
  for multi-instance deployments. Set `app.set("trust proxy", ...)` so `req.ip` is accurate behind a
  load balancer (already done in production via `TRUST_PROXY_HOPS`).
- **Content-Security-Policy** is enabled (helmet). `script-src` is strict in production (no
  `'unsafe-inline'`); dev is loosened for Vite HMR. Add deployment-specific origins via
  `CSP_EXTRA_ORIGINS` (§2). If a CSP-blocked resource breaks a page, check the browser console and
  widen that env var.
- **Session revocation**: logout denylists the token's `jti` in Redis for its remaining lifetime,
  so a token copied before logout cannot be replayed. Requires `REDIS_URL`; without it, logout only
  clears the cookie (the JWT stays valid until it expires — accepted for single-instance).

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
