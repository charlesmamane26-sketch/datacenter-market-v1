import { describe, expect, it } from "vitest";
import { deploymentHours, matchOffers } from "./matching";
import type { Offer } from "../drizzle/schema";

function offer(partial: Partial<Offer>): Offer & { provider: { isActive: boolean } } {
  return {
    id: 0,
    name: "test",
    gpuType: "NVIDIA H100",
    gpuCount: 8,
    cpuCores: 64,
    ramGb: 512,
    storageGb: 8000,
    location: "EU",
    monthlyPrice: "10000.00",
    setupFee: "0",
    sla: "99.9%",
    deploymentTime: "72h",
    description: null,
    features: null,
    providerId: 1,
    isActive: true,
    availabilityStatus: "available",
    availableCapacity: 1,
    availabilityUpdatedAt: new Date(),
    inventoryVersion: 1,
    availabilityExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    provider: { isActive: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as Offer & { provider: { isActive: boolean } };
}

describe("deploymentHours", () => {
  it("parses hour formats", () => {
    expect(deploymentHours("48h")).toBe(48);
    expect(deploymentHours("72 h")).toBe(72);
  });

  it("parses day ranges using the lower bound", () => {
    expect(deploymentHours("5-7 days")).toBe(120);
    expect(deploymentHours("7 days")).toBe(168);
  });

  it("ranks unknown formats last", () => {
    expect(deploymentHours("soon")).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("matchOffers", () => {
  const catalogue = [
    offer({ id: 1, gpuType: "NVIDIA H100", monthlyPrice: "18400.00", deploymentTime: "72h" }),
    offer({ id: 2, gpuType: "NVIDIA H100", monthlyPrice: "22000.00", deploymentTime: "24h" }),
    offer({ id: 3, gpuType: "NVIDIA A100", monthlyPrice: "5200.00", deploymentTime: "7 days" }),
    offer({ id: 4, gpuType: "NVIDIA RTX 4090", monthlyPrice: "7200.00", deploymentTime: "48h" }),
  ];

  it("returns null for an empty catalogue", () => {
    expect(matchOffers([], {})).toBeNull();
  });

  it("picks cheapest and fastest across the full catalogue", () => {
    const m = matchOffers(catalogue, {})!;
    expect(m.cheapest.id).toBe(3); // 5200
    expect(m.fastest.id).toBe(2); // 24h
  });

  it("restricts to the requested GPU", () => {
    const m = matchOffers(catalogue, { gpuRequirement: "h100" })!;
    expect(m.cheapest.id).toBe(1); // cheapest H100
    expect(m.fastest.id).toBe(2); // fastest H100
  });

  it("returns null when no GPU matches", () => {
    expect(matchOffers(catalogue, { gpuRequirement: "l40s" })).toBeNull();
  });

  it("prefers offers within budget", () => {
    const m = matchOffers(catalogue, { monthlyBudget: 8000 })!;
    // affordable = id 3 (5200) and id 4 (7200)
    expect(m.cheapest.id).toBe(3);
    expect(m.fastest.id).toBe(4); // 48h beats 7 days
  });

  it("returns null when nothing is affordable", () => {
    expect(matchOffers(catalogue, { monthlyBudget: 1000 })).toBeNull();
  });

  it("balances price and speed for best value (distinct from the extremes)", () => {
    const small = [
      offer({ id: 10, monthlyPrice: "10000.00", deploymentTime: "100h" }), // cheapest, slow
      offer({ id: 20, monthlyPrice: "20000.00", deploymentTime: "10h" }), // fastest, dear
      offer({ id: 30, monthlyPrice: "12000.00", deploymentTime: "30h" }), // balanced
    ];
    const m = matchOffers(small, {})!;
    expect(m.cheapest.id).toBe(10);
    expect(m.fastest.id).toBe(20);
    expect(m.bestValue.id).toBe(30);
  });
});
