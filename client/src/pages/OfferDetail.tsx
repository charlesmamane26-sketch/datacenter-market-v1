import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Check, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function OfferDetail() {
  const { offerId } = useParams<{ offerId: string }>();
  const [, setLocation] = useLocation();
  const leadId = new URLSearchParams(window.location.search).get("leadId");
  const { data: offer, isLoading } = trpc.offers.get.useQuery({
    id: parseInt(offerId || "0"),
  });

  if (isLoading || !offer) {
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
          <div className="space-y-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const monthlyPrice = Number(offer.monthlyPrice);
  const setupFee = Number(offer.setupFee);
  const totalFirstMonth = monthlyPrice + setupFee;

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

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">{offer.name}</h1>
              <p className="text-lg text-muted-foreground">{offer.location}</p>
            </div>

            <div className="tech-card">
              <h2 className="text-2xl font-bold mb-6">Technical Summary</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">GPU Configuration</p>
                  <p className="text-lg font-semibold">
                    {Number(offer.gpuCount)}x {offer.gpuType}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">CPU Cores</p>
                  <p className="text-lg font-semibold">{Number(offer.cpuCores)} cores</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Memory</p>
                  <p className="text-lg font-semibold">{Number(offer.ramGb)}GB RAM</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Storage</p>
                  <p className="text-lg font-semibold">{Number(offer.storageGb)}GB</p>
                </div>
              </div>
            </div>

            <div className="tech-card">
              <h2 className="text-2xl font-bold mb-6">Service Terms</h2>
              <div className="space-y-4">
                <div className="p-4 bg-card/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-1">SLA Guarantee</p>
                  <p className="text-lg font-semibold">{offer.sla}</p>
                </div>
                <div className="p-4 bg-card/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Deployment Time</p>
                  <p className="text-lg font-semibold">{offer.deploymentTime}</p>
                </div>
              </div>
            </div>

            <div className="tech-card border-lime-400/30">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-lime-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Contract & Compliance</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    EU GDPR compliant infrastructure with standard enterprise SLA and support terms.
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li>✓ GDPR compliant data processing</li>
                <li>✓ EU data residency guaranteed</li>
                <li>✓ High availability architecture</li>
                <li>✓ 24/7 technical support included</li>
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="tech-card sticky top-8">
              <h3 className="text-lg font-bold mb-6">Pricing Breakdown</h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-border">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Monthly</span>
                  <span className="font-semibold">€{monthlyPrice.toLocaleString()}</span>
                </div>
                {setupFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Setup Fee</span>
                    <span className="font-semibold">€{setupFee.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="mb-6 p-4 bg-accent/10 rounded-lg border border-accent/30">
                <p className="text-sm text-muted-foreground mb-2">First Month Total</p>
                <p className="text-3xl font-bold text-accent">
                  €{totalFirstMonth.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Then €{monthlyPrice.toLocaleString()}/month
                </p>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
                  <span>No long-term contract required</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
                  <span>Transparent billing</span>
                </div>
              </div>

              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6"
                onClick={() =>
                  setLocation(
                    `/checkout?offerId=${offer.id}` +
                      (leadId ? `&leadId=${leadId}` : ""),
                  )
                }
              >
                Proceed to Checkout
              </Button>
            </div>

            <div className="tech-card text-sm">
              <h4 className="font-semibold mb-3">Need Help?</h4>
              <p className="text-muted-foreground mb-4">
                Our team is ready to answer any questions about this infrastructure.
              </p>
              <Button variant="outline" className="w-full">
                Talk to an Advisor
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
