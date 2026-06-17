import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";

/**
 * Exercises the SSE route handler with fake req/res, mocking the auth + db layer.
 * Covers the security invariants (401 without a session, 404 when not owner) and
 * the happy-path SSE framing (event-stream headers + initial snapshot).
 */
vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn() },
}));
vi.mock("./db", () => ({
  getOrder: vi.fn(),
  getProvisioningEventsByOrder: vi.fn(),
}));
vi.mock("./rateLimit", () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
  clientIp: () => "1.2.3.4",
}));

import { sdk } from "./_core/sdk";
import { getOrder, getProvisioningEventsByOrder } from "./db";
import { registerProvisioningStream } from "./provisioningStream";

// Capture the single registered GET handler.
function getHandler() {
  let handler: any;
  const app = { get: (_path: string, h: any) => (handler = h) } as any;
  registerProvisioningStream(app);
  return handler;
}

function makeRes() {
  const res: any = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.body = "";
  res.writes = [] as string[];
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((o: any) => ((res.body = JSON.stringify(o)), res));
  res.writeHead = vi.fn((c: number, h: Record<string, string>) => ((res.statusCode = c), Object.assign(res.headers, h), res));
  res.flushHeaders = vi.fn();
  res.write = vi.fn((s: string) => (res.writes.push(s), true));
  res.end = vi.fn();
  return res;
}

function makeReq(orderId: string) {
  const req: any = new EventEmitter();
  req.params = { orderId };
  req.headers = { cookie: "app_session_id=tok" };
  return req;
}

afterEach(() => vi.clearAllMocks());

describe("SSE provisioning handler", () => {
  it("returns 401 when the session is invalid", async () => {
    (sdk.authenticateRequest as any).mockRejectedValueOnce(new Error("no session"));
    const handler = getHandler();
    const res = makeRes();
    await handler(makeReq("42"), res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when the order is not owned by the user", async () => {
    (sdk.authenticateRequest as any).mockResolvedValueOnce({ id: 7, role: "user" });
    (getOrder as any).mockResolvedValueOnce({ id: 42, userId: 999 });
    const handler = getHandler();
    const res = makeRes();
    await handler(makeReq("42"), res);
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 on a non-numeric orderId", async () => {
    const handler = getHandler();
    const res = makeRes();
    await handler(makeReq("abc"), res);
    expect(res.statusCode).toBe(400);
  });

  it("streams event-stream headers + an initial snapshot to the owner", async () => {
    (sdk.authenticateRequest as any).mockResolvedValueOnce({ id: 7, role: "user" });
    (getOrder as any).mockResolvedValueOnce({ id: 42, userId: 7 });
    (getProvisioningEventsByOrder as any).mockResolvedValueOnce([
      { id: 1, orderId: 42, eventType: "order_received", status: "completed" },
    ]);
    const handler = getHandler();
    const res = makeRes();
    await handler(makeReq("42"), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("text/event-stream");
    const snapshot = res.writes.find((w: string) => w.startsWith("event: snapshot"));
    expect(snapshot).toBeTruthy();
    expect(snapshot).toContain("order_received");
  });

  it("admin may stream any order", async () => {
    (sdk.authenticateRequest as any).mockResolvedValueOnce({ id: 1, role: "admin" });
    (getOrder as any).mockResolvedValueOnce({ id: 42, userId: 999 });
    (getProvisioningEventsByOrder as any).mockResolvedValueOnce([]);
    const handler = getHandler();
    const res = makeRes();
    await handler(makeReq("42"), res);
    expect(res.statusCode).toBe(200);
  });
});
