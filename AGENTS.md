# AGENTS.md — DatacenterMarket

AI-compute / datacenter-capacity marketplace (edited by **Anavim Advisory**). Lead → AI matching →
offer → Stripe checkout → provisioning → client/admin dashboards. Manus WebDev template:
React 19 + Vite + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM (MySQL) + Manus OAuth.

## Commands

```bash
pnpm install            # full install (NOT --prod — the server bundle imports vite at runtime)
pnpm dev                # dev server (cross-env handles NODE_ENV on Windows)
pnpm check              # tsc --noEmit  (run after every change)
pnpm test               # vitest run   (server unit tests; db is mocked)
pnpm build              # vite -> dist/public, SEO files + prerender, esbuild -> dist/index.js + db-preflight.js
pnpm start              # production (NODE_ENV=production node dist/index.js)
pnpm db:push            # drizzle-kit generate && migrate
pnpm db:seed            # seed the offers catalogue (idempotent; demo suppliers, fail-closed)
pnpm db:preflight       # read-only migration/schema check (runs before start in Docker)
pnpm db:purge           # RGPD: delete stale unconverted leads (LEAD_RETENTION_DAYS, default 730)
pnpm db:cancel-stale    # cancel abandoned pending/unpaid orders (STALE_ORDER_HOURS, default 24)
pnpm integration-check  # end-to-end funnel against a REAL db (needs DATABASE_URL + db:push + db:seed)
pnpm stripe:smoke       # live-ish Stripe checkout smoke test (needs STRIPE_SECRET_KEY)
```

## Architecture

Edit app code only; `server/_core/**` is framework plumbing (touch only to extend infra, e.g. the
Stripe webhook / `/health` route).

```
drizzle/schema.ts        tables + types (source of truth)
server/db.ts             query helpers (return raw rows)
server/routers.ts        tRPC procedures (auth, leads, offers, orders, provisioning, metrics, admin)
server/matching.ts       pure offer-ranking engine (best_value / fastest / cheapest)
server/stripe.ts         Stripe client, Checkout session builder, signed webhook handler
server/rateLimit.ts      sliding-window limiter (in-memory default, Redis store via REDIS_URL)
server/inventory.ts      pure sellability rules (fail-closed: active + supplier active + fresh capacity)
server/orderLifecycle.ts allowed order/provisioning status transitions
server/leadClaim.ts      HMAC claim token proving ownership of an anonymous lead
server/provisioningStream.ts  SSE stream of provisioning events
server/telemetry.ts      GPU/CPU telemetry ingestion + telemetryAlerts.ts thresholds
server/clientNotifications.ts transactional client e-mails (order confirmed, ready, payment failed)
server/dbPreflight.ts    migration/schema drift check run at container start
scripts/generate-seo-files.ts  sitemap.xml + robots.txt   ·  scripts/prerender.ts  static HTML snapshots
shared/seo.ts            per-route SEO source of truth (canonical, hreflang, JSON-LD)
client/src/pages/*        route components (lazy-loaded in App.tsx)
client/src/lib/trpc.ts    typed tRPC client (types flow from AppRouter — no codegen)
shared/                   constants/types shared client+server
```

Data flow: define procedure in `routers.ts` → consume with `trpc.*.useQuery/useMutation`. Types are
inferred end-to-end; never hand-write client contracts.

## Invariants (do not regress these)

- **Pricing is server-side.** Order amounts are derived from the offer in the DB
  (`createPendingOrder`), never from client input.
- **Stripe webhook is the source of truth** for payment. `orders.checkout` only creates a *pending*
  order + Checkout session; `applyStripeEvent` (webhook) flips it to paid. `orders.updatePaymentStatus`
  / `updateStatus` are **admin-only**.
- **Lead lifecycle:** `new` → `offered` (checkout started, in `createPendingOrder`) → `converted`
  (only on payment success, in `applyStripeEvent`). Don't mark converted before payment.
- **Authorization:** read procedures for leads/orders are owner-or-admin (`requireOwnedOrder`, and the
  lead PII check). Ordering against a lead requires owning it (anonymous leads are claimed by the
  ordering user in `createPendingOrder`). Admin-only writes (incl. `leads.update`) use `adminProcedure`.
  The public `leads.create` is rate-limited per client IP — `clientIp` relies on `req.ip` + Express
  `trust proxy` (set in production via `TRUST_PROXY_HOPS`, default 1); never read X-Forwarded-For directly.
- **RGPD:** lead capture requires explicit consent (WorkloadForm); erasure via `leads.delete`;
  retention via `db:purge`.

## Testing

Unit tests (`server/*.test.ts`) mock `./db` and exercise router/matching/stripe logic. Auth is faked
via `appRouter.createCaller(ctx)`. Real-DB behavior (queries, insertId, decimals) is covered by
`pnpm integration-check`, which is skipped/guarded unless `DATABASE_URL` is set.

## Known gaps / parked (need external input)

- **Stripe live**: implemented; needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to activate. One
  unverified assumption: a one-time line item inside a `subscription`-mode session (see DEPLOYMENT.md §10).
- **GPU/CPU telemetry**: ingestion route `POST /api/telemetry/:orderId` exists (needs
  `TELEMETRY_INGEST_KEY` + a provider agent to push data); `pnpm db:telemetry` simulates it in dev.
- **Error monitoring (Sentry)**: wired server + client; needs `SENTRY_DSN` / `VITE_SENTRY_DSN` to activate.
- **Local Docker is unusable on this machine** (insufficient memory / paging file + broken containerd
  storage) — for a live DB, use a cloud MySQL/TiDB rather than Docker.

## Dependency constraints

- The pnpm override for `path-to-regexp` must stay within the 0.1.x line (`>=0.1.13 <0.2.0`):
  express 4 requires the 0.1.x callable API. A bare `>=0.1.13` resolves to 8.x and crashes the
  server at startup (`pathRegexp is not a function`). Watch for automated audit tooling
  reintroducing the broken range.

See `DEPLOYMENT.md` for the production runbook and `.env.example` for all variables.
