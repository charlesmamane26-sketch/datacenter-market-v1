import { describe, expect, it, vi } from "vitest";
import { countTrpcOperations, trpcBatchLimit } from "./trpcBatchLimit";

describe("tRPC batch limit", () => {
  it("counts plain and percent-encoded comma-separated procedure paths", () => {
    expect(countTrpcOperations("/api/trpc/orders.list?batch=1")).toBe(1);
    expect(
      countTrpcOperations("/api/trpc/orders.list,leads.list?batch=1")
    ).toBe(2);
    expect(
      countTrpcOperations("/api/trpc/orders.list%2Cleads.list?batch=1")
    ).toBe(2);
  });

  it("rejects a batch before passing control to tRPC", () => {
    const next = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const handler = trpcBatchLimit(2);

    handler(
      { originalUrl: "/api/trpc/a,b,c?batch=1" } as never,
      { status } as never,
      next
    );

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "TRPC_BATCH_TOO_LARGE" }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a batch at the configured boundary", () => {
    const next = vi.fn();
    const handler = trpcBatchLimit(2);
    handler(
      { originalUrl: "/api/trpc/a,b?batch=1" } as never,
      {} as never,
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
