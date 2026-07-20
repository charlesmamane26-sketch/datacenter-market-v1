import "dotenv/config";
import { offers, providers } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Seed data for the offers catalogue.
 * Run with: pnpm db:seed   (requires DATABASE_URL to be set)
 *
 * This is a flat catalogue of infrastructure configurations. The "best value / fastest /
 * cheapest" cards shown on the results screen are computed per lead by the matching engine
 * (see server/matching.ts) — they are not fixed per offer, so there is no `category` column.
 * Prices are EUR/month. Supplier names and prices are demo catalogue data, not
 * verified commercial inventory: every inserted provider/offer is fail-closed
 * and must be reviewed and explicitly activated in the admin back-office.
 */
const SEED_PROVIDERS = [
  { name: "Central Europe Compute", slug: "central-europe-compute", isActive: false },
  { name: "Hexagone Accelerated", slug: "hexagone-accelerated", isActive: false },
  { name: "North Sea Compute", slug: "north-sea-compute", isActive: false },
  { name: "Iberia GPU Cloud", slug: "iberia-gpu-cloud", isActive: false },
] satisfies (typeof providers.$inferInsert)[];

const SEED_OFFERS = [
  {
    providerSlug: "central-europe-compute",
    name: "H100 Production Cluster",
    gpuType: "NVIDIA H100",
    gpuCount: 8,
    cpuCores: 64,
    ramGb: 512,
    storageGb: 8000,
    location: "Frankfurt, Germany",
    monthlyPrice: "18400.00",
    setupFee: "2000.00",
    sla: "99.9%",
    deploymentTime: "72h",
    description:
      "Balanced H100 cluster with dedicated bare metal and EU data residency — strong price-to-performance for most training and inference workloads.",
    features: [
      "8x NVIDIA H100 80GB with NVLink",
      "Dedicated bare metal",
      "EU data residency (GDPR compliant)",
      "24/7 support",
    ],
    availableCapacity: 2,
  },
  {
    providerSlug: "hexagone-accelerated",
    name: "H100 Rapid Deploy",
    gpuType: "NVIDIA H100",
    gpuCount: 8,
    cpuCores: 96,
    ramGb: 768,
    storageGb: 16000,
    location: "Paris, France",
    monthlyPrice: "22000.00",
    setupFee: "0",
    sla: "99.99%",
    deploymentTime: "24h",
    description:
      "Premium H100 configuration provisioned within 24 hours with the highest uptime SLA and priority support.",
    features: [
      "8x NVIDIA H100 80GB, premium NVLink",
      "Provisioned in 24h",
      "99.99% uptime SLA",
      "Priority 24/7 support",
    ],
    availableCapacity: 1,
  },
  {
    providerSlug: "central-europe-compute",
    name: "A100 Training Pod",
    gpuType: "NVIDIA A100",
    gpuCount: 8,
    cpuCores: 48,
    ramGb: 384,
    storageGb: 8000,
    location: "Warsaw, Poland",
    monthlyPrice: "9600.00",
    setupFee: "500.00",
    sla: "99.5%",
    deploymentTime: "6-7 days",
    description:
      "Cost-effective A100 pod for sustained training runs where a longer provisioning window is acceptable.",
    features: [
      "8x NVIDIA A100 80GB",
      "High-throughput interconnect",
      "Standard support",
      "Flexible scaling",
    ],
    availableCapacity: 3,
  },
  {
    providerSlug: "north-sea-compute",
    name: "H100 Scale-Out Cluster",
    gpuType: "NVIDIA H100",
    gpuCount: 16,
    cpuCores: 128,
    ramGb: 1024,
    storageGb: 32000,
    location: "Amsterdam, Netherlands",
    monthlyPrice: "34000.00",
    setupFee: "3000.00",
    sla: "99.9%",
    deploymentTime: "96h",
    description:
      "Large 16x H100 cluster for distributed training at scale, with the best per-GPU economics in the catalogue.",
    features: [
      "16x NVIDIA H100 80GB",
      "400Gb/s InfiniBand fabric",
      "Dedicated bare metal",
      "24/7 support",
    ],
    availableCapacity: 1,
  },
  {
    providerSlug: "iberia-gpu-cloud",
    name: "A100 Starter",
    gpuType: "NVIDIA A100",
    gpuCount: 4,
    cpuCores: 24,
    ramGb: 192,
    storageGb: 4000,
    location: "Madrid, Spain",
    monthlyPrice: "5200.00",
    setupFee: "250.00",
    sla: "99.5%",
    deploymentTime: "7 days",
    description:
      "Entry-level 4x A100 pod — the most affordable way to get dedicated GPU capacity for smaller workloads.",
    features: [
      "4x NVIDIA A100 80GB",
      "Most affordable EU option",
      "Standard support",
      "Flexible scaling",
    ],
    availableCapacity: 4,
  },
  {
    providerSlug: "north-sea-compute",
    name: "L40S Inference Node",
    gpuType: "NVIDIA L40S",
    gpuCount: 8,
    cpuCores: 64,
    ramGb: 512,
    storageGb: 8000,
    location: "Dublin, Ireland",
    monthlyPrice: "8800.00",
    setupFee: "500.00",
    sla: "99.5%",
    deploymentTime: "72h",
    description:
      "L40S node optimised for high-volume inference and computer-vision serving at a moderate price point.",
    features: [
      "8x NVIDIA L40S 48GB",
      "Optimised for inference",
      "EU data residency",
      "Standard support",
    ],
    availableCapacity: 2,
  },
  {
    providerSlug: "north-sea-compute",
    name: "RTX 4090 Budget Pod",
    gpuType: "NVIDIA RTX 4090",
    gpuCount: 8,
    cpuCores: 48,
    ramGb: 256,
    storageGb: 4000,
    location: "Stockholm, Sweden",
    monthlyPrice: "7200.00",
    setupFee: "0",
    sla: "99.0%",
    deploymentTime: "48h",
    description:
      "Affordable 4090 pod with quick turnaround — great value for research and development workloads.",
    features: [
      "8x NVIDIA RTX 4090 24GB",
      "Provisioned in 48h",
      "No setup fee",
      "Community support",
    ],
    availableCapacity: 3,
  },
] satisfies Array<typeof offers.$inferInsert & { providerSlug: string }>;

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error(
      "[Seed] No database connection. Set DATABASE_URL in your environment and retry.",
    );
    process.exit(1);
  }

  const existingProviders = await db.select().from(providers);
  const existingProviderSlugs = new Set(existingProviders.map(provider => provider.slug));
  const missingProviders = SEED_PROVIDERS.filter(
    provider => !existingProviderSlugs.has(provider.slug),
  );
  if (missingProviders.length > 0) {
    await db.insert(providers).values(missingProviders);
    console.log(`[Seed] Inserted ${missingProviders.length} provider(s).`);
  }

  const seededProviders = await db.select().from(providers);
  const providerIds = new Map(seededProviders.map(provider => [provider.slug, provider.id]));
  const seededOffers = SEED_OFFERS.map(({ providerSlug, ...offer }) => {
    const providerId = providerIds.get(providerSlug);
    if (!providerId) throw new Error(`[Seed] Provider ${providerSlug} could not be resolved.`);
    return {
      ...offer,
      providerId,
      isActive: false,
      availabilityStatus: "unavailable" as const,
      availableCapacity: 0,
      availabilityExpiresAt: null,
    };
  });

  const existing = await db.select().from(offers);
  const existingKeys = new Set(
    existing.map(offer => `${offer.name}\u0000${offer.gpuType}\u0000${offer.location}`),
  );
  const missingOffers = seededOffers.filter(
    offer => !existingKeys.has(`${offer.name}\u0000${offer.gpuType}\u0000${offer.location}`),
  );
  if (missingOffers.length > 0) {
    await db.insert(offers).values(missingOffers);
    console.log(
      `[Seed] Inserted ${missingOffers.length} inactive demo offer(s); verify and activate them in admin.`,
    );
  } else {
    console.log(`[Seed] All ${seededOffers.length} demo offer(s) already exist; no changes made.`);
  }
  process.exit(0);
}

seed().catch(error => {
  console.error("[Seed] Failed:", error);
  process.exit(1);
});
