import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooterEn";
import SiteHeader from "@/components/marketing/SiteHeaderEn";

/**
 * SEO satellite page « Sovereign GPU in Europe / France » (/en/gpu-as-a-service/sovereign-gpu-europe).
 * Accuracy: a single Paris-hosted configuration in the catalogue (server/seed.ts,
 * "H100 Rapid Deploy", 8× H100, 24 h, 99.99% SLA); no certification is claimed.
 * [TO VALIDATE]: availability and terms of a 100% France hosting option via the market call.
 */
export default function SovereignGpuEn() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="container py-12 max-w-4xl">
        <div className="flex justify-end mb-4">
          <Link
            href="/gpu-as-a-service/gpu-souverain-france/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voir la version française"
          >
            FR
          </Link>
        </div>

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
              Sovereign GPU in Europe
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Sovereign GPU: host your AI workloads in Europe
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Training a model on customer data, fine-tuning an LLM on internal documents, serving
              inference on regulated data: the location of your GPU infrastructure is not a
              technical detail. It is a matter of GDPR compliance and risk control.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket is a GPU capacity marketplace operated by Anavim Advisory. We neither
              own nor run servers: we put European infrastructure providers into competition to find
              the configuration that meets your sovereignty constraints. Every offer in our
              catalogue is hosted in the European Union, including a configuration in Paris.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This page details what EU or France data residency actually guarantees and the
              criteria to check before you commit. For an overview, see our{" "}
              <Link href="/en/gpu-as-a-service" className="text-accent hover:underline">
                GPU as a Service
              </Link>{" "}
              guide.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Why sovereignty matters for your AI workloads
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The datasets used for training and fine-tuning often contain personal data, trade
              secrets or regulated data. Yet the GDPR strictly governs transfers of personal data
              outside the European Union: hosting the processing within the EU makes demonstrating
              compliance simpler.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              There is also a dependency question: a provider subject to the law of a third country
              may fall under legislation with extraterritorial reach, regardless of where the
              servers are physically located.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                GDPR compliance: processing of personal data within EU territory, with no transfer
                mechanism to document for the hosting itself.
              </li>
              <li>
                Asset protection: training datasets, proprietary model weights, regulated business
                data.
              </li>
              <li>
                Legal risk control: the provider's entity, the law governing the contract, the
                subcontracting chain.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              What EU or France data residency guarantees
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              EU data residency means your data is stored and processed in datacenters located
              within Union territory, in a framework where the GDPR applies directly. It is the
              foundation of AI hosting in Europe.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Let's be precise: location does not settle everything. The legal entity operating the
              datacenter, its possible parent company and its subcontractors matter just as much.
              Hosting in France is an additional level of requirement, sometimes mandated by
              internal policies or public-sector clients.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              GPU cloud in France and the EU: what DatacenterMarket offers
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our role is that of an intermediary. You describe your need (workload type, number of
              GPUs, budget, location constraints); our comparison engine matches it against the
              catalogue and proposes up to three offers from partner providers. Ordering and payment
              happen online, then the provider provisions the infrastructure, whose deployment you
              track from your dashboard.
            </p>
            <h3 className="text-xl font-semibold">A catalogue hosted in the European Union</h3>
            <p className="text-muted-foreground leading-relaxed">
              Every configuration in our current catalogue is located in the EU: Frankfurt, Paris,
              Amsterdam, Warsaw, Madrid, Dublin and Stockholm. These are dedicated (bare metal)
              infrastructures, on a monthly subscription.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              In Paris: a dedicated cluster of 8 NVIDIA H100 80 GB GPUs, made available within 24 h,
              with a 99.99% SLA. Across the catalogue's full H100 range (Frankfurt, Paris, Amsterdam
              — clusters of 8 to 16 GPUs, delivered in 24 h to 96 h, SLAs from 99.9% to 99.99%),
              expect €2.9 to €3.8/GPU/h as an hourly equivalent derived from the monthly prices,
              depending on configuration and commitment, excluding setup fees — never guaranteed
              prices. The full breakdown is in our{" "}
              <Link
                href="/en/gpu-as-a-service/gpu-rental-pricing"
                className="text-accent hover:underline"
              >
                GPU rental pricing table
              </Link>
              .
            </p>
            <h3 className="text-xl font-semibold">
              100% France hosting through a market call
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              If your specification requires hosting exclusively in France, we relay that
              requirement to our partner providers through the market call. The availability and
              terms of a 100% France offer depend on the providers' capacity at the time of the
              request. The process itself does not change: market call, up to three offers compared,
              with a target of availability within 72 h once a compliant offer is identified.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              The criteria to check with an AI hosting provider
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Whether you go through our marketplace or directly, certain points must be audited
              before any commitment. We claim no certification on our providers' behalf: these
              elements are verified case by case, contract in hand.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                Actual location: the physical address of the datacenter, not just the commercial
                "region" that is advertised.
              </li>
              <li>Legal entity: who signs the contract, under which law, with which parent company.</li>
              <li>
                Certifications: ISO 27001, SecNumCloud or HDS depending on your sector — to be
                requested and verified directly with the provider, scope and validity included.
              </li>
              <li>
                Subcontracting chain: who runs the machines, who handles maintenance, who has
                physical or logical access.
              </li>
              <li>Contractual commitments: SLA, incident notification, reversibility terms.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Reversibility and portability: limiting vendor dependency
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Sovereignty is not limited to location: it includes the ability to change providers.
              The offers in our catalogue are monthly subscriptions on dedicated infrastructure,
              which limits the length of commitment compared with multi-year contracts.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Dedicated bare metal also works in your favour: you install your own software stack
              (orchestrator, containers, frameworks) rather than proprietary managed services
              (lock-in). This reduces the cost of a migration without eliminating it — document your
              backups and exports from the outset.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Ready to compare EU-hosted offers? Describe your workload: you receive up to three
              proposals from our partner providers — best value, fastest deployment, lowest price.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Describe my workload
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
          </section>

          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Frequently asked questions about sovereign GPU</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">What is a sovereign GPU?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  There is no single legal definition: the term refers to GPU compute capacity
                  operated within a controlled legal framework — servers in the EU or France, an
                  entity subject to European law, contractual guarantees on data access.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  Are your offers SecNumCloud or ISO 27001 certified?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  No. DatacenterMarket is an intermediary: certifications belong to the providers
                  and we claim none of them. If your project requires one, state it in your request:
                  we relay it in the market call, and it is up to you to verify the chosen
                  provider's attestations.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  Can I host my AI workloads in France only?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our catalogue includes a configuration in Paris (a cluster of 8 NVIDIA H100 GPUs,
                  provisioned within 24 h). For a broader 100% France need, we call on our partner
                  providers through the market call; availability is confirmed case by case.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  How much does a GPU cloud hosted in Europe cost?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  In our current catalogue, the hourly equivalents derived from the monthly prices
                  range from around €1.2/GPU/h (RTX 4090) to €3.8/GPU/h (H100), excluding setup
                  fees. These are observed orders of magnitude, not guaranteed prices.
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
