import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooterEn";
import SiteHeader from "@/components/marketing/SiteHeaderEn";
import { GAAS_FAQ_EN } from "@shared/seo-content";

/**
 * English pillar SEO page "GPU as a Service" (/en/gpu-as-a-service).
 * Accuracy: figures derived from the catalogue (server/seed.ts); H200/B200 are
 * outside the catalogue → "to be confirmed via a market call".
 */
export default function GpuAsAServiceEn() {
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
            <li aria-current="page" className="text-foreground">
              GPU as a Service
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              GPU as a Service: compare the market's offers for your AI projects
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Access to compute power has become the main bottleneck for artificial intelligence
              projects. Training a model, fine-tuning an LLM or serving inference in production
              requires recent GPUs that are slow to obtain and expensive to tie up. GPU as a Service
              answers this problem: renting GPUs on demand, hosted in a datacenter, rather than
              buying servers.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket is the platform that centralises the European market's
              GPU-as-a-Service offers, operated by Anavim Advisory. We neither own nor run
              infrastructure: we aggregate and normalise offers from partner providers — datacenter
              operators, GPU clouds — then put them in competition to return up to three comparable
              quotes, with capacity mobilised within 72 hours through a market call.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This guide covers the essentials: definition, use cases, NVIDIA ranges, indicative
              pricing in €/GPU/h, buying versus renting, lead times and data sovereignty.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">What is GPU as a Service?</h2>
            <p className="text-muted-foreground leading-relaxed">
              GPU as a Service (GPUaaS) is the provision of datacenter-hosted GPU compute power, on
              a monthly rental or subscription basis, rather than through the purchase of hardware.
              Your organisation accesses dedicated infrastructure, provisioned and operated by a
              provider, and pays for it as an operating expense.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Compared with buying servers, renting GPUs removes three points of friction: the
              upfront investment, the hardware procurement lead times and the risk of obsolescence,
              which is high given the current pace of GPU generations.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Compared with the large generalist clouds, a marketplace like DatacenterMarket
              introduces competition: your requirement is put to the offers of several European
              providers rather than the price list of a single player. Configurations are dedicated
              (bare metal at our partner providers) and billed monthly.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Fast access to recent GPUs, without buying hardware</li>
              <li>Predictable monthly billing (OPEX)</li>
              <li>Dedicated configurations, sized to your workload</li>
              <li>The freedom to scale capacity as your needs evolve</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Use cases: when should you rent GPUs on demand?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Three families of workloads account for the bulk of on-demand GPU needs.
            </p>
            <h3 className="text-xl font-semibold">Model training</h3>
            <p className="text-muted-foreground leading-relaxed">
              Training models — foundation or specialised — mobilises multi-GPU clusters for weeks,
              sometimes months, and favours the most recent ranges. In our catalogue, the NVIDIA
              H100 clusters of 8 to 16 GPUs, in Frankfurt, Paris or Amsterdam, are sized for this
              use case.
            </p>
            <h3 className="text-xl font-semibold">Fine-tuning and model adaptation</h3>
            <p className="text-muted-foreground leading-relaxed">
              Fine-tuning adapts an existing model to a domain, a language or proprietary data, at a
              far lower cost than a full training run. Pods of 4 to 8 A100 80 GB GPUs often strike
              the right cost/performance balance; an H100 cluster remains relevant when iterations
              need to be fast.
            </p>
            <h3 className="text-xl font-semibold">LLM inference in production</h3>
            <p className="text-muted-foreground leading-relaxed">
              Serving an LLM in production demands stable latency, a contractual availability level
              and a controlled cost per request: inference-oriented GPUs such as the NVIDIA L40S 48
              GB are designed for this profile. For R&D or prototyping on a constrained budget, RTX
              4090 24 GB configurations let you iterate before scaling up.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">GPU ranges: H100, H200, B200, A100 and alternatives</h2>
            <p className="text-muted-foreground leading-relaxed">
              The memory capacities quoted are the manufacturers' public specifications. The
              availability mentioned is that of our catalogue as of today: it is given for guidance
              and may change.
            </p>
            <h3 className="text-xl font-semibold">
              NVIDIA H100 80 GB: the top training range in our catalogue
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              With 80 GB of memory, the H100 is the range we recommend first for training and
              intensive fine-tuning. Our catalogue offers clusters of 8 to 16 GPUs in Frankfurt,
              Paris and Amsterdam, with SLAs from 99.9% to 99.99% and lead times from 24 h to 96 h.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA H200: 141 GB of HBM3e</h3>
            <p className="text-muted-foreground leading-relaxed">
              The H200 raises onboard memory to 141 GB of HBM3e, an advantage for inference of very
              large models and long contexts. Absent from our standard catalogue to date, it can be
              sourced via a market call — availability and pricing to be confirmed.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA B200 (Blackwell): 192 GB of HBM3e</h3>
            <p className="text-muted-foreground leading-relaxed">
              The B200, on the Blackwell architecture, carries 192 GB of HBM3e. Also absent from the
              standard catalogue, it can be the subject of a consultation with our partner providers
              — availability and pricing to be confirmed.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA A100 80 GB: the proven value for money</h3>
            <p className="text-muted-foreground leading-relaxed">
              The A100 80 GB remains a safe bet for fine-tuning and training mid-sized models. Our
              catalogue offers it in pods of 4 to 8 GPUs in Warsaw and Madrid, with a 99.5% SLA.
            </p>
            <h3 className="text-xl font-semibold">
              L40S and RTX 4090: optimised inference and R&D on a controlled budget
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              The NVIDIA L40S 48 GB, in an 8-GPU configuration in Dublin, targets production
              inference. The RTX 4090 24 GB, in an 8-GPU configuration in Stockholm, is aimed at R&D
              and projects on a constrained budget.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Indicative pricing: how much does it cost to rent a GPU?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The benchmarks below are hourly equivalents derived from the monthly prices in our
              catalogue (basis of 730 h/month, excluding setup fees). They are orders of magnitude
              observed, depending on configuration and commitment — never guaranteed prices.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>NVIDIA H100 80 GB: ≈ €2.9–3.8/GPU/h</li>
              <li>NVIDIA A100 80 GB: ≈ €1.6–1.8/GPU/h</li>
              <li>NVIDIA L40S 48 GB: ≈ €1.5/GPU/h</li>
              <li>NVIDIA RTX 4090 24 GB: ≈ €1.2/GPU/h</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              The final price varies with the GPU range and generation, the cluster size, the
              commitment term, the location, the SLA level, as well as the associated network and
              storage. Any setup fees may apply on top of the monthly subscription.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              For the range-by-range detail and the factors that drive variation, see{" "}
              <Link
                href="/en/gpu-as-a-service/gpu-rental-pricing"
                className="text-accent hover:underline"
              >
                our GPU rental pricing guide
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Buying or renting GPUs: CAPEX versus OPEX</h2>
            <p className="text-muted-foreground leading-relaxed">
              Buying GPU servers is an investment (CAPEX): a large upfront outlay, a purchase and
              installation cycle, then operations on your side — hosting, energy, cooling,
              maintenance — with the risk of obsolescence borne entirely by the buyer.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Renting is an operating expense (OPEX): a fast start, a smoothed monthly budget,
              adjustable capacity and hardware risk carried by the provider. This is the
              DatacenterMarket model: rental of dedicated infrastructure on a monthly subscription,
              with no hardware sale.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Buying still makes sense for a stable workload that will saturate the infrastructure
              for several years, with a team to operate it. Renting prevails for a one-off,
              evolving or uncertain need, or when speed to market takes priority.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Provisioning lead times: from 24 hours to 7 days</h2>
            <p className="text-muted-foreground leading-relaxed">
              In our catalogue: as fast as 24 h for some H100 clusters, 48 h for RTX 4090
              configurations, 72 h for the L40S, and 6 to 7 days for A100 pods.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our product promise: capacity mobilised within 72 hours through a market call on the
              flagship configurations — to be compared with server purchase cycles (order, delivery,
              installation), which are significantly longer.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Sovereignty and GDPR: where do your GPUs run?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Every offer in our catalogue is hosted in the European Union — Frankfurt, Paris,
              Amsterdam, Warsaw, Madrid, Dublin, Stockholm — with data residency in the EU and GDPR
              compliance.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              One catalogue configuration is hosted in Paris. If your project requires 100% France
              hosting, we can source it via a market call, subject to partner-provider availability.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Certifications (SecNumCloud, HDS, ISO 27001…) belong to each provider: we do not claim
              them on their behalf, but make them a criterion to be verified contractually. To go
              further, see our page dedicated to{" "}
              <Link
                href="/en/gpu-as-a-service/sovereign-gpu-europe"
                className="text-accent hover:underline"
              >
                sovereign GPUs and GDPR compliance
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">How does DatacenterMarket work?</h2>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket is a matchmaking intermediary operated by Anavim Advisory SAS (Paris):
              we neither own nor run the GPUs, we organise competition between European providers.
              The journey comes down to four steps.
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
              <li>
                Describe your need: type of workload (training, fine-tuning, inference), number of
                GPUs, budget and constraints, via our online form.
              </li>
              <li>
                Compare up to three offers: our comparison engine surfaces the best value for money,
                the fastest to deploy and the cheapest offer.
              </li>
              <li>
                Order and pay online: secure payment via Stripe, on a monthly subscription.
              </li>
              <li>
                Track provisioning: the provider makes the infrastructure available; you follow
                progress from your client dashboard.
              </li>
            </ol>
            <p className="text-muted-foreground leading-relaxed">
              Ready to compare?{" "}
              <Link href="/workload" className="text-accent hover:underline">
                Describe your workload
              </Link>{" "}
              and receive up to three offers. For an overview of the service, you can also visit{" "}
              <Link href="/en" className="text-accent hover:underline">
                the DatacenterMarket home page
              </Link>
              .
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Frequently asked questions about GPU as a Service</h2>
            <div className="space-y-6">
              {GAAS_FAQ_EN.map(item => (
                <div key={item.question} className="space-y-2">
                  <h3 className="text-xl font-semibold">{item.question}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-border/50 pt-10 text-center space-y-6">
            <h2 className="text-3xl font-bold">Describe your need, the market answers</h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              A few minutes are enough to describe your workload and compare up to three offers from
              our partner providers.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Describe my GPU need
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
