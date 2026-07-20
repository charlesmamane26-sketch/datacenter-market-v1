import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import {
  createProvider,
  getAllProviders,
  getInventoryOffers,
  getOffer,
  getProvider,
  InventoryConflictError,
  updateOfferInventory,
  updateProvider,
} from "./db";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createProvider: vi.fn(),
    getAllProviders: vi.fn(),
    getInventoryOffers: vi.fn(),
    getOffer: vi.fn(),
    getProvider: vi.fn(),
    updateOfferInventory: vi.fn(),
    updateProvider: vi.fn(),
  };
});

function context(role: "user" | "admin" | null): TrpcContext {
  const user = role
    ? ({
        id: role === "admin" ? 99 : 1,
        openId: role,
        name: role,
        email: `${role}@example.com`,
        loginMethod: "test",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as NonNullable<TrpcContext["user"]>)
    : null;
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => vi.resetAllMocks());

describe("inventory router", () => {
  it("keeps supplier inventory admin-only", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.inventory.listOffers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getInventoryOffers).not.toHaveBeenCalled();
  });

  it("returns inventory-ready offer rows to admins", async () => {
    const rows = [{ id: 7, provider: { id: 2 }, isSellable: true, availabilityIsStale: false }];
    vi.mocked(getInventoryOffers).mockResolvedValue(rows as never);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.inventory.listOffers()).resolves.toEqual(rows);
  });

  it("creates and updates provider records through validated inputs", async () => {
    vi.mocked(createProvider).mockResolvedValue({ id: 4, name: "Nord GPU", slug: "nord-gpu" } as never);
    vi.mocked(updateProvider).mockResolvedValue({ id: 4, name: "Nord GPU", isActive: false } as never);
    const caller = appRouter.createCaller(context("admin"));

    await expect(
      caller.inventory.createProvider({ name: "Nord GPU", slug: "nord-gpu" }),
    ).resolves.toMatchObject({ id: 4 });
    expect(createProvider).toHaveBeenCalledWith({ name: "Nord GPU", slug: "nord-gpu" });

    await caller.inventory.updateProvider({ id: 4, isActive: false });
    expect(updateProvider).toHaveBeenCalledWith(4, { isActive: false });
  });

  it("validates supplier attribution and returns the updated operational row", async () => {
    vi.mocked(getProvider).mockResolvedValue({ id: 2 } as never);
    vi.mocked(updateOfferInventory).mockResolvedValue({
      id: 7,
      providerId: 2,
      availabilityStatus: "limited",
      availableCapacity: 1,
      isSellable: true,
    } as never);
    const caller = appRouter.createCaller(context("admin"));

    await expect(
      caller.inventory.updateOffer({
        id: 7,
        expectedVersion: 3,
        providerId: 2,
        availabilityStatus: "limited",
        availableCapacity: 1,
      }),
    ).resolves.toMatchObject({ id: 7, isSellable: true });
    expect(updateOfferInventory).toHaveBeenCalledWith(
      7,
      3,
      {
        providerId: 2,
        availabilityStatus: "limited",
        availableCapacity: 1,
      },
    );
  });

  it("allows clearing attribution but the resulting offer is not sellable", async () => {
    vi.mocked(updateOfferInventory).mockResolvedValue({
      id: 7,
      providerId: null,
      provider: null,
      isSellable: false,
    } as never);
    const caller = appRouter.createCaller(context("admin"));

    await expect(
      caller.inventory.updateOffer({ id: 7, expectedVersion: 4, providerId: null }),
    ).resolves.toMatchObject({ providerId: null, isSellable: false });
    expect(getProvider).not.toHaveBeenCalled();
    expect(updateOfferInventory).toHaveBeenCalledWith(7, 4, { providerId: null });
  });

  it("reports concurrent inventory edits as a conflict", async () => {
    vi.mocked(updateOfferInventory).mockRejectedValue(
      new InventoryConflictError("Inventory changed in another admin session."),
    );
    const caller = appRouter.createCaller(context("admin"));

    await expect(
      caller.inventory.updateOffer({
        id: 7,
        expectedVersion: 2,
        availableCapacity: 5,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects inventory freshness windows beyond 30 days", async () => {
    const caller = appRouter.createCaller(context("admin"));

    await expect(
      caller.inventory.updateOffer({
        id: 7,
        expectedVersion: 2,
        availabilityExpiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1_000),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateOfferInventory).not.toHaveBeenCalled();
  });

  it("uses the sellable-only lookup for the public offer detail", async () => {
    vi.mocked(getOffer).mockResolvedValue({ id: 7 } as never);
    const caller = appRouter.createCaller(context(null));
    await caller.offers.get({ id: 7 });
    expect(getOffer).toHaveBeenCalledWith(7, { sellableOnly: true });
  });

  it("lists providers without requiring the UI to derive them from offers", async () => {
    const providers = [{ id: 2, name: "Nord GPU", slug: "nord-gpu" }];
    vi.mocked(getAllProviders).mockResolvedValue(providers as never);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.inventory.listProviders()).resolves.toEqual(providers);
  });
});
