import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { saveCheckoutIntent, clearCheckoutIntent } from "@/lib/checkoutIntent";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
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

function readQueryNumber(key: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerId = readQueryNumber("offerId");
  const leadId = readQueryNumber("leadId");
  const missingContext = offerId == null || leadId == null;

  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: offer, isLoading: offerLoading } = trpc.offers.get.useQuery(
    { id: offerId ?? 0 },
    { enabled: offerId != null },
  );
  const checkout = trpc.orders.checkout.useMutation();
  const countdown = useOfferCountdown(leadId ?? offerId);

  const handleConfirm = async () => {
    setError(null);
    if (missingContext) {
      setError("Contexte de commande introuvable. Retournez aux résultats et choisissez une offre.");
      return;
    }
    setIsProcessing(true);
    try {
      const { url } = await checkout.mutateAsync({ leadId: leadId!, offerId: offerId! });
      clearCheckoutIntent();
      if (url) {
        // Redirect to Stripe's hosted checkout page.
        window.location.href = url;
      } else {
        setError("Le paiement n'a pas pu démarrer. Veuillez réessayer.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      setError("Le paiement n'a pas pu démarrer. Veuillez réessayer.");
      setIsProcessing(false);
    }
  };

  const ctaClass =
    "glow-accent flex w-full items-center justify-center gap-2 rounded-[9px] bg-accent p-[13px] text-[14px] font-semibold text-accent-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        onBrandClick={() => setLocation("/")}
        center={<JourneyStepper current={4} />}
        right={
          <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[.1em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-live-dot" />
            OFFRE VALABLE {countdown}
          </span>
        }
      />

      <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-9 md:px-10">
        <button
          onClick={() => setLocation("/results" + (leadId != null ? `?leadId=${leadId}` : ""))}
          className="mb-5 inline-flex items-center gap-[7px] text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ‹ Retour aux résultats
        </button>

        {missingContext ? (
          <div className="rounded-xl border border-border bg-card p-[26px]">
            <p className="mb-4 text-muted-foreground">
              Impossible de retrouver l'offre sélectionnée. Retournez aux résultats et choisissez
              une option d'infrastructure.
            </p>
            <button
              onClick={() => setLocation("/results")}
              className="glow-accent rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground"
            >
              Retour aux résultats
            </button>
          </div>
        ) : offerLoading || !offer ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <>
            <OfferHeader offer={offer} leadId={leadId} />

            <div className="grid items-start gap-6 md:grid-cols-[2fr_1fr]">
              <div className="flex flex-col gap-5">
                <TechSummaryCard offer={offer} />
                <ServiceTermsCard offer={offer} />
                <ComplianceCard />

                <label className="flex cursor-pointer items-start gap-[11px]">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-[13px] leading-[1.55] text-muted-foreground">
                    J'accepte les{" "}
                    <a href="/terms" className="text-accent hover:underline">
                      conditions générales
                    </a>{" "}
                    et la{" "}
                    <a href="/privacy" className="text-accent hover:underline">
                      politique de confidentialité
                    </a>
                    .
                  </span>
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <div className="flex flex-col gap-[18px]">
                <RecapSidebar
                  offer={offer}
                  cta={
                    authLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : isAuthenticated ? (
                      <button
                        onClick={handleConfirm}
                        disabled={isProcessing || !termsAccepted}
                        className={ctaClass}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Redirection…
                          </>
                        ) : (
                          "Procéder au paiement →"
                        )}
                      </button>
                    ) : (
                      <SocialLoginButtons
                        onBeforeRedirect={() =>
                          // Persist intent across the OAuth redirect (returns to "/"),
                          // so the funnel resumes at this checkout after login.
                          saveCheckoutIntent({ offerId: offerId!, leadId: leadId! })
                        }
                      />
                    )
                  }
                  hint={
                    <span className="text-center text-[11.5px] leading-[1.55] text-muted-foreground">
                      Redirection sécurisée vers Stripe pour finaliser le paiement. Annulable avant
                      confirmation.
                    </span>
                  }
                />
                <HelpCard />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
