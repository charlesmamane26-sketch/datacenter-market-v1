export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Trusted public origin (e.g. https://app.example.com). When set, it is the
  // source of truth for building absolute URLs and validating the OAuth state,
  // instead of attacker-influenceable Host / X-Forwarded-Proto headers.
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // Shared bearer key a provider-side agent uses to POST real GPU/CPU telemetry
  // to /api/telemetry/:orderId. Unset -> ingestion route disabled (503).
  telemetryIngestKey: process.env.TELEMETRY_INGEST_KEY ?? "",
};
