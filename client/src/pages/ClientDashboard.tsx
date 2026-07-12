import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useProvisioningStream } from "@/hooks/useProvisioningStream";
import { fmtEUR, orderRef } from "@/lib/format";
import {
  MarketChrome,
  MeterBar,
  PanelLabel,
  StatusPill,
  type StatusTone,
} from "@/components/market";

const ACTIVE_STATUSES = ["processing", "provisioning", "active"];

const STATUS_META: Record<string, { tone: StatusTone; label: string; pulse?: boolean }> = {
  active: { tone: "lime", label: "ACTIVE" },
  provisioning: { tone: "cyan", label: "PROVISIONING", pulse: true },
  processing: { tone: "cyan", label: "PROVISIONING", pulse: true },
  pending: { tone: "amber", label: "EN ATTENTE" },
  completed: { tone: "muted", label: "TERMINÉ" },
  cancelled: { tone: "red", label: "ANNULÉ" },
};

export default function ClientDashboard() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: orders } = trpc.orders.list.useQuery();
  const { data: offers } = trpc.offers.list.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    logout();
    setLocation("/");
  };

  const orderList = orders ?? [];
  const offerById = new Map((offers ?? []).map(o => [o.id, o]));
  const billable = orderList.filter(o => o.status !== "cancelled");
  const monthlySpend = billable.reduce((sum, o) => sum + Number(o.monthlyRecurring), 0);
  const activeServices = orderList.filter(o => ACTIVE_STATUSES.includes(o.status)).length;

  // Live telemetry for the primary active order — empty until a provider feeds metrics.
  const primaryOrder = orderList.find(o => o.status === "active") ?? orderList[0];
  const primaryOrderId = primaryOrder?.id;
  const { data: m } = trpc.metrics.getLatest.useQuery(
    { orderId: primaryOrderId ?? 0 },
    { enabled: primaryOrderId != null },
  );

  const gpuUsage = m?.gpuUsagePercent != null ? Number(m.gpuUsagePercent) : null;
  const vramUsage =
    m?.gpuMemoryUsedGb != null && m?.gpuMemoryTotalGb
      ? Math.round((Number(m.gpuMemoryUsedGb) / Number(m.gpuMemoryTotalGb)) * 100)
      : null;
  const cpuUsage = m?.cpuUsagePercent != null ? Number(m.cpuUsagePercent) : null;
  const ramUsage =
    m?.ramUsedGb != null && m?.ramTotalGb
      ? Math.round((Number(m.ramUsedGb) / Number(m.ramTotalGb)) * 100)
      : null;

  // Live threshold alerts pushed over SSE for the primary order.
  const { alerts } = useProvisioningStream(primaryOrderId ?? undefined);

  const telemetryRows: { label: string; value: number | null; tone: "lime" | "cyan" | "amber" }[] = [
    { label: "GPU", value: gpuUsage, tone: "lime" },
    { label: "VRAM", value: vramUsage, tone: vramUsage != null && vramUsage > 90 ? "amber" : "lime" },
    { label: "CPU", value: cpuUsage, tone: "cyan" },
    { label: "RAM", value: ramUsage, tone: "cyan" },
  ];
  const hasTelemetry = telemetryRows.some(r => r.value != null);

  // Route guard: send unauthenticated visitors to the login page (server authz
  // already protects the data; this is the UX-level gate). A logged-in user of
  // any role may view their own client dashboard.
  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [loading, user, setLocation]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        onBrandClick={() => setLocation("/")}
        right={
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[11.5px] tracking-[.06em] text-muted-foreground md:block">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-[7px] border border-border px-3.5 py-[7px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-card"
            >
              Déconnexion
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-9 md:px-10">
        <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[28px] font-extrabold uppercase leading-none tracking-[-0.03em] md:text-[36px]">
              Bonjour, {user?.name?.split(" ")[0] || "vous"}
              <span className="text-accent">.</span>
            </h1>
            <p className="m-0 text-[14.5px] text-muted-foreground">
              Surveillez votre infrastructure et gérez vos abonnements.
            </p>
          </div>
          <button
            onClick={() => setLocation("/workload")}
            className="glow-accent inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent px-5 py-[11px] text-[13.5px] font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
          >
            Demander plus de capacité →
          </button>
        </div>

        {/* Threshold alerts (SSE) */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2" role="status" aria-live="polite">
            {alerts.slice(0, 5).map((a, i) => {
              const critical = a.severity === "critical";
              return (
                <div
                  key={`${a.kind}-${i}`}
                  className={`flex items-center gap-3 rounded-[10px] border px-[18px] py-[13px] ${
                    critical
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-chart-5/40 bg-chart-5/8"
                  }`}
                >
                  <span
                    className={`h-[7px] w-[7px] flex-none rounded-full animate-live-dot-fast ${
                      critical ? "bg-destructive" : "bg-chart-5"
                    }`}
                  />
                  <span className="font-mono text-[12px] tracking-[.04em]">{a.message}</span>
                  <span
                    className={`ml-auto font-mono text-[10px] font-semibold uppercase tracking-[.1em] ${
                      critical ? "text-destructive" : "text-chart-5"
                    }`}
                  >
                    {critical ? "CRITICAL" : "WARNING"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* KPI cells */}
        <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              DÉPENSE MENSUELLE
            </span>
            <span className="font-mono text-[26px] font-bold">{fmtEUR(monthlySpend)}</span>
            <span className="text-[12px] text-muted-foreground">Abonnements en cours</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              SERVICES ACTIFS
            </span>
            <span className="font-mono text-[26px] font-bold">{activeServices}</span>
            <span className="text-[12px] text-muted-foreground">En cours d'exécution</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              COMMANDES
            </span>
            <span className="font-mono text-[26px] font-bold">{orderList.length}</span>
            <span className="text-[12px] text-muted-foreground">Depuis le début</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
                UTILISATION GPU
              </span>
              {gpuUsage != null && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-live-dot-fast" />
              )}
            </div>
            {gpuUsage != null ? (
              <>
                <span className="font-mono text-[26px] font-bold text-accent">{gpuUsage} %</span>
                <MeterBar value={gpuUsage} />
              </>
            ) : (
              <>
                <span className="font-mono text-[26px] font-bold text-muted-foreground">—</span>
                <span className="text-[12px] text-muted-foreground">Télémétrie en attente</span>
              </>
            )}
          </div>
        </div>

        {/* Telemetry per order */}
        {primaryOrder && hasTelemetry && (
          <div className="mb-6 rounded-xl border border-border bg-card p-[22px]">
            <div className="mb-4 flex items-center justify-between">
              <PanelLabel>Télémétrie — {orderRef(primaryOrder.id)}</PanelLabel>
              <span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground">
                {offerById.get(primaryOrder.offerId)
                  ? `${offerById.get(primaryOrder.offerId)!.gpuCount}× ${offerById.get(primaryOrder.offerId)!.gpuType}`
                  : ""}
              </span>
            </div>
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {telemetryRows.map(row => (
                <div key={row.label} className="flex items-center gap-2.5">
                  <span className="w-[46px] font-mono text-[10px] tracking-[.08em] text-muted-foreground">
                    {row.label}
                  </span>
                  <MeterBar
                    value={row.value ?? 0}
                    tone={row.value == null ? "muted" : row.tone}
                    height={6}
                    className="flex-1"
                  />
                  <span className="w-[42px] text-right font-mono text-[11px]">
                    {row.value != null ? `${row.value} %` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders table */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden grid-cols-[1.2fr_1.6fr_1fr_1fr_0.8fr] items-center gap-4 border-b border-border bg-sidebar px-[22px] py-3 font-mono text-[10.5px] font-medium tracking-[.1em] text-muted-foreground md:grid">
            <span>COMMANDE</span>
            <span>CONFIGURATION</span>
            <span>STATUT</span>
            <span className="text-right">MENSUEL HT</span>
            <span />
          </div>
          {orderList.length > 0 ? (
            orderList.map((order, i) => {
              const offer = offerById.get(order.offerId);
              const status = STATUS_META[order.status] ?? STATUS_META.pending;
              const tracking = ["pending", "processing", "provisioning"].includes(order.status);
              return (
                <div
                  key={order.id}
                  className={`grid grid-cols-2 items-center gap-2 px-4 py-4 transition-colors hover:bg-card/50 md:grid-cols-[1.2fr_1.6fr_1fr_1fr_0.8fr] md:gap-4 md:px-[22px] ${
                    i < orderList.length - 1 ? "border-b border-border/70" : ""
                  }`}
                >
                  <span className="font-mono text-[12.5px]">{orderRef(order.id)}</span>
                  <span className="text-[13.5px] font-semibold">
                    {offer ? `${offer.gpuCount}× ${offer.gpuType} · ${offer.location}` : "—"}
                  </span>
                  <StatusPill tone={status.tone} label={status.label} pulse={status.pulse} />
                  <span className="text-left font-mono text-[13.5px] font-semibold md:text-right">
                    {fmtEUR(Number(order.monthlyRecurring))}
                  </span>
                  <button
                    onClick={() => setLocation(`/confirmation?orderId=${order.id}`)}
                    className="flex items-center justify-center rounded-[7px] border border-border py-[7px] text-[12px] font-medium text-foreground transition-colors hover:bg-input"
                  >
                    {tracking ? "Suivre" : "Gérer"}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="m-0 text-muted-foreground">Aucune infrastructure active</p>
              <button
                onClick={() => setLocation("/workload")}
                className="glow-accent rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground"
              >
                Demander de la capacité →
              </button>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setLocation("/workload")}
            className="flex items-center justify-center rounded-[9px] border border-border p-[13px] text-[14px] font-medium text-foreground transition-colors hover:bg-card"
          >
            Nouvelle demande de capacité
          </button>
          <a
            href="mailto:contact@anavim-infra.com"
            className="flex items-center justify-center rounded-[9px] border border-border p-[13px] text-[14px] font-medium text-foreground transition-colors hover:bg-card"
          >
            Contacter le support
          </a>
        </div>
      </main>
    </div>
  );
}
