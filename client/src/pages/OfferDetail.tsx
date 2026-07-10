import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { JourneyStepper, MarketChrome } from "@/components/market";
import {
  ComplianceCard,
  HelpCard,
  OfferHeader,
  RecapSidebar,
  ServiceTermsCard,
  TechSummaryCard,
  useOfferCountdown,
} from "@/components/market/offerPurchase";

export default function OfferDetail() {
  const { offerId } = useParams<{ offerId: string }>();
  const [, setLocation] = useLocation();
  const leadIdRaw = new URLSearchParams(window.location.search).get("leadId");
  const leadId =
    leadIdRaw && Number.isFinite(Number(leadIdRaw)) ? Number(leadIdRaw) : undefined;
  const { data: offer, isLoading } = trpc.offers.get.useQuery({
    id: parseInt(offerId || "0"),
  });
  const countdown = useOfferCountdown(leadId ?? offerId);

  const chrome = (
    <MarketChrome
      onBrandClick={() => setLocation("/")}
      center={<JourneyStepper current={3} />}
      right={
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[.1em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-live-dot" />
          OFFRE VALABLE {countdown}
        </span>
      }
    />
  );

  if (isLoading || !offer) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {chrome}
        <div className="mx-auto max-w-[1240px] px-5 pt-9 md:px-10">
          <div className="space-y-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {chrome}

      <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-9 md:px-10">
        <button
          onClick={() => setLocation("/results" + (leadId != null ? `?leadId=${leadId}` : ""))}
          className="mb-5 inline-flex items-center gap-[7px] text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ‹ Retour aux résultats
        </button>

        <OfferHeader offer={offer} leadId={leadId} />

        <div className="grid items-start gap-6 md:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-5">
            <TechSummaryCard offer={offer} />
            <ServiceTermsCard offer={offer} />
            <ComplianceCard />
          </div>

          <div className="flex flex-col gap-[18px]">
            <RecapSidebar
              offer={offer}
              cta={
                <button
                  onClick={() =>
                    setLocation(
                      `/checkout?offerId=${offer.id}` + (leadId != null ? `&leadId=${leadId}` : ""),
                    )
                  }
                  className="glow-accent flex w-full items-center justify-center gap-2 rounded-[9px] bg-accent p-[13px] text-[14px] font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
                >
                  Procéder au paiement →
                </button>
              }
              hint={
                <span className="text-center text-[11.5px] leading-[1.55] text-muted-foreground">
                  L'acceptation des CGV et le paiement sécurisé se font à l'étape suivante.
                </span>
              }
            />
            <HelpCard />
          </div>
        </div>
      </div>
    </div>
  );
}
