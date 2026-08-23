import { describe, expect, it, vi } from "vitest";
import {
  MAX_SSE_CONNECTIONS_PER_IP,
  __activeStreamCount,
  subscribeProvisioning,
  publishProvisioningEvent,
  __subscriberCount,
  acquireStreamSlot,
  type ProvisioningStreamEvent,
} from "./provisioningStream";

const evt = (orderId: number, over: Partial<ProvisioningStreamEvent> = {}): ProvisioningStreamEvent => ({
  orderId,
  eventType: "provisioning",
  status: "in_progress",
  ...over,
});

describe("provisioning broadcaster", () => {
  it("delivers events to subscribers of the matching order", () => {
    const received: ProvisioningStreamEvent[] = [];
    const unsub = subscribeProvisioning(1, e => received.push(e));

    publishProvisioningEvent(1, evt(1, { status: "completed" }));

    expect(received).toHaveLength(1);
    expect(received[0].status).toBe("completed");
    unsub();
  });

  it("isolates orders — a subscriber only hears its own order", () => {
    const a: ProvisioningStreamEvent[] = [];
    const b: ProvisioningStreamEvent[] = [];
    const unsubA = subscribeProvisioning(10, e => a.push(e));
    const unsubB = subscribeProvisioning(20, e => b.push(e));

    publishProvisioningEvent(10, evt(10));

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
    unsubA();
    unsubB();
  });

  it("fans out to every subscriber of one order", () => {
    const calls: number[] = [];
    const u1 = subscribeProvisioning(5, () => calls.push(1));
    const u2 = subscribeProvisioning(5, () => calls.push(2));

    publishProvisioningEvent(5, evt(5));

    expect(calls.sort()).toEqual([1, 2]);
    u1();
    u2();
  });

  it("stops delivering after unsubscribe and purges the empty entry", () => {
    const received: ProvisioningStreamEvent[] = [];
    const unsub = subscribeProvisioning(7, e => received.push(e));
    expect(__subscriberCount(7)).toBe(1);

    unsub();
    expect(__subscriberCount(7)).toBe(0); // entry removed, no leak

    publishProvisioningEvent(7, evt(7));
    expect(received).toHaveLength(0);
  });

  it("publishing to an order with no subscribers is a no-op", () => {
    expect(() => publishProvisioningEvent(999, evt(999))).not.toThrow();
  });

  it("a throwing listener does not break the others", () => {
    const ok = vi.fn();
    const u1 = subscribeProvisioning(8, () => {
      throw new Error("boom");
    });
    const u2 = subscribeProvisioning(8, ok);

    publishProvisioningEvent(8, evt(8));

    expect(ok).toHaveBeenCalledOnce();
    u1();
    u2();
  });

  it("caps concurrent streams per IP and releases slots idempotently", () => {
    const releases = Array.from(
      { length: MAX_SSE_CONNECTIONS_PER_IP },
      () => acquireStreamSlot("1.2.3.4")
    );
    expect(releases.every(Boolean)).toBe(true);
    expect(__activeStreamCount("1.2.3.4")).toBe(MAX_SSE_CONNECTIONS_PER_IP);
    expect(acquireStreamSlot("1.2.3.4")).toBeNull();

    releases[0]?.();
    releases[0]?.();
    expect(__activeStreamCount("1.2.3.4")).toBe(
      MAX_SSE_CONNECTIONS_PER_IP - 1
    );
    const replacement = acquireStreamSlot("1.2.3.4");
    expect(replacement).not.toBeNull();

    releases.slice(1).forEach(release => release?.());
    replacement?.();
    expect(__activeStreamCount("1.2.3.4")).toBe(0);
  });
});
