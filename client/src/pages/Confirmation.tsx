import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, Zap } from "lucide-react";
import { useProvisioningStream } from "@/hooks/useProvisioningStream";

type EventType =
  | "order_received"
  | "provider_matching"
  | "contract_generation"
  | "provisioning"
  | "ready";

const EVENT_META: Record<EventType, { title: string; description: string }> = {
  order_received: {
    title: "Order Received",
    description: "Your infrastructure request has been confirmed",
  },
  provider_matching: {
    title: "Provider Matching",
    description: "Finding the best infrastructure provider for your needs",
  },
  contract_generation: {
    title: "Contract Generation",
    description: "Generating your service contract",
  },
  provisioning: {
    title: "Provisioning",
    description: "Setting up your infrastructure",
  },
  ready: {
    title: "Ready",
    description: "Your infrastructure is ready to use",
  },
};

const EVENT_ORDER: EventType[] = [
  "order_received",
  "provider_matching",
  "contract_generation",
  "provisioning",
  "ready",
];

function readQueryNumber(key: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default function Confirmation() {
  const [, setLocation] = useLocation();
  const orderId = readQueryNumber("orderId");

  const { data: order, isLoading: orderLoading } = trpc.orders.get.useQuery(
    { id: orderId ?? 0 },
    {
      enabled: orderId != null,
      // Poll while payment is finalizing so the page updates once the Stripe webhook lands.
      refetchInterval: query =>
        query.state.data?.paymentStatus === "pending" ? 4000 : false,
    },
  );
  // Real-time provisioning updates via SSE; falls back to polling when the
  // stream is down (or unsupported) so the timeline still advances.
  const { connected } = useProvisioningStream(orderId ?? undefined);
  const { data: events } = trpc.provisioning.getEvents.useQuery(
    { orderId: orderId ?? 0 },
    {
      enabled: orderId != null,
      refetchInterval: query => {
        if (connected) return false; // SSE is pushing updates — no need to poll.
        const evts = query.state.data ?? [];
        const ready = evts.find(e => e.eventType === "ready");
        const done = ready?.status === "completed";
        return done ? false : 4000;
      },
    },
  );
  const { data: offer } = trpc.offers.get.useQuery(
    { id: order?.offerId ?? 0 },
    { enabled: order?.offerId != null },
  );

  const timeline = [...(events ?? [])].sort(
    (a, b) =>
      EVENT_ORDER.indexOf(a.eventType as EventType) -
      EVENT_ORDER.indexOf(b.eventType as EventType),
  );

  if (orderId == null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Order not found</h1>
          <p className="text-muted-foreground mb-6">
            We couldn't find the order you're looking for.
          </p>
          <Button onClick={() => setLocation("/")} className="bg-accent hover:bg-accent/90">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="container max-w-3xl">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <CheckCircle2 className="w-16 h-16 text-lime-400 animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Order Confirmed!</h1>
          <p className="text-lg text-muted-foreground">
            Your infrastructure is being provisioned. You'll receive email updates as we progress.
          </p>
          {order?.paymentStatus === "succeeded" ? (
            <p className="mt-4 inline-block rounded-lg bg-lime-400/10 px-4 py-2 text-sm font-semibold text-lime-600">
              Payment confirmed
            </p>
          ) : order?.paymentStatus === "failed" ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="inline-block rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
                Payment failed.
              </p>
              <Button
                onClick={() =>
                  setLocation(`/checkout?offerId=${order?.offerId}&leadId=${order?.leadId}`)
                }
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Retry payment
              </Button>
            </div>
          ) : (
            <p className="mt-4 inline-block rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
              Finalizing your payment… this page updates automatically.
            </p>
          )}
        </div>

        {/* Order Details */}
        <div className="tech-card mb-8">
          {orderLoading || !order ? (
            <div className="grid md:grid-cols-3 gap-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Order ID</p>
                <p className="font-mono font-semibold text-sm">
                  ORD-{String(order.id).padStart(6, "0")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Infrastructure</p>
                <p className="font-semibold">
                  {offer ? `${offer.gpuCount}x ${offer.gpuType}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monthly Cost</p>
                <p className="font-semibold text-accent">
                  €{Number(order.monthlyRecurring).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="tech-card">
          <h2 className="text-2xl font-bold mb-8">Provisioning Timeline</h2>

          {timeline.length === 0 ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {timeline.map((event, idx) => {
                const meta = EVENT_META[event.eventType as EventType] ?? {
                  title: event.eventType,
                  description: event.description ?? "",
                };
                return (
                  <div key={event.id} className="flex gap-4">
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          event.status === "completed"
                            ? "bg-lime-400/20 text-lime-400"
                            : event.status === "in_progress"
                            ? "bg-accent/20 text-accent animate-pulse"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {event.status === "completed" ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : event.status === "in_progress" ? (
                          <Zap className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      {idx < timeline.length - 1 && (
                        <div className="w-0.5 h-12 bg-border my-2" />
                      )}
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 pt-1">
                      <h3 className="font-semibold mb-1">{meta.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {event.description ?? meta.description}
                      </p>
                      {event.completedAt && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {new Date(event.completedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="tech-card">
            <h3 className="font-bold mb-3">What's Next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Monitor provisioning progress here</li>
              <li>✓ Check your email for updates</li>
              <li>✓ Access your dashboard once ready</li>
              <li>✓ Contact support if you have questions</li>
            </ul>
          </div>

          <div className="tech-card">
            <h3 className="font-bold mb-3">Support</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Need help? Our team is available 24/7 to assist you.
            </p>
            <Button variant="outline" className="w-full">
              Contact Support
            </Button>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 mt-8">
          <Button variant="outline" className="flex-1" onClick={() => setLocation("/")}>
            Back to Home
          </Button>
          <Button
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            onClick={() => setLocation("/dashboard")}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
