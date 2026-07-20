import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useProvisioningStream } from "@/hooks/useProvisioningStream";
import { fmtEUR, orderRef } from "@/lib/format";
import { JourneyStepper, MarketChrome, PanelLabel } from "@/components/market";

type EventType =
  | "order_received"
  | "provider_matching"
  | "contract_generation"
  | "provisioning"
  | "ready";

const EVENT_META: Record<EventType, { title: string; description: string }> = {
  order_received: {
    title: "Commande reçue",
    description: "Votre demande d'infrastructure est confirmée.",
  },
  provider_matching: {
    title: "Matching fournisseur",
    description: "Confirmation du datacenter partenaire.",
  },
  contract_generation: {
    title: "Génération du contrat",
    description: "Votre contrat de service est en préparation.",
  },
  provisioning: {
    title: "Provisionnement",
    description: "Mise en place de votre infrastructure.",
  },
  ready: {
    title: "Prêt",
    description: "Votre infrastructure est opérationnelle.",
  },
};

const EVENT_ORDER: EventType[] = [
  "order_received",
  "provider_matching",
  "contract_generation",
  "provisioning",
  "ready",
];

const FAILURE_CAUSES = [
  "Plafond de paiement de la carte atteint — contactez votre banque ou utilisez une autre carte.",
  "Validation 3-D Secure interrompue — relancez le paiement et confirmez dans votre app bancaire.",
  "Fonds insuffisants ou carte expirée — vérifiez le moyen de paiement utilisé.",
];

function readQueryNumber(key: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default function Confirmation() {
  const [, setLocation] = useLocation();
  const orderId = readQueryNumber("orderId");

  const {
    data: order,
    isLoading: orderLoading,
    error: orderError,
    refetch: refetchOrder,
  } = trpc.orders.get.useQuery(
    { id: orderId ?? 0 },
    {
      enabled: orderId != null,
      // Poll while payment is finalizing so the page updates once the Stripe webhook lands.
      refetchInterval: query =>
        query.state.data?.paymentStatus === "pending" ? 4000 : false,
    },
  );
  const paymentSucceeded = order?.paymentStatus === "succeeded";
  // Real-time provisioning updates via SSE; falls back to polling when the
  // stream is down (or unsupported) so the timeline still advances.
  const { connected } = useProvisioningStream(paymentSucceeded ? orderId : undefined);
  const { data: events } = trpc.provisioning.getEvents.useQuery(
    { orderId: orderId ?? 0 },
    {
      enabled: orderId != null && paymentSucceeded,
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
      <div className="min-h-screen bg-background text-foreground">
        <MarketChrome onBrandClick={() => setLocation("/")} />
        <div className="flex flex-col items-center px-5 py-24 text-center">
          <h1 className="mb-3 text-[30px] font-extrabold uppercase tracking-[-0.035em]">
            Commande introuvable<span className="text-accent">.</span>
          </h1>
          <p className="mb-6 text-muted-foreground">
            Impossible de retrouver la commande demandée.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="glow-accent rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <MarketChrome
          onBrandClick={() => setLocation("/")}
          center={<JourneyStepper current={4} />}
          right={<span className="font-mono text-[11px] text-muted-foreground">{orderRef(orderId)}</span>}
        />
        <div className="mx-auto max-w-[760px] space-y-4 px-5 py-20 md:px-10">
          <Skeleton className="mx-auto h-16 w-16 rounded-full" />
          <Skeleton className="mx-auto h-10 w-72" />
          <Skeleton className="mx-auto h-5 w-full max-w-[520px]" />
        </div>
      </div>
    );
  }

  if (orderError || !order) {
    const notFound = orderError?.data?.code === "NOT_FOUND" || !order;
    return (
      <div className="min-h-screen bg-background text-foreground">
        <MarketChrome onBrandClick={() => setLocation("/")} />
        <div className="flex flex-col items-center px-5 py-24 text-center">
          <h1 className="mb-3 text-[30px] font-extrabold uppercase tracking-[-0.035em]">
            {notFound ? "Commande introuvable" : "Commande indisponible"}
            <span className="text-destructive">.</span>
          </h1>
          <p className="mb-6 max-w-[540px] text-muted-foreground">
            {notFound
              ? "Cette commande n'existe pas ou vous n'êtes pas autorisé à la consulter."
              : "La commande n'a pas pu être chargée. Vous pouvez réessayer sans relancer le paiement."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {!notFound && (
              <button
                type="button"
                onClick={() => refetchOrder()}
                className="rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground"
              >
                Réessayer
              </button>
            )}
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="rounded-[9px] border border-border px-5 py-3 text-[14px] font-semibold"
            >
              Retour au dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const failed = order.paymentStatus === "failed";
  const succeeded = order.paymentStatus === "succeeded";
  const paymentCancelled = order.paymentStatus === "cancelled";
  const cancelled = paymentCancelled || order.status === "cancelled";
  const pending = !failed && !succeeded && !cancelled;
  const deploymentEstimate = offer?.deploymentTime ?? "délai fournisseur à confirmer";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        onBrandClick={() => setLocation("/")}
        center={<JourneyStepper current={4} allDone={succeeded} failed={failed} />}
        right={
          <span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground">
            {orderRef(orderId)}
          </span>
        }
      />

      <div className="mx-auto flex max-w-[900px] flex-col items-center px-5 pb-16 pt-14 md:px-10">
        {/* Status header */}
        {failed || cancelled ? (
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 text-[26px] font-bold text-destructive">
            ✗
          </div>
        ) : succeeded ? (
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent bg-accent/10 text-[26px] font-bold text-accent">
            ✓
          </div>
        ) : (
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-chart-5 bg-chart-5/10 text-[26px] font-bold text-chart-5">
            …
          </div>
        )}
        <h1 className="mb-3 text-center text-[30px] font-extrabold uppercase leading-none tracking-[-0.035em] md:text-[40px]">
          {failed
            ? "Paiement refusé"
            : cancelled
              ? paymentCancelled ? "Paiement annulé" : "Commande annulée"
              : succeeded
                ? "Commande confirmée"
                : "Confirmation du paiement"}
          <span className={failed || cancelled ? "text-destructive" : succeeded ? "text-accent" : "text-chart-5"}>.</span>
        </h1>
        <p className="mb-4 max-w-[540px] text-center text-[15.5px] text-muted-foreground">
          {failed
            ? "Le paiement n'a pas été confirmé. Vous pouvez relancer le parcours de paiement."
            : cancelled
              ? `${paymentCancelled ? "Le paiement" : "La commande"} a été annulé${paymentCancelled ? "" : "e"} et aucun provisionnement ne sera lancé.`
              : succeeded
                ? "Le paiement est confirmé. Le suivi du provisionnement est maintenant disponible."
                : "Nous attendons la confirmation Stripe. Aucun provisionnement ne démarre avant sa réception."}
        </p>
        <div className="mb-9 flex flex-wrap justify-center gap-2.5">
          {failed ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-[15px] py-[7px] font-mono text-[11px] font-semibold tracking-[.1em] text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                PAIEMENT ÉCHOUÉ
              </span>
            </>
          ) : cancelled ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-[15px] py-[7px] font-mono text-[11px] font-semibold tracking-[.1em] text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {paymentCancelled ? "PAIEMENT ANNULÉ" : "COMMANDE ANNULÉE"}
            </span>
          ) : succeeded ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-[15px] py-[7px] font-mono text-[11px] font-semibold tracking-[.1em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              PAIEMENT CONFIRMÉ — STRIPE
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-chart-5/40 bg-chart-5/10 px-[15px] py-[7px] font-mono text-[11px] font-semibold tracking-[.1em] text-chart-5">
              <span className="h-1.5 w-1.5 rounded-full bg-chart-5 animate-live-dot-fast" />
              PAIEMENT EN COURS DE CONFIRMATION…
            </span>
          )}
        </div>

        {/* Order cells */}
        <div className="mb-[22px] grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-3">
          <>
              <div className="flex flex-col gap-1 bg-card px-5 py-[18px]">
                <span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground">
                  COMMANDE
                </span>
                <span className="font-mono text-[14px] font-semibold">{orderRef(order.id)}</span>
              </div>
              <div className="flex flex-col gap-1 bg-card px-5 py-[18px]">
                <span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground">
                  INFRASTRUCTURE
                </span>
                <span className="font-mono text-[14px] font-semibold">
                  {offer ? `${offer.gpuCount}× ${offer.gpuType}` : "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1 bg-card px-5 py-[18px]">
                <span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground">
                  MENSUEL
                </span>
                <span className="font-mono text-[14px] font-semibold text-accent">
                  {fmtEUR(Number(order.monthlyRecurring))}
                </span>
              </div>
          </>
        </div>

        {failed || cancelled ? (
          <>
            {/* Common failure causes */}
            <div className="mb-[26px] w-full rounded-xl border border-border bg-card p-[26px]">
              <PanelLabel className="mb-5">{failed ? "Causes fréquentes" : "Paiement annulé"}</PanelLabel>
              {failed ? (
                <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[13.5px] leading-[1.55] text-muted-foreground">
                  {FAILURE_CAUSES.map(cause => (
                    <li key={cause} className="flex gap-[9px]">
                      <span className="font-bold text-destructive">·</span>
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                  Aucun provisionnement ne sera lancé. Vous pouvez reprendre le checkout si vous souhaitez poursuivre.
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-3.5 md:flex-row">
              <button
                onClick={() =>
                  setLocation(`/checkout?offerId=${order.offerId}&leadId=${order.leadId}`)
                }
                className="glow-accent flex flex-1 items-center justify-center gap-2 rounded-[9px] bg-accent p-[13px] text-[14px] font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
              >
                {failed ? "Réessayer le paiement →" : "Reprendre le paiement →"}
              </button>
              <button
                onClick={() => setLocation("/dashboard")}
                className="flex flex-1 items-center justify-center rounded-[9px] border border-border p-[13px] text-[14px] font-medium text-foreground transition-colors hover:bg-card"
              >
                Retour au dashboard
              </button>
            </div>
            <a
              href="https://www.anavimadvisory.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-[13px] text-accent hover:underline"
            >
              Parler à un conseiller
            </a>
          </>
        ) : pending ? (
          <>
            <div role="status" aria-live="polite" className="mb-[26px] w-full rounded-xl border border-chart-5/40 bg-chart-5/10 p-[26px]">
              <PanelLabel className="mb-3">Confirmation Stripe en attente</PanelLabel>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                Cette page se met à jour automatiquement. Aucun provisionnement n'est lancé tant que le paiement n'est pas confirmé.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="flex w-full items-center justify-center rounded-[9px] border border-border p-[13px] text-[14px] font-medium text-foreground transition-colors hover:bg-card"
            >
              Voir mes commandes
            </button>
          </>
        ) : (
          <>
            {/* ETA banner */}
            <div className="mb-[22px] flex w-full flex-col items-start justify-between gap-2 rounded-[10px] border border-accent/35 bg-accent/7 px-5 py-3.5 md:flex-row md:items-center">
              <span className="font-mono text-[11px] font-semibold tracking-[.08em]">
                DÉLAI DE MISE EN SERVICE — {deploymentEstimate.toUpperCase()}
              </span>
              <span className="font-mono text-[11px] tracking-[.08em] text-accent">
                {offer?.sla ? `SLA ${offer.sla}` : "SLA À CONFIRMER"}
              </span>
            </div>

            {/* Provisioning timeline */}
            <div className="mb-[26px] w-full rounded-xl border border-border bg-card p-[26px]">
              <PanelLabel className="mb-5">Timeline de provisionnement</PanelLabel>
              {timeline.length === 0 ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="flex flex-col">
                  {timeline.map((event, idx) => {
                    const meta = EVENT_META[event.eventType as EventType] ?? {
                      title: event.eventType,
                      description: event.description ?? "",
                    };
                    const done = event.status === "completed";
                    const running = event.status === "in_progress";
                    const last = idx === timeline.length - 1;
                    return (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          {done ? (
                            <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-accent/15 text-[13px] font-bold text-accent">
                              ✓
                            </div>
                          ) : running ? (
                            <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border-2 border-accent animate-live-dot-fast">
                              <span className="h-2 w-2 rounded-full bg-accent" />
                            </div>
                          ) : (
                            <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-muted text-[12px] text-muted-foreground">
                              ○
                            </div>
                          )}
                          {!last && (
                            <div
                              className={`my-1.5 w-0.5 flex-1 ${done ? "bg-accent/40" : "bg-border"}`}
                            />
                          )}
                        </div>
                        <div className={`flex flex-col gap-[3px] ${last ? "" : "pb-5"}`}>
                          <span
                            className={`text-[14.5px] font-semibold ${
                              done || running ? "" : "text-muted-foreground"
                            }`}
                          >
                            {meta.title}
                            {running && (
                              <span className="ml-2 rounded bg-accent/10 px-[7px] py-0.5 align-[2px] font-mono text-[10px] font-semibold tracking-[.08em] text-accent">
                                EN COURS
                              </span>
                            )}
                          </span>
                          {(done || running) && (
                            <span className="text-[12.5px] text-muted-foreground">
                              {event.description ?? meta.description}
                            </span>
                          )}
                          {event.completedAt && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {new Date(event.completedAt).toLocaleString("fr-FR")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Next steps */}
            <div className="mb-[26px] grid w-full gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-[26px]">
                <h3 className="mb-3 text-[15px] font-semibold">Et maintenant ?</h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13.5px] text-muted-foreground">
                  <li>✓ Suivez le provisionnement sur cette page</li>
                  <li>✓ Un e-mail vous informe à chaque étape</li>
                  <li>✓ Le dashboard s'active dès la mise en service</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-[26px]">
                <h3 className="mb-3 text-[15px] font-semibold">Support</h3>
                <p className="m-0 text-[13.5px] text-muted-foreground">
                  Contactez notre équipe pour toute question sur votre commande et les conditions de support associées.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3.5 md:flex-row">
              <button
                onClick={() => setLocation("/")}
                className="flex flex-1 items-center justify-center rounded-[9px] border border-border p-[13px] text-[14px] font-medium text-foreground transition-colors hover:bg-card"
              >
                Retour à l'accueil
              </button>
              <button
                onClick={() => setLocation("/dashboard")}
                className="glow-accent flex flex-1 items-center justify-center gap-2 rounded-[9px] bg-accent p-[13px] text-[14px] font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
              >
                Accéder au dashboard →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
