import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtEUR, leadRef } from "@/lib/format";
import { JourneyStepper, MarketChrome, PageTitle } from "@/components/market";
import { loadWorkloadRecap } from "@/lib/workloadRecap";
import { loadLeadClaim } from "@/lib/leadClaim";

type Category = "best_value" | "fastest" | "cheapest";

interface OfferCard {
  id: number;
  name: string;
  category: Category;
  categories?: Category[];
  gpuType: string;
  gpuCount: number;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  location: string;
  monthlyPrice: string | number;
  setupFee: string | number;
  sla: string;
  deploymentTime: string;
  description: string | null;
  features: string[] | null;
}

const CATEGORY_META: Record<
  Category,
  { badge: string; text: string; bg: string }
> = {
  best_value: { badge: "MEILLEUR COMPROMIS", text: "text-accent", bg: "bg-accent/10" },
  fastest: { badge: "DÉLAI LE PLUS COURT", text: "text-chart-2", bg: "bg-chart-2/10" },
  cheapest: { badge: "PRIX LE PLUS BAS", text: "text-chart-3", bg: "bg-chart-3/15" },
};

export default function ResultsScreen() {
  const [, setLocation] = useLocation();
  const leadIdParam = new URLSearchParams(window.location.search).get("leadId");
  const parsedLeadId = leadIdParam == null ? Number.NaN : Number(leadIdParam);
  const leadId = Number.isInteger(parsedLeadId) && parsedLeadId > 0 ? parsedLeadId : undefined;
  const { data: offers, isLoading, isError, refetch } = trpc.offers.match.useQuery(
    // The claim token lets the server tailor the ranking to this lead's private
    // criteria; without it the match falls back to the full-catalogue ranking.
    leadId != null ? { leadId, claimToken: loadLeadClaim(leadId) } : {},
  );
  const recap = loadWorkloadRecap(leadId);

  // The API returns one row per distinct offer. `categories` preserves every
  // factual distinction earned when one configuration wins several views.
  const displayOffers = (offers ?? []) as OfferCard[];

  const goDetail = (offer: OfferCard) =>
    setLocation(`/offer-detail/${offer.id}` + (leadId != null ? `?leadId=${leadId}` : ""));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        onBrandClick={() => setLocation("/")}
        center={<JourneyStepper current={2} />}
        right={
          <span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground">
            {isLoading ? "ANALYSE…" : `${displayOffers.length} OPTION${displayOffers.length > 1 ? "S" : ""}`}
          </span>
        }
      />

      <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 md:px-10">
        <button
          onClick={() => setLocation("/workload")}
          className="mb-[22px] inline-flex items-center gap-[7px] text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ‹ Modifier ma demande
        </button>

        <div className="mb-[18px] flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2.5">
            <PageTitle>Vos options</PageTitle>
            <p className="m-0 text-[16px] text-muted-foreground">
              {isLoading
                ? "Nous classons les configurations disponibles."
                : `${displayOffers.length} option${displayOffers.length > 1 ? "s" : ""} disponible${displayOffers.length > 1 ? "s" : ""}, classée${displayOffers.length > 1 ? "s" : ""} selon le prix et le délai.`}
            </p>
          </div>
          <span className="whitespace-nowrap font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">
            {leadId != null ? leadRef(leadId) : "CATALOGUE DISPONIBLE"}
          </span>
        </div>

        <div className="mb-[34px] flex flex-wrap items-center gap-2.5">
          {(recap?.chips ?? ["CATALOGUE DISPONIBLE"]).map(chip => (
            <span
              key={chip}
              className="rounded-full border border-border bg-card px-3.5 py-[7px] font-mono text-[11px] tracking-[.08em] text-foreground"
            >
              {chip}
            </span>
          ))}
          <button
            onClick={() => setLocation("/workload")}
            className="rounded-full border border-accent/40 px-3.5 py-[7px] font-mono text-[11px] tracking-[.08em] text-accent transition-colors hover:bg-accent/10"
          >
            MODIFIER
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-[22px] md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-4 rounded-xl border border-border bg-card p-[26px]">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
            <h2 className="mb-2 text-lg font-semibold">Résultats indisponibles</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Le catalogue n'a pas pu être chargé. Votre demande n'est pas perdue.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-[9px] bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
            >
              Réessayer
            </button>
          </div>
        ) : displayOffers.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold">Aucune option disponible</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Modifiez votre demande ou contactez-nous pour une recherche personnalisée.
            </p>
            <button
              type="button"
              onClick={() => setLocation("/workload")}
              className="rounded-[9px] bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
            >
              Modifier ma demande
            </button>
          </div>
        ) : (
          <div className="grid items-stretch gap-[22px] pt-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            {displayOffers.map(offer => {
              const meta = CATEGORY_META[offer.category];
              const categories = offer.categories ?? [offer.category];
              const recommended = categories.includes("best_value");
              return (
                <div
                  key={offer.id}
                  className={`relative flex flex-col gap-[18px] rounded-xl border bg-card p-[26px] transition-colors duration-200 ${
                    recommended
                      ? "border-accent/65 shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_20%,transparent),0_0_44px_color-mix(in_oklch,var(--accent)_10%,transparent)]"
                      : offer.category === "fastest"
                        ? "border-border hover:border-chart-2/60"
                        : "border-border hover:border-chart-3/60"
                  }`}
                >
                  {recommended && (
                    <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-accent px-3 py-1 font-mono text-[10px] font-bold tracking-[.12em] text-accent-foreground">
                      RECOMMANDÉ
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map(category => {
                          const categoryMeta = CATEGORY_META[category];
                          return (
                            <span
                              key={category}
                              className={`self-start rounded-md px-2.5 py-[5px] font-mono text-[10.5px] font-semibold tracking-[.1em] ${categoryMeta.text} ${categoryMeta.bg}`}
                            >
                              {categoryMeta.badge}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h3 className="m-0 text-[20px] font-bold">{offer.name}</h3>
                        <span className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
                          {offer.location} · {offer.gpuCount}× {offer.gpuType} · {offer.ramGb} Go ·
                          SLA {offer.sla}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-baseline justify-between rounded-[10px] border bg-background px-4 py-3.5 ${
                      recommended ? "border-accent/35" : "border-border"
                    }`}
                  >
                    <span
                      className={`font-mono text-[24px] font-bold ${recommended ? "text-accent" : "text-foreground"}`}
                    >
                      {fmtEUR(Number(offer.monthlyPrice))}
                      <span className="text-[12px] font-medium text-muted-foreground">/mois HT</span>
                    </span>
                    <span className={`font-mono text-[12px] ${meta.text}`}>{offer.deploymentTime}</span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 border-t border-border/70 pt-3.5 text-[12.5px]">
                    <div>
                      <dt className="font-mono text-[10px] tracking-[.08em] text-muted-foreground">CPU</dt>
                      <dd className="mt-1 font-semibold">{offer.cpuCores} cœurs</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] tracking-[.08em] text-muted-foreground">MÉMOIRE</dt>
                      <dd className="mt-1 font-semibold">{offer.ramGb} Go</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] tracking-[.08em] text-muted-foreground">STOCKAGE</dt>
                      <dd className="mt-1 font-semibold">{offer.storageGb} Go</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] tracking-[.08em] text-muted-foreground">SLA</dt>
                      <dd className="mt-1 font-semibold">{offer.sla}</dd>
                    </div>
                  </dl>

                  {offer.description && (
                    <p className="m-0 text-[12.5px] leading-[1.55] text-muted-foreground">
                      {offer.description}
                    </p>
                  )}

                  <div className="mt-auto">
                    {recommended ? (
                      <button
                        onClick={() => goDetail(offer)}
                        className="glow-accent flex w-full items-center justify-center gap-2 rounded-[9px] bg-accent p-[13px] text-[14px] font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
                      >
                        Choisir cette offre →
                      </button>
                    ) : (
                      <button
                        onClick={() => goDetail(offer)}
                        className="flex w-full items-center justify-center rounded-[9px] border border-border p-[13px] text-[14px] font-semibold text-foreground transition-colors hover:bg-input"
                      >
                        Voir le détail
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-[30px] flex flex-wrap items-center justify-center gap-3 text-[13px] text-muted-foreground md:gap-5">
          <span>Prix HT · disponibilité confirmée au moment de la commande</span>
          <span className="hidden h-[3px] w-[3px] rounded-full bg-border md:block" />
          <button
            onClick={() => setLocation("/workload")}
            className="text-accent transition-colors hover:text-accent/80"
          >
            Modifier ma demande
          </button>
        </div>
      </div>
    </div>
  );
}
