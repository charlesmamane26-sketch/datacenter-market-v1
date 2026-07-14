import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooterEn";
import SiteHeader from "@/components/marketing/SiteHeaderEn";

/**
 * SEO satellite page "Datacenter colocation" (/en/datacenter-colocation/).
 * Opens the non-GPU capacity cluster (colocation, racks, kW) within the
 * comparison positioning — see docs/SEO-ROADMAP.md. Mirror of
 * ColocationDatacenter.tsx (FR). Colocation is NOT in the standard catalogue:
 * offers are sourced via the market call from partner operators — stated as
 * such, no invented figures.
 */
export default function DatacenterColocationEn() {
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
            <li aria-current="page" className="text-foreground">
              Datacenter colocation
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Datacenter colocation: classic capacity rental, compared across the market
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Renting datacenter capacity — a rack, a cage, a private suite, kilowatts — to host
              your own servers remains the classic infrastructure route: you keep control of the
              hardware, the operator provides power, cooling, physical security and connectivity.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This market is even more opaque than GPU compute: rate cards are rarely public,
              scopes vary (IT kW versus billed kW, cross-connects included or not) and every
              operator quotes in its own format. DatacenterMarket applies the same method to
              colocation as to GPU as a Service: one market call submitted to partner operators,
              normalised offers, and a comparison on identical criteria.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">What is datacenter capacity rental?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Colocation means installing your equipment in a third-party datacenter. Depending on
              the need, capacity is rented at several granularities:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">Rack units or half-racks</strong> — a few U for
                isolated servers, shared within a mutualised rack.
              </li>
              <li>
                <strong className="text-foreground">The dedicated rack (42-47U)</strong> — the
                standard: billed per rack with a power envelope (commonly 5 to 10 kW), or directly
                per kW.
              </li>
              <li>
                <strong className="text-foreground">The cage or private suite</strong> — an
                enclosed space for tens of racks, with dedicated access control.
              </li>
              <li>
                <strong className="text-foreground">The capacity contract (kW / MW)</strong> — for
                large deployments you no longer think in racks but in reserved IT power, often
                build-to-suit.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Colocation, cloud or GPU as a Service: three ways to consume infrastructure
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Colocation leaves you owning the hardware: server CAPEX, but a predictable hosting
              rent and full control of the stack. Cloud and{" "}
              <Link href="/en/gpu-as-a-service/" className="text-accent hover:underline">
                GPU as a Service
              </Link>{" "}
              invert the equation: the provider owns the infrastructure and you consume it as OPEX.
              In between,{" "}
              <Link href="/en/gpu-as-a-service/gpu-rental/" className="text-accent hover:underline">
                dedicated GPU rental
              </Link>{" "}
              gives you exclusive hardware without buying it.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Colocation remains the right choice when the hardware already exists (server-room
              migration), when compliance demands physical control of the equipment, or when the
              long-term TCO of a stable fleet beats the cloud. And for AI: hosting your own GPU
              servers in colocation requires high-density racks — exactly where comparing offers
              becomes critical.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">The criteria that make colocation offers comparable</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">The full price</strong> — rack rent or €/kW,
                setup fees, energy included or passed through (and at what rate), cross-connect
                costs.
              </li>
              <li>
                <strong className="text-foreground">Available density</strong> — 5 kW per rack does
                not host a modern GPU server; AI demands 20 to 40 kW and beyond, often with liquid
                or direct-to-chip cooling.
              </li>
              <li>
                <strong className="text-foreground">Redundancy and service level</strong> — power
                and cooling architecture (N+1, 2N), Tier certification or equivalence, availability
                SLA and penalties.
              </li>
              <li>
                <strong className="text-foreground">Energy efficiency (PUE)</strong> — it directly
                drives your passed-through energy bill.
              </li>
              <li>
                <strong className="text-foreground">Connectivity</strong> — carriers on site,
                neutrality, access to internet exchanges and clouds.
              </li>
              <li>
                <strong className="text-foreground">Location and jurisdiction</strong> — proximity
                to your teams and users, EU hosting and GDPR compliance, up to sovereign
                requirements (see{" "}
                <Link href="/en/gpu-as-a-service/sovereign-gpu-europe/" className="text-accent hover:underline">
                  sovereign GPU in Europe
                </Link>
                ).
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              How DatacenterMarket compares colocation offers
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Colocation is not part of our standard catalogue, which currently focuses on
              dedicated GPU configurations. It is mobilised through the market call: describe your
              need (number of racks or power, density, location, compliance constraints) and we
              consult partner datacenter operators — the same players that host the GPU offers on
              our marketplace.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You receive offers normalised on the criteria above, genuinely comparable —
              availability and terms to be confirmed by each operator.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Describe my datacenter capacity need
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Tip: pick the "Other" workload type in the form and detail racks, kW and constraints
              in the free-text field — the market call takes them into account.
            </p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
