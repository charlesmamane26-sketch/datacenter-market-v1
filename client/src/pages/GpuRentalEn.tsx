import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooterEn";
import SiteHeader from "@/components/marketing/SiteHeaderEn";

/**
 * SEO satellite page "GPU rental" (/en/gpu-as-a-service/gpu-rental/).
 * Targets classic rental queries ("GPU rental", "rent GPUs", "dedicated GPU
 * capacity") within the comparison positioning — see docs/SEO-ROADMAP.md.
 * Mirror of LocationGpu.tsx (FR). Facts derive from the catalogue (server/seed.ts).
 */
export default function GpuRentalEn() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="container py-12 max-w-4xl">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/en/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link href="/en/gpu-as-a-service/" className="hover:text-foreground transition-colors">
                GPU as a Service
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-foreground">
              GPU rental
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              GPU rental: classic dedicated capacity, compared across the market
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Classic GPU capacity rental — a dedicated configuration, reserved for you, billed on
              a monthly commitment — remains the backbone of production AI compute. It differs from
              hourly cloud (spot instances, serverless GPU) through constant performance, a
              predictable budget and controlled data location.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket centralises GPU rental offers from European providers and normalises
              them (monthly price, mobilisation lead time, SLA, location): describe your need once
              and compare up to three firm quotes instead of prospecting providers one by one.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">What is classic GPU capacity rental?</h2>
            <p className="text-muted-foreground leading-relaxed">
              It is dedicated GPU infrastructure — bare-metal servers or reserved clusters of 4 to
              16 GPUs — hosted in a datacenter and subscribed monthly. You share neither the cards,
              nor the memory bandwidth, nor the interconnect: the configuration is provisioned for
              your exclusive use, under a contractual SLA.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              On our catalogue, these configurations range from an RTX 4090 server for R&amp;D to a
              16× H100 InfiniBand cluster for distributed training, with provisioning lead times of
              24 hours to 7 days depending on the offer.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Dedicated rental or hourly cloud: which to choose?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Hourly GPU cloud (on-demand instances, spot, serverless) excels at short bursts and
              experimentation: you pay by the minute and stop whenever you want. But once a
              workload becomes continuous — long training runs, production inference, a team
              consuming compute all year — monthly dedicated rental takes the lead:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">Predictable cost:</strong> a fixed monthly
                price, with no usage-billing surprises and no spot-price spikes.
              </li>
              <li>
                <strong className="text-foreground">Constant performance:</strong> no noisy
                neighbours, no preemption — the capacity is yours, including the interconnect
                (InfiniBand on training clusters).
              </li>
              <li>
                <strong className="text-foreground">Controlled location:</strong> you know which
                datacenter runs your workloads — a GDPR prerequisite that shared serverless rarely
                guarantees.
              </li>
              <li>
                <strong className="text-foreground">Guaranteed availability:</strong> recent ranges
                (H100) are often unavailable by the hour exactly when you need them; reserved
                capacity does not vanish.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Renting rather than buying: the CAPEX/OPEX recap</h2>
            <p className="text-muted-foreground leading-relaxed">
              Compared with buying servers, renting turns an investment (CAPEX) into an operating
              cost (OPEX): start in days rather than months, a monthly budget, obsolescence risk
              carried by the provider. Buying only makes sense for a stable workload that will
              saturate the hardware for several years, with a team to operate it. The full
              trade-off is covered in our{" "}
              <Link href="/en/gpu-as-a-service/" className="text-accent hover:underline">
                GPU-as-a-Service guide
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">How to compare GPU rental offers across the market?</h2>
            <p className="text-muted-foreground leading-relaxed">
              The GPU rental market is fragmented: every provider publishes its pricing in its own
              format, with different scopes (setup fees included or not, varying SLAs, 1-to-36-month
              commitments). Four criteria make offers genuinely comparable:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">The full monthly price</strong> — including
                amortised setup fees, network and storage (see our{" "}
                <Link href="/en/gpu-as-a-service/gpu-rental-pricing/" className="text-accent hover:underline">
                  GPU prices compared in €/GPU/h
                </Link>
                ).
              </li>
              <li>
                <strong className="text-foreground">The mobilisation lead time</strong> — 24 hours
                to 7 days on our catalogue.
              </li>
              <li>
                <strong className="text-foreground">The SLA</strong> — 99.5% to 99.99% depending on
                the offer, with or without contractual penalties.
              </li>
              <li>
                <strong className="text-foreground">The location</strong> — hosting country and
                jurisdiction, up to{" "}
                <Link href="/en/gpu-as-a-service/sovereign-gpu-europe/" className="text-accent hover:underline">
                  sovereign GPU in Europe
                </Link>
                .
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              That is exactly what the DatacenterMarket market call does: your criteria are
              submitted to partner providers, and you receive up to three quotes normalised on
              those four axes — ordered and paid online.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Compare rental offers for my workload
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
