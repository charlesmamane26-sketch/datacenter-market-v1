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
} from "@/components/market/offerPurchase";

export default function OfferDetail() {
  const { offerId } = useParams<{ offerId: string }>();
  const [, setLocation] = useLocation();
  const leadIdRaw = new URLSearchParams(window.location.search).get("leadId");
  const leadId =
    leadIdRaw && Number.isFinite(Number(leadIdRaw)) ? Number(leadIdRaw) : undefined;
  const parsedOfferId = Number(offerId);
  const validOfferId = Number.isInteger(parsedOfferId) && parsedOfferId > 0;
  const { data: offer, isLoading, isError, refetch } = trpc.offers.get.useQuery(
    { id: validOfferId ? parsedOfferId : 1 },
    { enabled: validOfferId },
  );

  const chrome = (
    <MarketChrome
      onBrandClick={() => setLocation("/")}
      center={<JourneyStepper current={3} />}
      right={
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[.1em] text-accent">
          OPTION DU CATALOGUE
        </span>
      }
    />
  );

  if (!validOfferId || isError || (!isLoading && !offer)) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {chrome}
        <div className="mx-auto max-w-[760px] px-5 py-20 text-center md:px-10">
          <h1 className="mb-3 text-[30px] font-extrabold uppercase tracking-[-0.035em]">
            {isError ? "Option indisponible" : "Option introuvable"}
            <span className="text-accent">.</span>
          </h1>
          <p className="mb-6 text-muted-foreground">
            {isError
              ? "Le détail n'a pas pu être chargé. Vous pouvez réessayer sans perdre votre demande."
              : "Cette configuration n'existe plus dans le catalogue."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {isError && (
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-[9px] bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
              >
                Réessayer
              </button>
            )}
            <button
              type="button"
              onClick={() => setLocation("/results" + (leadId != null ? `?leadId=${leadId}` : ""))}
              className="rounded-[9px] border border-border px-5 py-3 text-sm font-semibold"
            >
              Retour aux résultats
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
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

  // The preceding loading/error/not-found branches are exhaustive; this guard
  // also gives TypeScript a concrete non-null offer for the purchase blocks.
  if (!offer) return null;

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
