import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("forwards a rejected Express 4 handler to next", async () => {
    const error = new Error("boom");
    const next = vi.fn();
    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler({} as never, {} as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(error);
  });

  it("does not call next when the handler resolves", async () => {
    const next = vi.fn();
    const handler = asyncHandler(async () => undefined);

    await handler({} as never, {} as never, next);

    expect(next).not.toHaveBeenCalled();
  });
});
