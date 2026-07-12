import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MarketBrand } from "@/components/market";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { setLangPref } from "@/lib/langPref";
import { GAAS_FAQ_EN } from "@shared/seo-content";

/**
 * English landing (/en) — international SEO entry point, hreflang-linked to the
 * French home (/). SSR-safe (prerendered): no window/localStorage during render.
 * Copy is written natively in English; figures derive from the real catalogue
 * (server/seed.ts), consistent with the French pages.
 */

const REGIONS = [
  { code: "FRA — Frankfurt", note: "8× H100 · from €18,400/mo", meta: "SLA 99.9% · 72 H" },
  { code: "PAR — Paris", note: "8× H100 · 24 h provisioning", meta: "SLA 99.99% · 24 H" },
  { code: "AMS — Amsterdam", note: "16× H100 · InfiniBand 400 Gb/s", meta: "SLA 99.9% · 96 H" },
  { code: "WAW — Warsaw", note: "8× A100 · from €9,600/mo", meta: "SLA 99.5% · 6-7 D" },
];

const HOW_IT_WORKS = [
  { num: "01", title: "Describe", text: "GPU, region, budget, duration — your workload in 2 minutes." },
  { num: "02", title: "Compare", text: "Up to 3 priced quotes side by side: best value, fastest, cheapest." },
  { num: "03", title: "Provision", text: "Contract, secure payment and go-live within 72 h." },
];

const CATALOGUE = [
  { family: "H100", config: "8× H100 · Frankfurt, DE", price: "€18,400/mo", tag: "DEPLOY 72 H" },
  { family: "H100", config: "16× H100 · Amsterdam, NL", price: "€34,000/mo", tag: "DEPLOY 96 H" },
  { family: "L40S", config: "8× L40S · Dublin, IE", price: "€8,800/mo", tag: "DEPLOY 72 H" },
];

export default function LandingEn() {
  const [, setLocation] = useLocation();
  useEffect(() => setLangPref("en"), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Chrome */}
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 md:px-10">
        <MarketBrand size={22} />
        <div className="flex items-center gap-[22px]">
          <Link href="/en/gpu-as-a-service" className="hidden text-[13.5px] text-muted-foreground transition-colors hover:text-foreground md:block">
            GPU as a Service guide
          </Link>
          <a href="#catalogue" className="hidden text-[13.5px] text-muted-foreground transition-colors hover:text-foreground md:block">
            Catalogue
          </a>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-[1240px] px-5 pb-11 pt-10 md:px-10 md:pt-16">
        <span className="font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
          European GPU marketplace · EU-hosted · GDPR
        </span>
        <h1 className="m-0 mt-4">
          <span className="block text-[42px] font-extrabold uppercase leading-none tracking-[-0.04em] md:text-[64px]">
            GPU as a Service in Europe:
          </span>
          <span className="block text-[42px] font-extrabold uppercase leading-[1.08] tracking-[-0.04em] text-accent md:text-[64px]">
            capacity when you need it.
          </span>
        </h1>
        <p className="m-0 mt-5 max-w-[680px] text-[15.5px] leading-[1.65] text-muted-foreground [text-wrap:pretty]">
          DatacenterMarket is a marketplace: we don't own the GPUs — we put European providers in
          competition on your workload. Describe your need, compare up to three quotes, and get
          dedicated H100/A100 capacity mobilised within 72 hours across EU datacenters.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setLocation("/workload")}
            className="glow-accent inline-flex items-center justify-center rounded-[10px] bg-accent px-6 py-[15px] text-[15px] font-bold text-accent-foreground transition-transform active:scale-[0.98]"
          >
            Request capacity →
          </button>
          <a
            href="#catalogue"
            className="inline-flex items-center justify-center rounded-[10px] border border-border px-6 py-[15px] text-[15px] font-semibold text-foreground transition-colors hover:bg-input"
          >
            See the catalogue
          </a>
        </div>
      </div>

      {/* Regions */}
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-3 px-5 pb-12 pt-4 md:grid-cols-4 md:gap-[22px] md:px-10">
        {REGIONS.map(r => (
          <div key={r.code} className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 md:p-5">
            <span className="font-mono text-[12.5px] font-semibold tracking-[.06em]">{r.code}</span>
            <span className="font-mono text-[11px] tracking-[.08em] text-accent">{r.meta}</span>
            <span className="text-[12.5px] text-muted-foreground">{r.note}</span>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div id="how" className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 py-13 md:px-10">
          <h2 className="mb-[26px] font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
            How it works
          </h2>
          <div className="grid gap-[22px] md:grid-cols-3">
            {HOW_IT_WORKS.map(s => (
              <div key={s.num} className="flex flex-col gap-2.5 rounded-[10px] border border-border p-6 transition-colors hover:border-accent/50">
                <span className="font-mono text-[26px] font-bold text-accent">{s.num}</span>
                <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">{s.title}</h3>
                <span className="text-[13.5px] leading-[1.6] text-muted-foreground">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Catalogue */}
      <div id="catalogue" className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 pb-14 pt-13 md:px-10">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
              Catalogue highlights
            </h2>
            <span className="font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">INDICATIVE · EVOLVING</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            {CATALOGUE.map((row, i) => (
              <div
                key={row.config}
                className={`grid items-center gap-2 px-4 py-4 transition-colors hover:bg-card/50 md:grid-cols-[0.9fr_1.6fr_1fr_1.2fr] md:gap-4 md:px-[22px] ${
                  i < CATALOGUE.length - 1 ? "border-b border-border/70" : ""
                }`}
              >
                <span className="font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">{row.family}</span>
                <span className="text-[14px] font-semibold">{row.config}</span>
                <span className="font-mono text-[13px] text-foreground">{row.price}</span>
                <span className="justify-self-start rounded-[5px] bg-accent/10 px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-[.08em] text-accent md:justify-self-end">
                  {row.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sovereignty */}
      <div className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 pb-14 pt-13 md:px-10">
          <h2 className="mb-[26px] font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
            EU sovereignty &amp; GDPR
          </h2>
          <div className="grid gap-[22px] md:grid-cols-3">
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-border p-6">
              <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">EU-hosted</h3>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                Every catalogue offer is hosted in the European Union — including a Paris
                configuration — so your data and compute stay under EU jurisdiction.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-border p-6">
              <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">GDPR by design</h3>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                Providers are vetted for GDPR compliance. Sovereign, single-country hosting can be
                sourced via a market call, subject to partner availability.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-border p-6">
              <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">GPU range</h3>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                H100 and A100 80 GB, L40S 48 GB (inference), RTX 4090 24 GB (R&amp;D), in dedicated
                4-to-16 GPU configurations. H200/B200 sourced on request.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-border/50">
        <div className="mx-auto max-w-[900px] px-5 pb-16 pt-13 md:px-10">
          <h2 className="mb-6 font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
            Frequently asked questions
          </h2>
          <div className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-xl border border-border">
            {GAAS_FAQ_EN.map(item => (
              <div key={item.question} className="flex flex-col gap-2 p-5">
                <h3 className="text-[15px] font-semibold">{item.question}</h3>
                <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-surface-sunken">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-3 px-5 py-8 text-[12px] text-muted-foreground md:flex-row md:items-center md:px-10">
          <span>© 2026 DatacenterMarket — a service by Anavim Advisory SAS, Paris, France.</span>
          <div className="flex gap-5">
            <Link href="/" className="text-accent transition-colors hover:text-accent/80">
              Version française
            </Link>
            <a href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
