import type { Express, Request, Response } from "express";
import { asyncHandler } from "./_core/asyncHandler";
import { sdk } from "./_core/sdk";
import { getOrder, getProvisioningEventsByOrder } from "./db";
import { enforceRateLimit, clientIp } from "./rateLimit";
import { subscribeAlerts } from "./telemetryAlerts";

/**
 * Real-time provisioning timeline over Server-Sent Events.
 *
 * The Confirmation page opens an EventSource on /api/provisioning/:orderId/stream;
 * whenever an admin writes a provisioning event (provisioning.createEvent), the
 * router calls publishProvisioningEvent(), which pushes it to every open stream
 * for that order. SSE is the right fit: the flow is one-way (server -> client),
 * rides plain HTTP, and EventSource reconnects on its own.
 *
 * The broadcaster is in-memory (per process). In a multi-instance deployment a
 * client on replica A won't see an event written on replica B — the client's
 * polling fallback (Confirmation.tsx) reconciles that, so SSE is never a single
 * point of failure. The publish/subscribe shape leaves room for a Redis pub/sub
 * backend later (server/_core/redisClient.ts) without touching callers.
 */

export interface ProvisioningStreamEvent {
  id?: number;
  orderId: number;
  eventType: string;
  status: string;
  description?: string | null;
  completedAt?: Date | string | null;
}

type Listener = (event: ProvisioningStreamEvent) => void;

const subscribers = new Map<number, Set<Listener>>();

/** Subscribe to an order's events. Returns an unsubscribe function. */
export function subscribeProvisioning(
  orderId: number,
  listener: Listener
): () => void {
  let set = subscribers.get(orderId);
  if (!set) {
    set = new Set();
    subscribers.set(orderId, set);
  }
  set.add(listener);
  return () => {
    const current = subscribers.get(orderId);
    if (!current) return;
    current.delete(listener);
    // Drop the entry once nobody listens, so the map can't grow unbounded.
    if (current.size === 0) subscribers.delete(orderId);
  };
}

/** Push an event to every open stream for this order. */
export function publishProvisioningEvent(
  orderId: number,
  event: ProvisioningStreamEvent
): void {
  const set = subscribers.get(orderId);
  if (!set) return;
  set.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error("[Provisioning SSE] Listener threw:", String(error));
    }
  });
}

/** Test-only: number of orders with at least one open stream. */
export function __subscriberCount(orderId: number): number {
  return subscribers.get(orderId)?.size ?? 0;
}

function writeEvent(res: Response, eventName: string, payload: unknown): void {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
}

const HEARTBEAT_MS = 25_000;

export function registerProvisioningStream(app: Express) {
  app.get(
    "/api/provisioning/:orderId/stream",
    asyncHandler(async (req: Request, res: Response) => {
      // Throttle stream opens per IP (an open EventSource holds a connection).
      const limit = await enforceRateLimit(`sse:${clientIp(req)}`, 30, 60_000);
      if (!limit.allowed) {
        res.status(429).json({ error: "Too many requests." });
        return;
      }

      const orderId = Number(req.params.orderId);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        res.status(400).json({ error: "Invalid orderId." });
        return;
      }

      // EventSource can't send custom headers, so auth rides the httpOnly session
      // cookie (same-origin, sent automatically). Reuse the standard chain.
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }

      // Owner-or-admin. Return 404 for both missing and unauthorized so order ids
      // can't be probed (same posture as requireOwnedOrder in routers.ts).
      const order = await getOrder(orderId);
      if (!order || (order.userId !== user.id && user.role !== "admin")) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Disable proxy buffering (nginx) so events flush immediately.
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders?.();

      // Initial snapshot closes the race between the page's one-shot query and the
      // stream opening: any event written in between is included here.
      try {
        const snapshot = await getProvisioningEventsByOrder(orderId);
        writeEvent(res, "snapshot", snapshot);
      } catch (error) {
        console.error("[Provisioning SSE] Snapshot failed:", String(error));
      }

      const unsubscribe = subscribeProvisioning(orderId, event => {
        writeEvent(res, "provisioning", event);
      });
      // Same stream also carries telemetry threshold alerts for this order.
      const unsubscribeAlerts = subscribeAlerts(orderId, alert => {
        writeEvent(res, "alert", alert);
      });

      // Heartbeat (SSE comment) keeps the connection alive through idle proxy/LB
      // timeouts (commonly 30–60s).
      const heartbeat = setInterval(() => {
        res.write(": ping\n\n");
      }, HEARTBEAT_MS);

      // Use res "close" (connection closed), NOT req "close": on a GET the request
      // body ends immediately, which would fire req "close" right after subscribing
      // and tear the stream down before any event is delivered.
      res.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        unsubscribeAlerts();
        res.end();
      });
    })
  );
}
