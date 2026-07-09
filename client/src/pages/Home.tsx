import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { clearCheckoutIntent, loadCheckoutIntent } from "@/lib/checkoutIntent";
import { MarketBrand, MarketOpenChip, MarketTicker, MeterBar } from "@/components/market";

// 30-day price history (hero cotation): 24 bars, the last 3 in growing lime.
const HISTORY_BARS = [
  78, 74, 80, 71, 69, 73, 66, 68, 62, 64, 59, 61, 57, 60, 54, 56, 52, 55, 50, 48, 51, 46, 44, 47,
];

const REGIONS = [
  { code: "FRA — Francfort", load: 82, note: "8× H100 · dès 18 400 €/mois" },
  { code: "PAR — Paris", load: 64, note: "8× H100 · provision 24 h" },
  { code: "AMS — Amsterdam", load: 71, note: "16× H100 · InfiniBand 400 Gb/s" },
  { code: "VAR — Varsovie", load: 90, note: "8× A100 · dès 9 600 €/mois" },
];

const HOW_IT_WORKS = [
  { num: "01", title: "Décrivez", text: "GPU, région, budget, durée : votre workload en 2 minutes." },
  { num: "02", title: "Comparez", text: "3 offres fermes et vérifiées, chiffrées côte à côte." },
  { num: "03", title: "Provisionnez", text: "Contrat, paiement sécurisé et mise en service en 72 h." },
];

const MARKET_ACTIVITY = [
  { when: "IL Y A 2 H", config: "8× H100 · Francfort, DE", price: "18 400 €/mois", tag: "PROVISIONNÉ EN 71 H" },
  { when: "IL Y A 9 H", config: "16× H100 · Amsterdam, NL", price: "34 000 €/mois", tag: "PROVISIONNÉ EN 94 H" },
  { when: "HIER", config: "8× L40S · Dublin, IE", price: "8 800 €/mois", tag: "PROVISIONNÉ EN 70 H" },
];

function utcNow(): string {
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const clock = utcNow();

  // Resume a checkout interrupted by login: OAuth returns the user to "/", so we
  // forward them back to the checkout they started (consuming the intent once).
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const intent = loadCheckoutIntent();
    if (!intent) return;
    clearCheckoutIntent();
    setLocation(`/checkout?offerId=${intent.offerId}&leadId=${intent.leadId}`);
  }, [loading, isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Chrome */}
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 md:px-10">
        <MarketBrand size={22} />
        <div className="hidden md:flex items-center gap-[26px]">
          <a href="#comment" className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
            Catalogue
          </a>
          <a href="#activite" className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
            Tarifs
          </a>
          <button
            onClick={() => setLocation("/dashboard")}
            className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Mon compte
          </button>
          <span className="font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">{clock} UTC</span>
          <MarketOpenChip />
        </div>
        {/* Mobile: 48×48 burger target */}
        <button
          className="flex h-12 w-12 items-center justify-center md:hidden"
          aria-label="Menu"
          onClick={() => setMenuOpen(v => !v)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {menuOpen && (
        <div className="flex flex-col border-b border-border/60 px-5 pb-4 md:hidden">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex min-h-12 items-center text-[14px] text-muted-foreground"
          >
            Mon compte
          </button>
          <div className="py-2">
            <MarketOpenChip />
          </div>
        </div>
      )}

      <MarketTicker />

      {/* Hero — cotation */}
      <div className="relative mx-auto max-w-[1240px] overflow-hidden px-5 pb-11 pt-10 md:px-10 md:pt-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 50% 45%,transparent 25%,var(--background) 80%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 45% 55% at 25% 45%,color-mix(in oklch, var(--accent) 8%, transparent),transparent 70%)",
          }}
        />

        <div className="relative grid items-end gap-10 md:grid-cols-2 md:gap-14">
          <div className="flex flex-col gap-[18px]">
            <span className="font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
              Cotation — 8× NVIDIA H100 · moyenne UE
            </span>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[56px] font-bold leading-none tracking-[-0.04em] md:text-[84px]">
                18 400 €
              </span>
              <span className="text-[17px] text-muted-foreground">/mois</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-mono text-[12px] tracking-[.06em]">
              <span className="inline-flex items-center gap-[7px] rounded-md bg-accent/10 px-[11px] py-[5px] font-semibold text-accent">
                ▼ −4,2 % SUR 30 JOURS
              </span>
              <span className="text-muted-foreground">MAJ {clock} UTC · 47 DATACENTERS</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex h-[120px] items-end gap-[3px]">
              {HISTORY_BARS.map((h, i) => {
                const fromEnd = HISTORY_BARS.length - 1 - i;
                const isLast = fromEnd === 0;
                const bg =
                  fromEnd === 0
                    ? "var(--accent)"
                    : fromEnd === 1
                      ? "color-mix(in oklch, var(--accent) 65%, transparent)"
                      : fromEnd === 2
                        ? "color-mix(in oklch, var(--accent) 35%, transparent)"
                        : "var(--border)";
                return (
                  <div
                    key={i}
                    className="animate-grow-bar flex-1 rounded-t-[2px]"
                    style={{
                      height: `${h}%`,
                      background: bg,
                      animationDelay: `${(i + 1) * 20}ms`,
                      boxShadow: isLast
                        ? "0 0 16px color-mix(in oklch, var(--accent) 50%, transparent)"
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between border-t border-border/70 pt-2 font-mono text-[10px] tracking-[.1em] text-muted-foreground">
              <span>IL Y A 30 JOURS</span>
              <span className="text-accent">AUJOURD'HUI — 18 400 €</span>
            </div>
          </div>
        </div>

        <div className="relative mt-12 grid items-end gap-6 md:grid-cols-[1.45fr_0.55fr] md:gap-12">
          <div>
            <div className="text-[42px] font-extrabold uppercase leading-none tracking-[-0.04em] md:text-[68px]">
              Achetez la capacité
            </div>
            <div className="text-[42px] font-extrabold uppercase leading-[1.08] tracking-[-0.04em] text-accent md:text-[68px]">
              au bon moment.
            </div>
          </div>
          <p className="m-0 pb-1.5 text-[14.5px] leading-[1.65] text-muted-foreground [text-wrap:pretty]">
            Les prix bougent chaque semaine. Décrivez votre workload, verrouillez une offre ferme
            72 h — au cours du jour.
          </p>
        </div>
      </div>

      {/* CTA bar */}
      <div className="mx-auto max-w-[1240px] px-5 md:px-10">
        <button
          onClick={() => setLocation("/workload")}
          className="glow-accent flex w-full flex-col items-center justify-between gap-2 rounded-xl bg-accent px-[30px] py-[22px] text-accent-foreground transition-transform active:scale-[0.99] md:flex-row md:gap-0"
        >
          <span className="text-[18px] font-bold tracking-[-0.01em] md:text-[20px]">
            Demander de la capacité →
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-[.1em] md:text-[12.5px]">
            DEVIS EN ~2 MIN · PROVISION EN 72 H
          </span>
        </button>
      </div>

      {/* Region capacity tiles */}
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-3 px-5 pb-13 pt-9 md:grid-cols-4 md:gap-[22px] md:px-10">
        {REGIONS.map(r => (
          <div
            key={r.code}
            className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 md:p-5"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[12.5px] font-semibold tracking-[.06em]">{r.code}</span>
              <span className="font-mono text-[12px] text-accent">{r.load} %</span>
            </div>
            <MeterBar value={r.load} />
            <span className="text-[12.5px] text-muted-foreground">{r.note}</span>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div id="comment" className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 py-13 md:px-10">
          <div className="mb-[26px] font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
            Comment ça marche
          </div>
          <div className="grid gap-[22px] md:grid-cols-3">
            {HOW_IT_WORKS.map(s => (
              <div
                key={s.num}
                className="flex min-h-12 flex-col gap-2.5 rounded-[10px] border border-border p-6 transition-colors hover:border-accent/50"
              >
                <span className="font-mono text-[26px] font-bold text-accent">{s.num}</span>
                <span className="text-[16px] font-semibold uppercase tracking-[.02em]">{s.title}</span>
                <span className="text-[13.5px] leading-[1.6] text-muted-foreground">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Market activity */}
      <div id="activite" className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 pb-14 pt-13 md:px-10">
          <div className="mb-6 flex items-baseline justify-between">
            <div className="font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
              Activité du marché
            </div>
            <span className="font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">
              500+ DEMANDES TRAITÉES
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            {MARKET_ACTIVITY.map((row, i) => (
              <div
                key={row.when}
                className={`grid items-center gap-2 px-4 py-4 transition-colors hover:bg-card/50 md:grid-cols-[0.9fr_1.6fr_1fr_1.2fr] md:gap-4 md:px-[22px] ${
                  i < MARKET_ACTIVITY.length - 1 ? "border-b border-border/70" : ""
                }`}
              >
                <span className="font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">
                  {row.when}
                </span>
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

      {/* Footer */}
      <footer className="border-t border-border/50 bg-surface-sunken">
        <div className="mx-auto max-w-[1240px] px-5 pb-[34px] pt-11 md:px-10">
          <div className="mb-9 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="flex flex-col gap-3">
              <MarketBrand size={20} />
              <span className="text-[12.5px] leading-[1.6] text-muted-foreground">
                Un service d'Anavim Advisory SAS
                <br />
                10 Rue du Colisée, 75008 Paris, France
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[10.5px] font-semibold tracking-[.12em] text-muted-foreground">
                PRODUIT
              </span>
              <a href="#comment" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                Catalogue
              </a>
              <a href="#activite" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                Tarifs
              </a>
              <a href="#comment" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                FAQ
              </a>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[10.5px] font-semibold tracking-[.12em] text-muted-foreground">
                SOCIÉTÉ
              </span>
              <a
                href="https://www.anavimadvisory.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                À propos
              </a>
              <a
                href="https://www.anavimadvisory.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Contact
              </a>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[10.5px] font-semibold tracking-[.12em] text-muted-foreground">
                LÉGAL
              </span>
              <a href="/privacy" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                Confidentialité
              </a>
              <a href="/terms" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                CGV
              </a>
              <a href="/legal" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                Mentions légales
              </a>
            </div>
          </div>
          <div className="flex flex-col items-start justify-between gap-3 border-t border-border/50 pt-[22px] text-[12px] text-muted-foreground md:flex-row md:items-center">
            <span>© 2026 DatacenterMarket. Tous droits réservés.</span>
            <a
              href="https://www.anavimadvisory.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent transition-colors hover:text-accent/80"
            >
              En savoir plus sur Anavim Advisory →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
