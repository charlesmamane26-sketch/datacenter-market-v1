import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Check, Zap, DollarSign, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OfferCard {
  id: number;
  name: string;
  category: "best_value" | "fastest" | "cheapest";
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

export default function ResultsScreen() {
  const [, setLocation] = useLocation();
  const [selectedOffer, setSelectedOffer] = useState<number | null>(null);
  const leadIdParam = new URLSearchParams(window.location.search).get("leadId");
  const leadId =
    leadIdParam && Number.isFinite(Number(leadIdParam))
      ? Number(leadIdParam)
      : undefined;
  const { data: offers, isLoading } = trpc.offers.match.useQuery(
    leadId != null ? { leadId } : {},
  );

  const categoryLabels: Record<"best_value" | "fastest" | "cheapest", string> = {
    best_value: "Best Value",
    fastest: "Fastest",
    cheapest: "Cheapest",
  };

  const categoryColors: Record<"best_value" | "fastest" | "cheapest", string> = {
    best_value: "border-accent",
    fastest: "border-lime-400",
    cheapest: "border-blue-400",
  };

  const categoryBadges: Record<"best_value" | "fastest" | "cheapest", string> = {
    best_value: "bg-accent/10 text-accent",
    fastest: "bg-lime-400/10 text-lime-400",
    cheapest: "bg-blue-400/10 text-blue-400",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground py-12">
        <div className="container max-w-6xl">
          <div className="mb-12">
            <button
              onClick={() => setLocation("/workload")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Workload
            </button>
            <h1 className="text-4xl font-bold mb-4">Loading offers...</h1>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="tech-card space-y-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-12 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const bestValueOffer = offers?.find((o) => o.category === "best_value");
  const fastestOffer = offers?.find((o) => o.category === "fastest");
  const cheapestOffer = offers?.find((o) => o.category === "cheapest");

  const displayOffers = [bestValueOffer, fastestOffer, cheapestOffer].filter(
    Boolean
  ) as OfferCard[];

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => setLocation("/workload")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Workload
          </button>

          <h1 className="text-4xl font-bold mb-4">Your Infrastructure Options</h1>
          <p className="text-lg text-muted-foreground">
            We found 3 perfect matches. Compare and choose the one that best fits your needs.
          </p>
        </div>

        {/* Offers Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {displayOffers.map((offer) => (
            <div
              key={offer.category}
              className={`tech-card border-2 transition-all cursor-pointer hover:shadow-lg ${
                selectedOffer === offer.id
                  ? categoryColors[offer.category]
                  : "border-border"
              }`}
              onClick={() => setSelectedOffer(offer.id)}
            >
              {/* Header */}
              <div className="mb-6">
                <div
                  className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold mb-3 ${
                    categoryBadges[offer.category]
                  }`}
                >
                  {categoryLabels[offer.category]}
                </div>
                <h3 className="text-2xl font-bold mb-2">{offer.gpuType}</h3>
                <p className="text-muted-foreground text-sm">{offer.location}</p>
              </div>

              {/* Pricing */}
              <div className="mb-6 p-4 bg-card/50 rounded-lg border border-border">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-accent">
                    €{Number(offer.monthlyPrice).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                {Number(offer.setupFee) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Setup: €{Number(offer.setupFee).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Specs */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-sm">
                    {offer.gpuCount}x {offer.gpuType} GPUs
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-sm">
                    {offer.cpuCores} CPU cores, {offer.ramGb}GB RAM
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-sm">{offer.deploymentTime}</span>
                </div>
              </div>

              {/* Features */}
              {offer.features && offer.features.length > 0 && (
                <div className="mb-6 space-y-2">
                  {offer.features.slice(0, 3).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* SLA */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border mb-6">
                <p className="text-xs text-muted-foreground mb-1">SLA</p>
                <p className="font-semibold">{offer.sla}</p>
              </div>

              {/* CTA */}
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(
                    `/offer-detail/${offer.id}` +
                      (leadId != null ? `?leadId=${leadId}` : ""),
                  );
                }}
              >
                View Details
              </Button>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="tech-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Criteria</th>
                {displayOffers.map((offer) => (
                  <th
                    key={offer.category}
                    className="text-left py-3 px-4 font-semibold text-accent"
                  >
                    {categoryLabels[offer.category]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border hover:bg-card/50">
                <td className="py-3 px-4 font-medium">GPU Type</td>
                {displayOffers.map((offer) => (
                  <td key={offer.category} className="py-3 px-4">
                    {offer.gpuType}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border hover:bg-card/50">
                <td className="py-3 px-4 font-medium">GPU Count</td>
                {displayOffers.map((offer) => (
                  <td key={offer.category} className="py-3 px-4">
                    {offer.gpuCount}x
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border hover:bg-card/50">
                <td className="py-3 px-4 font-medium">CPU Cores</td>
                {displayOffers.map((offer) => (
                  <td key={offer.category} className="py-3 px-4">
                    {offer.cpuCores}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border hover:bg-card/50">
                <td className="py-3 px-4 font-medium">RAM</td>
                {displayOffers.map((offer) => (
                  <td key={offer.category} className="py-3 px-4">
                    {offer.ramGb}GB
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border hover:bg-card/50">
                <td className="py-3 px-4 font-medium">Monthly Price</td>
                {displayOffers.map((offer) => (
                  <td key={offer.category} className="py-3 px-4 font-semibold text-accent">
                    €{Number(offer.monthlyPrice).toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border hover:bg-card/50">
                <td className="py-3 px-4 font-medium">Deployment Time</td>
                {displayOffers.map((offer) => (
                  <td key={offer.category} className="py-3 px-4">
                    {offer.deploymentTime}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-card/50">
                <td className="py-3 px-4 font-medium">SLA</td>
                {displayOffers.map((offer) => (
                  <td key={offer.category} className="py-3 px-4">
                    {offer.sla}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
