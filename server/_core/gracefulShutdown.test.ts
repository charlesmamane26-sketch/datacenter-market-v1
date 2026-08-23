import { describe, expect, it, vi } from "vitest";
import { createGracefulShutdown } from "./gracefulShutdown";

describe("graceful shutdown", () => {
  it("drains once, cleans resources and exits successfully", async () => {
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const closeIdleConnections = vi.fn();
    const cleanup = vi.fn(async () => undefined);
    const flushMonitoring = vi.fn(async () => true);
    const exit = vi.fn();
    const shutdown = createGracefulShutdown({
      server: { close, closeIdleConnections } as never,
      cleanup,
      flushMonitoring,
      exit,
      log: vi.fn(),
    });

    await shutdown("SIGTERM");
    await shutdown("SIGINT");

    expect(close).toHaveBeenCalledOnce();
    expect(closeIdleConnections).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(flushMonitoring).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("forces connections closed and exits non-zero after the deadline", async () => {
    vi.useFakeTimers();
    try {
      const close = vi.fn();
      const closeAllConnections = vi.fn();
      const exit = vi.fn();
      const shutdown = createGracefulShutdown({
        server: { close, closeAllConnections } as never,
        timeoutMs: 100,
        exit,
        log: vi.fn(),
      });

      const pending = shutdown("SIGTERM");
      await vi.advanceTimersByTimeAsync(100);
      await pending;

      expect(closeAllConnections).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
