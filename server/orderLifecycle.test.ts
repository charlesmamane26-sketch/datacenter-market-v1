import { describe, expect, it } from "vitest";
import {
  OrderLifecycleError,
  assertManualOrderTransition,
  deriveProvisioningOrderPatch,
} from "./orderLifecycle";

const now = new Date("2026-07-20T12:00:00.000Z");

describe("assertManualOrderTransition", () => {
  it("does not allow an unpaid order to become operational", () => {
    expect(() =>
      assertManualOrderTransition(
        { status: "pending", paymentStatus: "pending" },
        "provisioning",
      ),
    ).toThrow(OrderLifecycleError);
  });

  it("allows a paid order to advance and any non-terminal order to be cancelled", () => {
    expect(() =>
      assertManualOrderTransition(
        { status: "processing", paymentStatus: "succeeded" },
        "active",
      ),
    ).not.toThrow();
    expect(() =>
      assertManualOrderTransition(
        { status: "pending", paymentStatus: "failed" },
        "cancelled",
      ),
    ).not.toThrow();
  });

  it("rejects regressions and changes to terminal orders", () => {
    expect(() =>
      assertManualOrderTransition(
        { status: "active", paymentStatus: "succeeded" },
        "processing",
      ),
    ).toThrow("cannot move backwards");
    expect(() =>
      assertManualOrderTransition(
        { status: "cancelled", paymentStatus: "succeeded" },
        "active",
      ),
    ).toThrow("terminal");
  });
});

describe("deriveProvisioningOrderPatch", () => {
  it("starts provisioning only after Stripe has confirmed payment", () => {
    expect(() =>
      deriveProvisioningOrderPatch(
        { status: "pending", paymentStatus: "pending" },
        { eventType: "provisioning", status: "in_progress" },
        now,
      ),
    ).toThrow("Stripe must confirm payment");

    expect(
      deriveProvisioningOrderPatch(
        { status: "processing", paymentStatus: "succeeded" },
        { eventType: "provisioning", status: "in_progress" },
        now,
      ),
    ).toEqual({ status: "provisioning", provisioningStartedAt: now });
  });

  it("marks a paid order active when the ready event completes", () => {
    expect(
      deriveProvisioningOrderPatch(
        {
          status: "provisioning",
          paymentStatus: "succeeded",
          provisioningStartedAt: new Date("2026-07-20T10:00:00.000Z"),
        },
        { eventType: "ready", status: "completed" },
        now,
      ),
    ).toEqual({ status: "active", provisioningCompletedAt: now });
  });

  it("does not regress an active order when an older step is reported", () => {
    expect(
      deriveProvisioningOrderPatch(
        { status: "active", paymentStatus: "succeeded", provisioningStartedAt: now },
        { eventType: "provider_matching", status: "completed" },
        now,
      ),
    ).toEqual({});
  });
});
