# Deployment Guide — DatacenterMarket

Production runbook for the tRPC + React + Express stack.

## 0. Deployment checklist

Tick these before every production deploy. Details in the linked sections.

**Environment (§2)**

- [ ] `PUBLIC_BASE_URL` set to the public origin, e.g. `https://app.example.com` — **required in
      production**: the server throws on startup of any Stripe/OAuth flow if it is missing (it is
      the trusted source for Stripe success/cancel URLs and OAuth state validation, replacing the
      spoofable `Host` header).
- [ ] `JWT_SECRET` is a newly generated random secret (for example `openssl rand -hex 32`), not
      the placeholder from an example file. Production startup rejects missing, known-placeholder,
      repeated and low-entropy values.
- [ ] `CSP_EXTRA_ORIGINS` set (space-separated) with the analytics (Umami), OAuth portal, and
      Sentry-ingest origins your build uses — anything beyond Google Fonts + the Forge maps proxy,
      which are already allowed. Omit if none apply.
- [ ] `REDIS_URL` set **if running more than one instance** — enables the shared rate-limit store
      **and** shared server-side session revocation. Without it both fall back to process-local
      state (fine for a single instance). One Redis connection is shared by both features.
- [ ] All prior runtime + `VITE_*` build-time vars filled (§2). Remember `VITE_*` are baked in at
      **build** time.
- [ ] If `STRIPE_SECRET_KEY` is a live key, `STRIPE_LIVE_PAYMENTS_ENABLED=true` only after the
      provider, contract, webhook and end-to-end payment checks in §10. Keep it `false` otherwise.

**Database (§5)**

- [ ] Run `pnpm db:generate` during development after schema changes, review the generated SQL,
      and commit it. From a controlled production migration job, run **only** `pnpm db:migrate`.
- [ ] `pnpm db:preflight` passes against the target database. This command is **read-only**: it
      verifies connectivity and every journaled migration's exact timestamp + SQL hash; it
      never creates a table or applies SQL.
- [ ] ⚠️ **Apply migrations _before_ deploying the new code.** `leads.create` now writes the consent
      columns from `0004`, while checkout requires the Stripe journal/idempotency columns from
      `0005` and inventory filtering requires the provider/availability fields from `0006`.
      Shipping the code first breaks those flows. These migrations are additive and can be applied
      before the new code.

**Install / build (§3)**

- [ ] `pnpm install --frozen-lockfile` installs the full build/test toolchain without changing the
      reviewed lockfile; the Docker build prunes development-only packages after compilation.
- [ ] `pnpm build` with the `VITE_*` vars present.
- [ ] `pnpm audit:prod` passes before publishing the image.

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
  `STRIPE_WEBHOOK_SECRET`, **`STRIPE_LIVE_PAYMENTS_ENABLED`** (live-key safety gate), `PORT`,
  `LEAD_RETENTION_DAYS`,
  **`PUBLIC_BASE_URL`** (required in prod — trusted origin), **`CSP_EXTRA_ORIGINS`** (optional —
  extra CSP origins, space-separated), **`REDIS_URL`** (optional — shared rate-limit + session
  revocation; needed for multi-instance), **`SENTRY_DSN`** (optional — server error monitoring),
  **`DB_READINESS_TIMEOUT_MS`** (optional, default 5000) and **`DB_PREFLIGHT_TIMEOUT_MS`**
  (optional, default 10000),
  **`STRIPE_SMOKE_TEST_ENABLED`** (command-local opt-in only; keep false otherwise),
  **`TELEMETRY_PROVIDER_KEYS`** (optional JSON object mapping provider IDs to independent random
  keys of at least 32 characters; enables telemetry ingestion, §11), **`TELEMETRY_INGEST_KEY`**
  (legacy local-development fallback only; production rejects it), **`STORAGE_PUBLIC_PREFIXES`**
  (optional comma-separated allow-list for `/manus-storage/*`; configure it in production),
  **`EMAIL_API_URL`** + **`EMAIL_API_KEY`** (optional — client email notifications; unset = log only),
  **`ALERT_GPU_USAGE_PCT`** / **`ALERT_CPU_USAGE_PCT`** / **`ALERT_GPU_MEMORY_PCT`** (optional —
  telemetry alert thresholds, defaults 95/95/90).
- **Build time (`VITE_*`)** — `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`,
  `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY`, analytics (optional).

> ⚠️ **Build-time vs runtime.** `VITE_*` variables are **inlined into the client bundle by
> Vite when you run `pnpm build`**. Setting them only at runtime has no effect — they must be
> present during the build (Docker: pass as `--build-arg`; CI: set as secrets).

## 3. Install, migrate, build, run

```bash
corepack enable
pnpm install --frozen-lockfile     # reproducible build/test dependency install
pnpm db:generate                   # development only: generate SQL after a schema change
pnpm db:migrate                    # controlled deployment job: apply committed migrations
pnpm db:preflight                  # SELECT-only: connectivity + every migration timestamp/hash
pnpm db:seed                       # seed inactive DEMO rows; verify/activate inventory in admin
pnpm build                         # vite build -> dist/public, esbuild -> dist/index.js
pnpm start                         # NODE_ENV=production node dist/index.js
```

`pnpm integration-check` creates its own active provider/offer with run-unique identifiers, then
removes them with every other test row even when the check fails. The temporary offer also expires
after 15 minutes as a hard-kill fallback. Do not activate the DEMO seed rows just to run this check.

Build output:

- `dist/public/` — static client assets (served by Express in production).
- `dist/index.js` — bundled server (~46 KB).
- `dist/db-preflight.js` — read-only database/migration gate used by the container entrypoint.

The build stage needs development dependencies. The production server loads Vite and its config
only in development, so the included Dockerfile safely runs `pnpm prune --prod` after compilation
and copies the pruned dependency tree into the runtime image.

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
the build args above.) The image runs `db-preflight.js` before Node: a new container never becomes
active against an unreachable database or one missing/drifting any repository migration. The check
only issues `SELECT` statements; apply migrations explicitly before deploying.

## 5. Database migrations

- `pnpm db:generate` creates a migration after a deliberate `drizzle/schema.ts` change. Review and
  commit the generated SQL and journal metadata in the same pull request. CI regenerates migrations
  and fails when `drizzle/` has uncommitted drift.
- `pnpm db:migrate` applies only already committed migrations. Run it once from a controlled
  migration job before deploying code that depends on the new schema. `pnpm db:push` remains a
  compatibility alias for this migrate-only operation; it no longer generates SQL during deploy.
- `pnpm db:preflight` is the non-mutating counterpart for CI/CD and operator checks. It compares
  **every** entry in `drizzle/meta/_journal.json` (timestamp + SHA-256 of the exact SQL bytes) with
  `__drizzle_migrations`, and requires the journal and `drizzle/*.sql` file set to match exactly.
  It exits non-zero on missing credentials, connectivity failure, any pending migration or hash
  drift and never logs the connection string / raw driver error. `.gitattributes` forces migration
  SQL to LF so hashes remain deterministic across Windows and Linux checkouts.
- If migrations were already applied from a Windows checkout before the LF rule existed, run the
  preflight before rollout. On a hash mismatch, compare the recorded hash and SQL effects under a
  backup/PITR window; only reconcile `__drizzle_migrations` after proving the bytes differ solely by
  CRLF/LF. Never re-run or blindly rewrite an already-applied migration.
- Migrations live in `drizzle/`. Review generated SQL before applying in production.
- **Apply migrations before deploying the new server code** (see §0): `leads.create` writes the
  consent columns added by `0004`.
- Migrations: **`0002`** adds indexes on the FK columns (`leads.userId`, `orders.userId`+`createdAt`,
  `orders.leadId`, `orders.offerId`, `provisioningEvents.orderId`, `infrastructureMetrics.orderId`+
  `recordedAt`) — query-pattern aligned, no data change; **`0003`** drops the unused `offers.category`
  column (the matching engine computes views per lead, and the API still attaches `category` to each
  offer at response time); **`0004`** adds `leads.consentedAt` + `leads.consentPolicyVersion` (both
  nullable) to record RGPD proof-of-consent — additive, no data change; **`0005`** adds the durable
  Stripe event journal plus checkout/subscription/idempotency evidence and indexes used by the
  webhook flow; **`0006`** creates `providers`, adds fail-closed offer activation/capacity/freshness
  and snapshots `providerId` on each order. Migrated and seeded rows stay inactive/unavailable until
  an operator verifies the supplier, price, SLA and expiry, then explicitly activates them in admin.
  `availableCapacity` is an operator snapshot used as a sales gate, not yet a reservation ledger.

## 6. RGPD data retention (cron)

Schedule the retention job to purge stale, unconverted leads (default 24 months,
`LEAD_RETENTION_DAYS`). It deletes every non-`converted` lead past the window (including
abandoned `offered`/`qualified` prospects) and only spares leads still tied to a **non-cancelled**
order — so PII from abandoned checkouts is not retained indefinitely.

```bash
pnpm db:purge
```

Example daily cron: `0 3 * * *  cd /app && pnpm db:purge >> /var/log/purge.log 2>&1`

Also schedule **`pnpm db:cancel-stale`** (e.g. hourly) to cancel abandoned checkouts — orders left
pending/unpaid past `STALE_ORDER_HOURS` (default 24h). Paid orders are never affected.
The bundled GitHub Actions workflow reads repository variables `LEAD_RETENTION_DAYS` (default 730)
and `STALE_ORDER_HOURS` (default 24); set those variables to change the retention windows without
editing the workflow.

## 7. Backups

- Enable **automated backups / point-in-time recovery** on the managed MySQL/TiDB instance.
- Verify restores periodically. The app keeps no other persistent state (uploads go to S3 via
  the Forge storage proxy).

## 8. Continuous integration

`.github/workflows/ci.yml` runs a frozen install, production dependency audit, migration-drift
check, typecheck, tests and build on push/PR. Add the `VITE_*` repo secrets for a deploy-ready build
artifact. Keep the reviewed `pnpm-lock.yaml` committed.

## 9. Health & observability

- **Health endpoint**: `GET /health` returns `{ "status": "ok" }` for liveness probes.
- **Readiness endpoint**: `GET /ready` returns `200` only when MySQL/TiDB answers, configured Redis
  answers, and Stripe, OAuth, public HTTPS origin, owner and telemetry configuration are coherent;
  otherwise it returns `503`. Its response exposes only states such as `ready`, `disabled`,
  `unavailable` and `misconfigured`, never credential values.
  Render probes `/health`
  so a transient external dependency outage does not restart a healthy process; monitor `/ready`
  separately for dependency availability. Tune the database query timeout with
  `DB_READINESS_TIMEOUT_MS` (default 5000 ms).
- **Render Blueprint scope**: `render.yaml` deliberately keeps `plan: free` for staging/recette
  only. Free instances can sleep and are not the production target.
- **Sentry error monitoring** is wired but remains disabled until its DSN is configured.
- **Rate limiting** covers `leads.create` (5/min/IP), `/api/oauth/callback` (20/min/IP), the Stripe
  webhook (100/min/IP), `orders.checkout` (10/min/user), and `/manus-storage/*` (120/min/IP). tRPC
  HTTP batches are capped at 10 operations before authentication/context work. The store is
  in-memory by default
  (**process-local**) and switches to a shared Redis sliding-window when `REDIS_URL` is set — set it
  for multi-instance deployments. Set `app.set("trust proxy", ...)` so `req.ip` is accurate behind a
  load balancer (already done in production via `TRUST_PROXY_HOPS`).
- **Content-Security-Policy** is enabled (helmet). `script-src` is strict in production (no
  `'unsafe-inline'`); dev is loosened for Vite HMR. Add deployment-specific origins via
  `CSP_EXTRA_ORIGINS` (§2). If a CSP-blocked resource breaks a page, check the browser console and
  widen that env var.
- **Session revocation**: logout denylists the token's `jti` for its remaining lifetime, so a token
  copied before logout cannot be replayed. A single instance uses process-local state. With
  `REDIS_URL`, instances share revocations and production authentication fails closed while the
  configured Redis service is unavailable.
- **Shutdown**: `SIGTERM` and `SIGINT` stop accepting new requests, drain active connections, close
  Redis, flush monitoring and force-close after the bounded grace period.

## 10. Payments (Stripe)

Checkout uses **Stripe-hosted Checkout** (subscription mode) with a signed webhook as the
source of truth for payment status.

1. Set `STRIPE_SECRET_KEY` (runtime).
   - test key (`sk_test_…` or restricted `rk_test_…`): no additional gate;
   - live key (`sk_live_…` or restricted `rk_live_…`): also set
     `STRIPE_LIVE_PAYMENTS_ENABLED=true`, but only after the
     staging/live checklist below. With the default `false`, the server refuses to initialize a
     live Stripe client. Unknown key prefixes are always refused.
2. In the Stripe dashboard, add a webhook endpoint pointing at `POST /api/stripe/webhook`, put its
   signing secret in `STRIPE_WEBHOOK_SECRET`, and subscribe to:
   - `checkout.session.completed` (required);
   - `checkout.session.async_payment_succeeded` **and** `checkout.session.async_payment_failed`
     — **required if you enable a deferred payment method** (SEPA debit, bank transfer…). The
     handler only fulfils on `payment_status === "paid"` and reconciles async outcomes via these
     events. Card-only checkout needs just `checkout.session.completed`.
     Checkout remains disabled until the API key and a valid `whsec_…` signing secret are both set;
     production additionally requires a path-free HTTPS `PUBLIC_BASE_URL` origin.
3. Behind a load balancer, set `app.set("trust proxy", ...)` so request origins / IPs resolve.

Before live activation, run the opt-in `pnpm stripe:smoke` once with a test key. It makes real
Stripe test-API calls, verifies the exact EUR amounts, monthly interval, metadata and return URLs
for one recurring item plus the one-time setup fee, expires the session, then archives the inline
test Prices/Products it created. It accepts `sk_test_…`/`rk_test_…` and refuses every live or
unknown key. Set
`STRIPE_SMOKE_TEST_ENABLED=true` only for that command and unset it immediately afterwards.

Flow: `orders.checkout` creates a pending order + a Checkout Session and returns its URL; the
browser is redirected to Stripe; on success Stripe returns to `/confirmation?orderId=...`. The
webhook flips the order to `paymentStatus: succeeded` / `status: processing` **only when the session
is actually paid** (`payment_status === "paid"` / `no_payment_required`); a completed-but-unpaid
async session stays pending until its `async_payment_succeeded`/`_failed` event arrives (a failure
cancels the order). Until `STRIPE_SECRET_KEY` is set, `orders.checkout` returns
`SERVICE_UNAVAILABLE`. `orders.updatePaymentStatus` / `updateStatus` stay admin-only (the webhook
writes status; `updatePaymentStatus` never drags an already-advanced order back to `pending`).

> The setup fee is sent as a one-time line item alongside the recurring monthly price. If your
> Stripe API version rejects one-time items in subscription mode, move it to
> `subscription_data.add_invoice_items`.

## 11. Telemetry ingestion

The client dashboard reads `infrastructureMetrics`. Two ways to populate it:

- **Production** — a provider-side agent POSTs samples to `POST /api/telemetry/:orderId`,
  authenticated with its own bearer key. Set `TELEMETRY_PROVIDER_KEYS` to a JSON object such as
  `{"42":"a-provider-secret-of-at-least-32-characters"}`. The numeric key is the provider ID;
  ingestion verifies that it matches the order's provider, preventing one provider from writing
  another's metrics. An absent map disables the route (`503`); an invalid map makes readiness fail.
  The legacy global `TELEMETRY_INGEST_KEY` is accepted only outside production and causes production
  readiness to fail if configured. Body is a JSON metric sample (all fields optional, validated by
  Zod): `gpuUsagePercent`, `gpuMemoryUsedGb`, `gpuMemoryTotalGb`,
  `cpuUsagePercent`, `ramUsedGb`, `ramTotalGb`, `costThisMonth`, `costProjected`. Unknown orders
  are rejected (`404`). Example:

  ```bash
  curl -X POST https://app.example.com/api/telemetry/42 \
    -H "Authorization: Bearer $PROVIDER_42_TELEMETRY_KEY" \
    -H "Content-Type: application/json" \
    -d '{"gpuUsagePercent":87.5,"cpuUsagePercent":33,"gpuMemoryTotalGb":640}'
  ```

- **Dev / demo** — `pnpm db:telemetry` runs `simulate-telemetry.ts`, writing random samples for
  active orders every 5s. Use it locally; do not run it in production.

## 12. Error monitoring (Sentry)

Sentry is **wired** (server + client); it activates when the DSN is set — no code change needed.

- **Server**: set `SENTRY_DSN` (runtime). `Sentry.init` + the Express error handler (registered
  after all controllers) come up automatically.
- **Client**: set `VITE_SENTRY_DSN` (**build time** — `VITE_*` are inlined at `pnpm build`).
  Browser tracing + session replay are enabled; trace headers propagate to this deployment's own
  `/api` origin.

## 13. Client notifications & alerting

- **Email notifications** (order confirmed, infra ready): set `EMAIL_API_URL` + `EMAIL_API_KEY`
  to point at a transactional email API (the server POSTs `{from, to, subject, text}`). Unset, sends
  are logged but not delivered — the funnel still works. Triggered best-effort from the Stripe webhook
  (payment success) and `provisioning.createEvent` (`ready` + `completed`).
- **Telemetry threshold alerting**: incoming metrics (§11) are checked against thresholds
  (`ALERT_GPU_USAGE_PCT` / `ALERT_CPU_USAGE_PCT` / `ALERT_GPU_MEMORY_PCT`, plus cost-over-projection).
  Alerts are pushed live to the client dashboard over the same SSE stream (`event: alert`) and emailed
  for critical severity. No extra wiring needed beyond the thresholds + email vars.

## 14. Admin CSV export

- The admin dashboard exports leads and orders to CSV (client-side, from tRPC data). No configuration.

## 15. Still simulated / absent

- Nothing outstanding from the original audit. Telemetry, Sentry, email notifications, and alerting
  are wired and only need their respective keys/DSN to activate.

## 16. SEO / performance

- **`VITE_SITE_URL` must be set at build time** (canonical domain): it drives the client
  canonicals/Open Graph AND `sitemap.xml` / `robots.txt` / the prerendered pages (scripts
  `seo:files` + `prerender`, both part of `pnpm build`). Default fallback is
  `https://www.datacentermarket.fr` (to be validated).
- **Enable gzip/brotli at the reverse proxy** (nginx/Caddy/CDN). The Express server serves
  static files uncompressed (`server/_core` is off-limits), so HTTP compression — and most of
  the mobile Lighthouse performance budget — must come from the proxy in front.
- Public indexable routes are prerendered at build into `dist/public/<route>/index.html`. Known
  client routes use the SPA fallback; funnel routes receive `X-Robots-Tag: noindex, nofollow`.
  Unknown paths return a real `404` instead of serving the home snapshot. `robots.txt` blocks API
  routes while leaving noindex pages crawlable so crawlers can observe the noindex directive.
- The Manus preview runtime (~625 KB of inline scripts) is excluded from production builds
  (see `vite.config.ts`); it stays active in `pnpm dev`.
- Fonts (Inter + JetBrains Mono) are self-hosted via `@fontsource` — no external font origin.
