import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { saveCheckoutIntent, clearCheckoutIntent } from "@/lib/checkoutIntent";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Lock, LogIn, Check } from "lucide-react";

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

  const monthly = offer ? Number(offer.monthlyPrice) : 0;
  const setup = offer ? Number(offer.setupFee) : 0;
  const total = monthly + setup;

  const handleSignIn = () => {
    if (missingContext) {
      setError("Missing order context. Please go back to results and pick an offer.");
      return;
    }
    // Persist intent across the OAuth redirect (which returns the user to "/").
    saveCheckoutIntent({ offerId: offerId!, leadId: leadId! });
    window.location.href = getLoginUrl();
  };

  const handleConfirm = async () => {
    setError(null);
    if (missingContext) {
      setError("Missing order context. Please go back to results and pick an offer.");
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
        setError("We couldn't start the payment. Please try again.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      setError("We couldn't start the payment. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="container max-w-4xl">
        <button
          onClick={() => setLocation("/results")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Results
        </button>

        <h1 className="text-3xl font-bold mb-8">Review &amp; Confirm Your Order</h1>

        {missingContext ? (
          <div className="tech-card">
            <p className="text-muted-foreground mb-4">
              We couldn't find which offer you selected. Please return to the results and choose an
              infrastructure option.
            </p>
            <Button onClick={() => setLocation("/results")} className="bg-accent hover:bg-accent/90">
              Back to Results
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {/* Order review */}
            <div className="md:col-span-2 space-y-8">
              <div className="tech-card">
                <h2 className="text-xl font-bold mb-6">Infrastructure</h2>
                {offerLoading || !offer ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold">{offer.name}</p>
                      <p className="text-muted-foreground">{offer.location}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">GPU Configuration</p>
                        <p className="font-semibold">
                          {offer.gpuCount}x {offer.gpuType}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Compute</p>
                        <p className="font-semibold">
                          {offer.cpuCores} cores · {offer.ramGb}GB RAM
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">SLA</p>
                        <p className="font-semibold">{offer.sla}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Deployment</p>
                        <p className="font-semibold">{offer.deploymentTime}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <a href="/terms" className="text-accent hover:underline">
                    terms and conditions
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="text-accent hover:underline">
                    privacy policy
                  </a>
                  .
                </label>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            {/* Order summary */}
            <div>
              <div className="tech-card sticky top-8">
                <h3 className="text-lg font-bold mb-6">Order Summary</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly</span>
                    <span className="font-semibold">€{monthly.toLocaleString()}</span>
                  </div>
                  {setup > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Setup Fee</span>
                      <span className="font-semibold">€{setup.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-accent/10 rounded-lg border border-accent/30 mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Total (First Month)</p>
                  <p className="text-3xl font-bold text-accent">€{total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Then €{monthly.toLocaleString()}/month
                  </p>
                </div>

                {authLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : isAuthenticated ? (
                  <Button
                    onClick={handleConfirm}
                    disabled={isProcessing || !termsAccepted || !offer}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {isProcessing ? "Redirecting…" : "Proceed to Payment"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSignIn}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in to confirm order
                  </Button>
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground mt-4">
                  <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    You'll be securely redirected to Stripe to complete payment. You can cancel
                    before confirming.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
