import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooterEn";
import SiteHeader from "@/components/marketing/SiteHeaderEn";

/**
 * SEO satellite page "GPU rental pricing" (/en/gpu-as-a-service/gpu-rental-pricing).
 * Accuracy: €/GPU/h equivalents derived from the catalogue's monthly prices
 * (server/seed.ts, 730 h/month basis, excluding setup). H200/B200 are outside
 * the catalogue → "to be confirmed".
 */
export default function GpuPricingEn() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="container py-12 max-w-4xl">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/en" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link href="/en/gpu-as-a-service" className="hover:text-foreground transition-colors">
                GPU as a Service
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-foreground">
              GPU rental pricing
            </li>
          </ol>
        </nav>

        <div className="mb-8 text-sm">
          <Link
            href="/gpu-as-a-service/prix-location-gpu/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            FR
          </Link>
        </div>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              GPU rental pricing: indicative rate card in €/GPU/h
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              How much does it cost to rent a GPU for your AI projects? The cost of a dedicated
              cloud GPU varies widely depending on the card generation, the cluster size and the
              commitment length. To give you a reference point, here is an indicative rate card in
              euros per GPU per hour, derived from the monthly prices observed across our catalogue.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket is a GPU-capacity marketplace: we neither own nor operate the
              infrastructure, we put European providers (datacenter operators, GPU clouds) in
              competition for your requirement. The figures below are therefore orders of magnitude,
              depending on configuration and commitment — never guaranteed prices.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              GPU rental: indicative prices by tier (€/GPU/h)
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our catalogue covers dedicated configurations (bare metal at our partner providers),
              billed monthly, with possible setup fees. The hourly equivalent below is calculated on
              a basis of 730 hours per month, excluding setup fees, to make comparison with
              on-demand GPU clouds easier.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA H100 80 GB — ≈ €2.9 to €3.8/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              The hourly price of an H100 GPU comes out at roughly €2.9 to €3.8/GPU/h on our
              catalogue. The offers cover dedicated clusters of 8 to 16 GPUs in Frankfurt, Paris or
              Amsterdam, delivered in 24 h to 96 h, with SLAs of 99.9% to 99.99%. This is the tier
              we recommend for training and fine-tuning large models.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA A100 80 GB — ≈ €1.6 to €1.8/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              A100 pods of 4 to 8 GPUs, in Warsaw and Madrid, sit around €1.6 to €1.8/GPU/h (99.5%
              SLA). Allow 6 to 7 days of lead time: a sensible trade-off when the schedule allows.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA L40S 48 GB — ≈ €1.5/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              Designed for inference, the 8-GPU L40S configuration in Dublin comes out at around
              €1.5/GPU/h (72 h lead time, 99.5% SLA).
            </p>
            <h3 className="text-xl font-semibold">NVIDIA RTX 4090 24 GB — ≈ €1.2/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              For R&D and constrained budgets, the 8-GPU RTX 4090 configuration in Stockholm comes
              in at around €1.2/GPU/h (48 h lead time, 99.0% SLA).
            </p>
            <h3 className="text-xl font-semibold">H200 and B200: via the market call</h3>
            <p className="text-muted-foreground leading-relaxed">
              NVIDIA H200 (141 GB HBM3e) and B200 (Blackwell, 192 GB HBM3e) are not in our standard
              catalogue to date. We can source them from our partner providers via the market call —
              availability and pricing to be confirmed.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              The factors that make GPU rental pricing vary
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Two "H100" offers can show significant price gaps. Before comparing one cloud GPU cost
              with another, check what the rate actually covers:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                GPU generation: an H100 rents for markedly more than an A100 or an RTX 4090, at
                equal sizing.
              </li>
              <li>
                Number of GPUs and interconnect: a cluster of 16 interconnected GPUs for distributed
                training is not priced like isolated cards.
              </li>
              <li>
                Commitment length: a longer commitment usually negotiates better than a one-off
                requirement.
              </li>
              <li>
                SLA level: moving from 99.0% to 99.99% availability implies more redundancy, hence a
                higher rate.
              </li>
              <li>
                Datacenter location: prices vary across European hubs; on our catalogue, the most
                economical configurations are hosted in Stockholm, Dublin, Warsaw and Madrid — the
                gap also stemming from the GPU generation offered at each site.
              </li>
              <li>
                Storage and network: storage volume, interconnect throughput and outbound bandwidth
                can weigh on the final bill.
              </li>
              <li>
                Setup fees: some dedicated configurations include commissioning fees, to factor into
                the full cost.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              How to get a priced offer: the market call
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              To move from an order of magnitude to a priced offer matching your requirement,
              describe your need in our online form: type of workload (training, fine-tuning,
              inference), number of GPUs, budget and any constraints.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our comparison engine matches your requirement against the catalogue and proposes up
              to three offers: the best value for money, the fastest to deploy and the cheapest. You
              order and pay online (Stripe payment), the provider provisions the infrastructure, and
              you track the deployment from your client dashboard.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Depending on the chosen configuration, capacity can be mobilised from 24 h. Our
              promise — capacity mobilised in 72 h via the market call — is met on several flagship
              configurations; only the most economical options require up to 7 days.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Describe my requirement and receive up to three offers
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
          </section>

          <section className="space-y-4 border-t border-border/50 pt-10">
            <h2 className="text-3xl font-bold">Going further</h2>
            <p className="text-muted-foreground leading-relaxed">
              This rate card complements our guide{" "}
              <Link href="/en/gpu-as-a-service" className="text-accent hover:underline">
                GPU as a Service: renting AI compute power in Europe
              </Link>
              , which details tiers, use cases and criteria for choosing a provider.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Do your data need to stay in Europe, or even in France? The offers in our catalogue are
              hosted in the EU (EU data residency, GDPR compliance), including a configuration in
              Paris. See our dedicated page on{" "}
              <Link
                href="/en/gpu-as-a-service/sovereign-gpu-europe"
                className="text-accent hover:underline"
              >
                sovereign GPU and AI hosting in Europe
              </Link>
              .
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Frequently asked questions about GPU rental pricing</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">What is the hourly price of an H100 GPU?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Between roughly €2.9 and €3.8/GPU/h in hourly equivalent on our catalogue (730
                  h/month basis, excluding setup), depending on configuration, commitment and SLA.
                  These are orders of magnitude; a priced offer matching your requirement is obtained
                  via the market call.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Is billing really by the hour?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  No. The catalogue configurations are dedicated and billed monthly, with possible
                  setup fees. The €/GPU/h equivalent is a comparison indicator (730 hours per month
                  basis).
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Why are the prices not guaranteed?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  DatacenterMarket is an intermediary: the catalogue is indicative and evolving, and
                  the final price depends on the offer selected at the provider (configuration,
                  commitment, SLA, location). Putting providers in competition via the market call
                  leads to priced offers: the price of the offer you select is the one applied at
                  online payment.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Can I rent H200 or B200 GPUs?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Not in the standard catalogue to date. We can source them from our partner
                  providers via the market call — availability and pricing to be confirmed.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  How quickly is capacity available?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Depending on the configuration: from 24 h for some H100 offers, 72 h on several
                  flagship configurations, and up to 7 days for the most economical options.
                </p>
              </div>
            </div>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
