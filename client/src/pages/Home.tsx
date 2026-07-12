import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { clearCheckoutIntent, loadCheckoutIntent } from "@/lib/checkoutIntent";
import { MarketBrand, MarketOpenChip, MarketTicker, type TickerQuote } from "@/components/market";

/**
 * Home fusionnée : design « place de marché » (handoff 7a/7b) + exigences SEO
 * du lot 3 — H1/h2 sémantiques, contenu indexable français, maillage vers la
 * page pilier et les satellites, SSR-safe pour le prérendu (scripts/prerender.ts).
 * Véracité : toutes les données chiffrées affichées dérivent du catalogue réel
 * (server/seed.ts) — pas de variations de prix, de taux de charge ni de volumes
 * d'activité inventés.
 */

// Cotations réelles du catalogue (prix mensuels + délais de déploiement du seed).
const TICKER_QUOTES: TickerQuote[] = [
  { site: "FRA", config: "H100 ×8", price: "18 400 €/mois", suffix: "· 72 h" },
  { site: "PAR", config: "H100 ×8", price: "22 000 €/mois", suffix: "· 24 h" },
  { site: "AMS", config: "H100 ×16", price: "34 000 €/mois", suffix: "· 96 h" },
  { site: "VAR", config: "A100 ×8", price: "9 600 €/mois", suffix: "· 6-7 j" },
  { site: "MAD", config: "A100 ×4", price: "5 200 €/mois", suffix: "· 7 j" },
  { site: "DUB", config: "L40S ×8", price: "8 800 €/mois", suffix: "· 72 h" },
  { site: "STO", config: "RTX 4090 ×8", price: "7 200 €/mois", suffix: "· 48 h" },
];

// Barres décoratives du héro (aria-hidden) — aucune série temporelle réelle.
const HISTORY_BARS = [
  78, 74, 80, 71, 69, 73, 66, 68, 62, 64, 59, 61, 57, 60, 54, 56, 52, 55, 50, 48, 51, 46, 44, 47,
];

// Sites du catalogue : SLA et délais réels par configuration (server/seed.ts).
const REGIONS = [
  { code: "FRA — Francfort", note: "8× H100 · dès 18 400 €/mois", meta: "SLA 99,9 % · 72 H" },
  { code: "PAR — Paris", note: "8× H100 · provision 24 h", meta: "SLA 99,99 % · 24 H" },
  { code: "AMS — Amsterdam", note: "16× H100 · InfiniBand 400 Gb/s", meta: "SLA 99,9 % · 96 H" },
  { code: "VAR — Varsovie", note: "8× A100 · dès 9 600 €/mois", meta: "SLA 99,5 % · 6-7 J" },
];

const HOW_IT_WORKS = [
  { num: "01", title: "Décrivez", text: "GPU, région, budget, durée : votre workload en 2 minutes." },
  {
    num: "02",
    title: "Comparez",
    text: "Jusqu'à 3 offres chiffrées côte à côte : meilleur rapport qualité/prix, plus rapide, moins chère.",
  },
  { num: "03", title: "Provisionnez", text: "Contrat, paiement sécurisé et mise en service en 72 h." },
];

// Extraits réels du catalogue (prix et délais de déploiement du seed).
const CATALOGUE_EXTRACT = [
  { family: "H100", config: "8× H100 · Francfort, DE", price: "18 400 €/mois", tag: "DÉPLOIEMENT 72 H" },
  { family: "H100", config: "16× H100 · Amsterdam, NL", price: "34 000 €/mois", tag: "DÉPLOIEMENT 96 H" },
  { family: "L40S", config: "8× L40S · Dublin, IE", price: "8 800 €/mois", tag: "DÉPLOIEMENT 72 H" },
];

function utcNow(): string {
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Resume a checkout interrupted by login: OAuth returns the user to "/", so we
// forward them back to the checkout they started (consuming the intent once).
// Kept in a client-only child because useAuth touches localStorage during render,
// which would crash the build-time prerender (see scripts/prerender.ts).
function CheckoutResume() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const intent = loadCheckoutIntent();
    if (!intent) return;
    clearCheckoutIntent();
    setLocation(`/checkout?offerId=${intent.offerId}&leadId=${intent.leadId}`);
  }, [loading, isAuthenticated, setLocation]);

  return null;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const clock = utcNow();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mounted && <CheckoutResume />}

      {/* Chrome */}
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 md:px-10">
        <MarketBrand size={22} />
        <div className="hidden md:flex items-center gap-[26px]">
          <a href="#comment" className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
            Comment ça marche
          </a>
          <a href="#activite" className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
            Catalogue
          </a>
          <Link
            href="/gpu-as-a-service/"
            className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Guide GPU as a Service
          </Link>
          <button
            onClick={() => setLocation("/dashboard")}
            className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Mon compte
          </button>
          <Link
            href="/en"
            hrefLang="en"
            className="rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-[.06em] text-muted-foreground transition-colors hover:text-foreground"
          >
            EN
          </Link>
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
          <Link
            href="/gpu-as-a-service/"
            className="flex min-h-12 items-center text-[14px] text-muted-foreground"
          >
            Guide GPU as a Service
          </Link>
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

      <MarketTicker quotes={TICKER_QUOTES} />

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
              Cotation — 8× NVIDIA H100 · Francfort
            </span>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[56px] font-bold leading-none tracking-[-0.04em] md:text-[84px]">
                18 400 €
              </span>
              <span className="text-[17px] text-muted-foreground">/mois</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-mono text-[12px] tracking-[.06em]">
              <span className="inline-flex items-center gap-[7px] rounded-md bg-accent/10 px-[11px] py-[5px] font-semibold text-accent">
                CATALOGUE INDICATIF — SELON CONFIGURATION
              </span>
              <span className="text-muted-foreground">7 PLACES EUROPÉENNES · RÉSIDENCE UE</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5" aria-hidden="true">
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
              <span>ÉQUIVALENT ≈ 3,15 €/GPU/H (730 H/MOIS)</span>
              <span className="text-accent">8× H100 — 18 400 €/MOIS</span>
            </div>
          </div>
        </div>

        <div className="relative mt-12 grid items-end gap-6 md:grid-cols-[1.45fr_0.55fr] md:gap-12">
          <h1 className="m-0">
            <span className="block text-[42px] font-extrabold uppercase leading-none tracking-[-0.04em] md:text-[68px]">
              GPU as a Service :
            </span>
            <span className="block text-[42px] font-extrabold uppercase leading-[1.08] tracking-[-0.04em] text-accent md:text-[68px]">
              la capacité au bon moment.
            </span>
          </h1>
          <p className="m-0 pb-1.5 text-[14.5px] leading-[1.65] text-muted-foreground [text-wrap:pretty]">
            DatacenterMarket est une place de marché : nous ne possédons pas les GPU, nous mettons
            en concurrence des fournisseurs européens. Décrivez votre workload, comparez jusqu'à
            trois offres — capacité mobilisée en 72 h par appel au marché.
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
            <span className="font-mono text-[12.5px] font-semibold tracking-[.06em]">{r.code}</span>
            <span className="font-mono text-[11px] tracking-[.08em] text-accent">{r.meta}</span>
            <span className="text-[12.5px] text-muted-foreground">{r.note}</span>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div id="comment" className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 py-13 md:px-10">
          <h2 className="mb-[26px] font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
            Comment ça marche
          </h2>
          <div className="grid gap-[22px] md:grid-cols-3">
            {HOW_IT_WORKS.map(s => (
              <div
                key={s.num}
                className="flex min-h-12 flex-col gap-2.5 rounded-[10px] border border-border p-6 transition-colors hover:border-accent/50"
              >
                <span className="font-mono text-[26px] font-bold text-accent">{s.num}</span>
                <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">{s.title}</h3>
                <span className="text-[13.5px] leading-[1.6] text-muted-foreground">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Extraits du catalogue */}
      <div id="activite" className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 pb-14 pt-13 md:px-10">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
              Extraits du catalogue
            </h2>
            <span className="font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">
              INDICATIF — ÉVOLUTIF
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            {CATALOGUE_EXTRACT.map((row, i) => (
              <div
                key={row.config}
                className={`grid items-center gap-2 px-4 py-4 transition-colors hover:bg-card/50 md:grid-cols-[0.9fr_1.6fr_1fr_1.2fr] md:gap-4 md:px-[22px] ${
                  i < CATALOGUE_EXTRACT.length - 1 ? "border-b border-border/70" : ""
                }`}
              >
                <span className="font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">
                  {row.family}
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

      {/* Repères SEO : gammes, tarifs, souveraineté */}
      <div className="border-t border-border/50">
        <div className="mx-auto max-w-[1240px] px-5 pb-14 pt-13 md:px-10">
          <h2 className="mb-[26px] font-mono text-[11.5px] font-medium uppercase tracking-[.14em] text-accent">
            Location GPU : gammes, tarifs, souveraineté
          </h2>
          <div className="grid gap-[22px] md:grid-cols-3">
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-border p-6">
              <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">Gammes GPU</h3>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                H100 et A100 80 Go, L40S 48 Go (inférence), RTX 4090 24 Go (R&D) en configurations
                dédiées de 4 à 16 GPU. H200 et B200 mobilisables via l'appel au marché, selon
                disponibilité des fournisseurs.{" "}
                <Link href="/gpu-as-a-service/" className="text-accent hover:underline">
                  Lire le guide GPU as a Service
                </Link>
              </p>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-border p-6">
              <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">Tarifs indicatifs</h3>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                De ≈ 1,2 €/GPU/h (RTX 4090) à ≈ 2,9–3,8 €/GPU/h (H100) en équivalent horaire dérivé
                des prix mensuels du catalogue — jamais des prix garantis.{" "}
                <Link href="/gpu-as-a-service/prix-location-gpu/" className="text-accent hover:underline">
                  Voir la grille des prix de location GPU
                </Link>
              </p>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-border p-6">
              <h3 className="text-[16px] font-semibold uppercase tracking-[.02em]">Souveraineté &amp; RGPD</h3>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-foreground">
                Catalogue 100 % hébergé dans l'UE, dont une configuration à Paris ; hébergement
                100 % France recherché via l'appel au marché.{" "}
                <Link href="/gpu-as-a-service/gpu-souverain-france/" className="text-accent hover:underline">
                  Découvrir le GPU souverain en France
                </Link>
              </p>
            </div>
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
                GPU AS A SERVICE
              </span>
              <a href="/gpu-as-a-service/" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                Le guide de la location GPU
              </a>
              <a href="/gpu-as-a-service/prix-location-gpu/" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                Prix de location d'un GPU
              </a>
              <a href="/gpu-as-a-service/gpu-souverain-france/" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                GPU souverain en France
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
                CGU
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
