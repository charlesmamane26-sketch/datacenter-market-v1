import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Subscribes to the real-time provisioning stream for an order and merges events
 * into the tRPC `provisioning.getEvents` cache, so any component reading that
 * query (e.g. Confirmation) re-renders live without refetching.
 *
 * EventSource sends the session cookie automatically (same-origin) and
 * reconnects on its own. `connected` lets the caller fall back to polling when
 * the stream is down (or unsupported), so SSE is never a single point of failure.
 */
type StreamEvent = {
  id?: number;
  orderId: number;
  eventType: string;
  status: string;
  description?: string | null;
  completedAt?: string | null;
};

export function useProvisioningStream(orderId: number | undefined): { connected: boolean } {
  const utils = trpc.useUtils();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (orderId == null || typeof EventSource === "undefined") {
      setConnected(false);
      return;
    }

    const es = new EventSource(`/api/provisioning/${orderId}/stream`, {
      withCredentials: true,
    });

    const setCache = (events: StreamEvent[]) => {
      utils.provisioning.getEvents.setData({ orderId }, prev => {
        const byKey = new Map<string | number, StreamEvent>();
        for (const e of prev ?? []) byKey.set(e.id ?? e.eventType, e as StreamEvent);
        // Incoming events overwrite same id/eventType, otherwise append.
        for (const e of events) byKey.set(e.id ?? e.eventType, e);
        return Array.from(byKey.values()) as never;
      });
    };

    es.addEventListener("snapshot", e => {
      setConnected(true);
      try {
        setCache(JSON.parse((e as MessageEvent).data));
      } catch {
        /* ignore malformed frame */
      }
    });

    es.addEventListener("provisioning", e => {
      try {
        setCache([JSON.parse((e as MessageEvent).data)]);
      } catch {
        /* ignore malformed frame */
      }
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource will retry automatically.

    return () => es.close();
  }, [orderId, utils]);

  return { connected };
}
