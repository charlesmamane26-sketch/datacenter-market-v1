import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtEUR, leadRef } from "@/lib/format";
import {
  JourneyStepper,
  MarketChrome,
  MeterBar,
  PageTitle,
} from "@/components/market";
import { loadWorkloadRecap } from "@/lib/workloadRecap";
import { loadLeadClaim } from "@/lib/leadClaim";

type Category = "best_value" | "fastest" | "cheapest";

interface OfferCard {
  id: number;
  name: string;
  category: Category;
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
  { badge: string; text: string; bg: string; barTone: "lime" | "cyan" | "violet" }
> = {
  best_value: { badge: "MEILLEUR RAPPORT", text: "text-accent", bg: "bg-accent/10", barTone: "lime" },
  fastest: { badge: "LE PLUS RAPIDE", text: "text-chart-2", bg: "bg-chart-2/10", barTone: "cyan" },
  cheapest: { badge: "LE PLUS ÉCONOMIQUE", text: "text-chart-3", bg: "bg-chart-3/15", barTone: "violet" },
};

function hoursOf(deploymentTime: string): number {
  const h = deploymentTime.match(/(\d+)\s*h/i);
  if (h) return Number(h[1]);
  const d = deploymentTime.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*j/i);
  if (d) return Number(d[1]) * 24;
  return 24 * 7;
}

function gpuSpecScore(o: OfferCard): number {
  const tier = /h100/i.test(o.gpuType) ? 100 : /a100/i.test(o.gpuType) ? 78 : /l40s/i.test(o.gpuType) ? 70 : 60;
  const ram = Math.min(1, o.ramGb / 512);
  return Math.round(tier * 0.7 + ram * 100 * 0.3);
}

function slaScore(sla: string): number {
  const pct = Number((sla.match(/99[.,]?(\d*)/)?.[0] ?? "99").replace(",", "."));
  return pct >= 99.99 ? 100 : pct >= 99.9 ? 100 : 95;
}

/**
 * Client-side explainable scores (the matching API doesn't expose numbers):
 * price and delay are normalized across the displayed pool, specs from GPU tier
 * + RAM, conformity from the SLA. Global = 40 % budget · 30 % délai · 30 % specs.
 */
function computeScores(offers: OfferCard[]) {
  const prices = offers.map(o => Number(o.monthlyPrice));
  const hours = offers.map(o => hoursOf(o.deploymentTime));
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const minH = Math.min(...hours);
  const maxH = Math.max(...hours);
  return offers.map((o, i) => {
    const prix = maxP === minP ? 90 : Math.round(58 + 42 * ((maxP - prices[i]) / (maxP - minP)));
    const delai = maxH === minH ? 90 : Math.round(58 + 42 * ((maxH - hours[i]) / (maxH - minH)));
    const specs = gpuSpecScore(o);
    const conformite = slaScore(o.sla);
    const global = Math.round(prix * 0.4 + delai * 0.3 + specs * 0.3);
    return { prix, delai, specs, conformite, global };
  });
}

function verdictFor(
  offer: OfferCard,
  all: OfferCard[],
): { headline: string; detail: string } {
  const price = Number(offer.monthlyPrice);
  const fastest = all.find(o => o.category === "fastest");
  const best = all.find(o => o.category === "best_value");
  const bestPrice = best ? Number(best.monthlyPrice) : price;
  const fastestPrice = fastest ? Number(fastest.monthlyPrice) : price;
  switch (offer.category) {
    case "fastest": {
      const premium = bestPrice ? Math.round(((price - bestPrice) / bestPrice) * 100) : 0;
      return {
        headline: `EN LIGNE DEMAIN — PREMIUM +${premium} %`,
        detail: "Des jours de calcul gagnés vs l'offre recommandée.",
      };
    }
    case "cheapest": {
      const cut = bestPrice ? Math.round(((bestPrice - price) / bestPrice) * 100) : 0;
      const yearly = Math.max(0, (bestPrice - price) * 12);
      return {
        headline: `−${cut} % — MAIS ${offer.gpuType.toUpperCase()} ET ${offer.deploymentTime.toUpperCase()}`,
        detail: `~${fmtEUR(yearly)} économisés par an, si le délai convient.`,
      };
    }
    default: {
      const yearly = Math.max(0, (fastestPrice - price) * 12);
      const cut = fastestPrice ? Math.round(((fastestPrice - price) / fastestPrice) * 100) : 0;
      return {
        headline: `MEILLEUR €/GPU DU POOL — ÉCONOMIE ${fmtEUR(yearly)}/AN`,
        detail: `−${cut} % vs l'offre la plus rapide à specs équivalentes.`,
      };
    }
  }
}

const SCORE_ROWS: { key: "prix" | "delai" | "specs" | "conformite"; label: string }[] = [
  { key: "prix", label: "PRIX" },
  { key: "delai", label: "DÉLAI" },
  { key: "specs", label: "SPECS" },
  { key: "conformite", label: "CONFORMITÉ" },
];

export default function ResultsScreen() {
  const [, setLocation] = useLocation();
  const leadIdParam = new URLSearchParams(window.location.search).get("leadId");
  const leadId =
    leadIdParam && Number.isFinite(Number(leadIdParam)) ? Number(leadIdParam) : undefined;
  const { data: offers, isLoading } = trpc.offers.match.useQuery(
    // The claim token lets the server tailor the ranking to this lead's private
    // criteria; without it the match falls back to the full-catalogue ranking.
    leadId != null ? { leadId, claimToken: loadLeadClaim(leadId) } : {},
  );
  const recap = loadWorkloadRecap();

  const bestValueOffer = offers?.find(o => o.category === "best_value");
  const fastestOffer = offers?.find(o => o.category === "fastest");
  const cheapestOffer = offers?.find(o => o.category === "cheapest");
  // Recommended card in the middle, as in the design.
  const displayOffers = [fastestOffer, bestValueOffer, cheapestOffer].filter(Boolean) as OfferCard[];
  const scores = computeScores(displayOffers);

  const goDetail = (offer: OfferCard) =>
    setLocation(`/offer-detail/${offer.id}` + (leadId != null ? `?leadId=${leadId}` : ""));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        onBrandClick={() => setLocation("/")}
        center={<JourneyStepper current={2} />}
        right={
          <span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground">
            {leadId != null ? leadRef(leadId) : "47 DC ANALYSÉS"}
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
              3 offres fermes — chaque score est décomposé, vous savez pourquoi une offre sort du
              lot.
            </p>
          </div>
          <span className="whitespace-nowrap font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">
            {leadId != null ? `${leadRef(leadId)} · ` : ""}47 DC ANALYSÉS
          </span>
        </div>

        <div className="mb-[34px] flex flex-wrap items-center gap-2.5">
          {(recap?.chips ?? ["RÉGION UE", "OFFRES FERMES 72 H"]).map(chip => (
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
          <span className="ml-auto hidden font-mono text-[10.5px] tracking-[.08em] text-muted-foreground md:block">
            PONDÉRATION : BUDGET 40 % · DÉLAI 30 % · SPECS 30 %
          </span>
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
        ) : (
          <div className="grid items-stretch gap-[22px] pt-3 md:grid-cols-3">
            {displayOffers.map((offer, idx) => {
              const meta = CATEGORY_META[offer.category];
              const s = scores[idx];
              const recommended = offer.category === "best_value";
              const verdict = verdictFor(offer, displayOffers);
              return (
                <div
                  key={offer.category}
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
                      RECOMMANDÉ · MATCH {s.global} %
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <span
                        className={`self-start rounded-md px-2.5 py-[5px] font-mono text-[10.5px] font-semibold tracking-[.1em] ${meta.text} ${meta.bg}`}
                      >
                        {meta.badge}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <h3 className="m-0 text-[20px] font-bold">{offer.name}</h3>
                        <span className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
                          {offer.location} · {offer.gpuCount}× {offer.gpuType} · {offer.ramGb} Go ·
                          SLA {offer.sla}
                        </span>
                      </div>
                    </div>
                    <span className={`font-mono text-[24px] font-bold ${meta.text}`}>{s.global}</span>
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

                  <div className="flex flex-col gap-2.5">
                    {SCORE_ROWS.map(row => (
                      <div key={row.key} className="flex items-center gap-2.5">
                        <span className="w-[78px] font-mono text-[10px] tracking-[.08em] text-muted-foreground">
                          {row.label}
                        </span>
                        <MeterBar value={s[row.key]} tone={meta.barTone} height={4} className="flex-1" />
                        <span className="w-[26px] text-right font-mono text-[10.5px]">{s[row.key]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5 border-t border-border/70 pt-3.5">
                    <span className={`font-mono text-[10.5px] tracking-[.08em] ${meta.text}`}>
                      {verdict.headline}
                    </span>
                    <span className="text-[12.5px] leading-[1.55] text-muted-foreground">
                      {verdict.detail}
                    </span>
                  </div>

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
          <span>Prix HT · offres fermes valables 72 h</span>
          <span className="hidden h-[3px] w-[3px] rounded-full bg-border md:block" />
          <button
            onClick={() => setLocation("/workload")}
            className="text-accent transition-colors hover:text-accent/80"
          >
            Ajuster la pondération
          </button>
        </div>
      </div>
    </div>
  );
}
