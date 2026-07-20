import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { saveCheckoutIntent, clearCheckoutIntent } from "@/lib/checkoutIntent";
import { loadLeadClaim } from "@/lib/leadClaim";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { JourneyStepper, MarketChrome } from "@/components/market";
import { PURCHASE_TERMS_VERSION } from "@shared/const";
import {
  ComplianceCard,
  HelpCard,
  OfferHeader,
  RecapSidebar,
  ServiceTermsCard,
  TechSummaryCard,
} from "@/components/market/offerPurchase";

function checkoutKeyStorageName(leadId: number, offerId: number): string {
  return `dcm-checkout-idempotency:${leadId}:${offerId}`;
}

function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function getStableIdempotencyKey(leadId: number | undefined, offerId: number | undefined): string {
  if (leadId == null || offerId == null) return newIdempotencyKey();
  const storageKey = checkoutKeyStorageName(leadId, offerId);
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) return stored;
    const created = newIdempotencyKey();
    sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return newIdempotencyKey();
  }
}

function resetStableIdempotencyKey(leadId: number, offerId: number): void {
  try {
    sessionStorage.removeItem(checkoutKeyStorageName(leadId, offerId));
  } catch {
    // A fresh in-memory key will still be generated when storage is unavailable.
  }
}

function trpcErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function readQueryNumber(key: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutAttempt, setCheckoutAttempt] = useState(0);

  const offerId = readQueryNumber("offerId");
  const leadId = readQueryNumber("leadId");
  const missingContext = offerId == null || leadId == null;
  const idempotencyKey = useMemo(
    () => getStableIdempotencyKey(leadId, offerId),
    [leadId, offerId, checkoutAttempt],
  );

  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    data: offer,
    isLoading: offerLoading,
    isError: offerError,
    refetch: refetchOffer,
  } = trpc.offers.get.useQuery(
    { id: offerId ?? 0 },
    { enabled: offerId != null },
  );
  const checkout = trpc.orders.checkout.useMutation();

  const handleConfirm = async () => {
    setError(null);
    if (missingContext) {
      setError("Contexte de commande introuvable. Retournez aux résultats et choisissez une offre.");
      return;
    }
    if (!termsAccepted) {
      setError("Vous devez accepter les conditions générales avant de continuer.");
      return;
    }
    setIsProcessing(true);
    try {
      // Present the claim token if this lead was created anonymously in this
      // browser; ignored server-side once the lead is owned by the logged-in user.
      // The server persists the acceptance version/time and uses this stable key
      // to return the same order/session when the request is retried.
      const checkoutInput = {
        leadId: leadId!,
        offerId: offerId!,
        claimToken: loadLeadClaim(leadId!),
        termsAccepted: true as const,
        termsVersion: PURCHASE_TERMS_VERSION,
        idempotencyKey,
      };
      const { url } = await checkout.mutateAsync(checkoutInput);
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
      if (trpcErrorCode(err) === "CONFLICT" && leadId != null && offerId != null) {
        resetStableIdempotencyKey(leadId, offerId);
        setCheckoutAttempt(attempt => attempt + 1);
        setError("La session de paiement précédente a expiré. Cliquez à nouveau pour en créer une nouvelle.");
      } else {
        setError("Le paiement n'a pas pu démarrer. Veuillez réessayer.");
      }
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
            PAIEMENT SÉCURISÉ
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
        ) : offerLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : offerError ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-[26px]">
            <h1 className="mb-2 text-xl font-semibold">Option indisponible</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Le détail de la configuration n'a pas pu être chargé.
            </p>
            <button
              type="button"
              onClick={() => refetchOffer()}
              className="rounded-[9px] bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
            >
              Réessayer
            </button>
          </div>
        ) : !offer ? (
          <div className="rounded-xl border border-border bg-card p-[26px]">
            <h1 className="mb-2 text-xl font-semibold">Option introuvable</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Cette configuration n'est plus disponible dans le catalogue.
            </p>
            <button
              type="button"
              onClick={() => setLocation(`/results?leadId=${leadId}`)}
              className="rounded-[9px] bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
            >
              Retour aux résultats
            </button>
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
                    {" "}dans leurs versions en vigueur.
                  </span>
                </label>

                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
