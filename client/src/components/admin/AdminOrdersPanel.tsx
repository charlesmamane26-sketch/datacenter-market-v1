import { useMemo, useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtEUR } from "@/lib/format";
import { PanelLabel, StatusPill, type StatusTone } from "@/components/market";

type OrderStatus =
  | "pending"
  | "processing"
  | "provisioning"
  | "active"
  | "cancelled"
  | "completed";

type ProvisioningEventType =
  | "order_received"
  | "provider_matching"
  | "contract_generation"
  | "provisioning"
  | "ready";

type ProvisioningEventStatus = "pending" | "in_progress" | "completed" | "failed";

const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "EN ATTENTE", tone: "amber" },
  processing: { label: "TRAITEMENT", tone: "violet" },
  provisioning: { label: "PROVISIONNEMENT", tone: "cyan" },
  active: { label: "ACTIF", tone: "lime" },
  cancelled: { label: "ANNULÉ", tone: "red" },
  completed: { label: "TERMINÉ", tone: "muted" },
};

const PAYMENT_META: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "PAIEMENT EN ATTENTE", tone: "amber" },
  succeeded: { label: "PAYÉ", tone: "lime" },
  failed: { label: "ÉCHEC PAIEMENT", tone: "red" },
  cancelled: { label: "PAIEMENT ANNULÉ", tone: "muted" },
};

const EVENT_LABELS: Record<ProvisioningEventType, string> = {
  order_received: "Commande reçue",
  provider_matching: "Affectation fournisseur",
  contract_generation: "Contrat",
  provisioning: "Mise en service",
  ready: "Infrastructure prête",
};

function displayDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

export function AdminOrdersPanel({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const ordersQuery = trpc.admin.exportOrders.useQuery(undefined, { enabled });
  const providersQuery = trpc.inventory.listProviders.useQuery(undefined, { enabled });
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [eventType, setEventType] = useState<ProvisioningEventType>("provider_matching");
  const [eventStatus, setEventStatus] = useState<ProvisioningEventStatus>("completed");
  const [description, setDescription] = useState("");

  const updateOrderStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.exportOrders.invalidate(),
        utils.admin.stats.invalidate(),
      ]);
    },
  });

  const createEvent = trpc.provisioning.createEvent.useMutation({
    onSuccess: async (_data, variables) => {
      setDescription("");
      await Promise.all([
        utils.admin.exportOrders.invalidate(),
        utils.provisioning.getEvents.invalidate({ orderId: variables.orderId }),
      ]);
    },
  });

  const orders = ordersQuery.data ?? [];
  const providerNames = useMemo(
    () => new Map((providersQuery.data ?? []).map(provider => [provider.id, provider.name])),
    [providersQuery.data],
  );
  const selectedOrder = useMemo(
    () => orders.find(order => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const submitEvent = () => {
    if (!selectedOrder) return;
    createEvent.mutate({
      orderId: selectedOrder.id,
      eventType,
      status: eventStatus,
      description: description.trim() || undefined,
    });
  };

  return (
    <section className="mt-8 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border px-[22px] py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <PanelLabel>Commandes & provisionnement</PanelLabel>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Le paiement reste piloté exclusivement par les événements Stripe.
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {orders.length} COMMANDE{orders.length === 1 ? "" : "S"}
        </span>
      </div>

      {ordersQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des commandes…
        </div>
      ) : ordersQuery.error ? (
        <div className="px-[22px] py-10 text-center text-[13px] text-destructive">
          Impossible de charger les commandes : {ordersQuery.error.message}
        </div>
      ) : orders.length === 0 ? (
        <div className="px-[22px] py-10 text-center text-muted-foreground">
          Aucune commande pour l'instant
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[0.4fr_0.7fr_1fr_1fr_1fr_0.75fr_1fr_0.65fr] items-center gap-4 border-b border-border bg-sidebar px-[22px] py-3 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              <span>ID</span>
              <span>CRÉÉE</span>
              <span>FOURNISSEUR</span>
              <span>PAIEMENT</span>
              <span>ÉTAT SERVICE</span>
              <span className="text-right">MENSUEL</span>
              <span>CHANGER L'ÉTAT</span>
              <span>ACTION</span>
            </div>
            {orders.map((order, index) => {
              const status = order.status as OrderStatus;
              const statusMeta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.pending;
              const paymentMeta = PAYMENT_META[order.paymentStatus] ?? {
                label: order.paymentStatus,
                tone: "muted" as const,
              };
              return (
                <div
                  key={order.id}
                  className={`grid grid-cols-[0.4fr_0.7fr_1fr_1fr_1fr_0.75fr_1fr_0.65fr] items-center gap-4 px-[22px] py-3.5 ${
                    index < orders.length - 1 ? "border-b border-border/70" : ""
                  } ${selectedOrderId === order.id ? "bg-accent/5" : ""}`}
                >
                  <span className="font-mono text-[12px] font-semibold">#{order.id}</span>
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {displayDate(order.createdAt)}
                  </span>
                  <span className="truncate text-[11px]" title={providerNames.get(order.providerId)}>
                    {providerNames.get(order.providerId) ?? `Fournisseur #${order.providerId}`}
                  </span>
                  <StatusPill tone={paymentMeta.tone} label={paymentMeta.label} />
                  <StatusPill tone={statusMeta.tone} label={statusMeta.label} />
                  <span className="text-right font-mono text-[12px] font-semibold">
                    {fmtEUR(Number(order.monthlyRecurring))}
                  </span>
                  <select
                    value={status}
                    disabled={
                      updateOrderStatus.isPending || status === "cancelled" || status === "completed"
                    }
                    onChange={event =>
                      updateOrderStatus.mutate({
                        id: order.id,
                        status: event.target.value as OrderStatus,
                      })
                    }
                    className="rounded-[7px] border border-border bg-input px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-accent/50"
                    aria-label={`État de la commande ${order.id}`}
                  >
                    <option value="pending">en attente</option>
                    <option value="processing" disabled={order.paymentStatus !== "succeeded"}>
                      traitement
                    </option>
                    <option value="provisioning" disabled={order.paymentStatus !== "succeeded"}>
                      provisionnement
                    </option>
                    <option value="active" disabled={order.paymentStatus !== "succeeded"}>
                      actif
                    </option>
                    <option value="completed" disabled={order.paymentStatus !== "succeeded"}>
                      terminé
                    </option>
                    <option value="cancelled">annulé</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-[7px] border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:border-accent/40 hover:bg-accent/5"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Piloter
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="border-t border-border bg-sidebar/60 px-[22px] py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <PanelLabel>Nouvel événement · commande #{selectedOrder.id}</PanelLabel>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Chaque événement est ajouté à la timeline visible par le client.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedOrderId(null)}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Fermer
            </button>
          </div>

          {selectedOrder.paymentStatus !== "succeeded" ? (
            <div className="rounded-lg border border-chart-5/30 bg-chart-5/5 px-4 py-3 text-[12px] text-chart-5">
              Le provisionnement est verrouillé jusqu'à la confirmation du paiement par Stripe.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr_1.7fr_auto]">
              <label className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                ÉTAPE
                <select
                  value={eventType}
                  onChange={event => setEventType(event.target.value as ProvisioningEventType)}
                  className="rounded-[7px] border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
                >
                  {Object.entries(EVENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                STATUT
                <select
                  value={eventStatus}
                  onChange={event => setEventStatus(event.target.value as ProvisioningEventStatus)}
                  className="rounded-[7px] border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
                >
                  <option value="pending">en attente</option>
                  <option value="in_progress">en cours</option>
                  <option value="completed">terminé</option>
                  <option value="failed">échec</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                MESSAGE CLIENT
                <input
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  maxLength={500}
                  placeholder="Ex. Le fournisseur a confirmé la capacité."
                  className="rounded-[7px] border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50"
                />
              </label>
              <button
                type="button"
                onClick={submitEvent}
                disabled={createEvent.isPending}
                className="mt-auto inline-flex h-[37px] items-center justify-center gap-2 rounded-[7px] bg-accent px-4 text-[12px] font-semibold text-accent-foreground disabled:opacity-50"
              >
                {createEvent.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Publier
              </button>
            </div>
          )}

          {(createEvent.error || updateOrderStatus.error) && (
            <p className="mt-3 text-[12px] text-destructive">
              {createEvent.error?.message ?? updateOrderStatus.error?.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
