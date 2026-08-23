import type { ReactNode } from "react";
import { fmtEUR } from "@/lib/format";
import { PanelLabel } from "@/components/market";

/**
 * Shared blocks for the offer / pre-payment screen (design 2c), used by both
 * /offer-detail and /checkout so the two routes share one visual language.
 */

export interface PurchasableOffer {
  id: number;
  name: string;
  category?: string | null;
  gpuType: string;
  gpuCount: number;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  location: string;
  monthlyPrice: string | number;
  setupFee: string | number | null;
  sla: string;
  deploymentTime: string;
  provider?: {
    name: string;
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  best_value: "MEILLEUR RAPPORT",
  fastest: "LE PLUS RAPIDE",
  cheapest: "LE PLUS ÉCONOMIQUE",
};

export function OfferHeader({
  offer,
  leadId,
}: {
  offer: PurchasableOffer;
  leadId?: number;
}) {
  const badge = offer.category ? CATEGORY_LABELS[offer.category] : undefined;
  return (
    <div className="mb-[30px] flex flex-col gap-3">
      {badge && (
        <div className="flex gap-2">
          <span className="rounded-md bg-accent/10 px-2.5 py-[5px] font-mono text-[10.5px] font-semibold tracking-[.1em] text-accent">
            {badge}
          </span>
        </div>
      )}
      <h1 className="m-0 text-[28px] font-extrabold uppercase leading-none tracking-[-0.035em] md:text-[40px]">
        {offer.name}
      </h1>
      <span className="font-mono text-[11.5px] uppercase tracking-[.08em] text-muted-foreground">
        {offer.location}
        {offer.provider?.name ? ` · FOURNISSEUR ${offer.provider.name}` : ""}
        {leadId != null ? ` · LEAD #${leadId}` : ""}
      </span>
    </div>
  );
}

function Cell({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 bg-background px-5 py-4">
      <span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-mono text-[16px] font-semibold ${accent ? "text-accent" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export function TechSummaryCard({ offer }: { offer: PurchasableOffer }) {
  return (
    <div className="rounded-xl border border-border bg-card p-[26px]">
      <PanelLabel className="mb-[18px]">Résumé technique</PanelLabel>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-border/60 bg-border/60 sm:grid-cols-2">
        <Cell
          label="CONFIGURATION GPU"
          value={`${offer.gpuCount}× ${offer.gpuType}`}
        />
        <Cell label="CPU" value={`${offer.cpuCores} cœurs`} />
        <Cell label="MÉMOIRE" value={`${offer.ramGb} Go RAM`} />
        <Cell label="STOCKAGE" value={`${offer.storageGb} Go NVMe`} />
      </div>
    </div>
  );
}

export function ServiceTermsCard({ offer }: { offer: PurchasableOffer }) {
  return (
    <div className="rounded-xl border border-border bg-card p-[26px]">
      <PanelLabel className="mb-[18px]">Conditions de service</PanelLabel>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-border/60 bg-border/60 sm:grid-cols-2">
        <Cell label="SLA GARANTI" value={offer.sla} />
        <Cell label="MISE EN SERVICE" value={offer.deploymentTime} accent />
      </div>
    </div>
  );
}

const TRANSPARENCY_ITEMS = [
  "Localisation affichée avant commande",
  "SLA propre à la configuration",
  "Prix et frais détaillés",
  "Paiement hébergé par Stripe",
];

export function ComplianceCard() {
  return (
    <div className="rounded-xl border border-accent/30 bg-card p-[26px]">
      <div className="mb-3.5 text-[15px] font-semibold">
        Contrat &amp; transparence
      </div>
      <div className="grid grid-cols-1 gap-2.5 text-[13.5px] sm:grid-cols-2">
        {TRANSPARENCY_ITEMS.map(item => (
          <div key={item} className="flex gap-[9px]">
            <span className="font-bold text-accent">✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PurchaseTransparencyCard({
  offer,
  requestedDuration,
}: {
  offer: PurchasableOffer;
  requestedDuration?: string;
}) {
  return (
    <section
      aria-labelledby="purchase-transparency-title"
      className="rounded-xl border border-chart-5/40 bg-chart-5/8 p-[26px]"
    >
      <h2
        id="purchase-transparency-title"
        className="mb-4 text-[15px] font-semibold"
      >
        Cadre de l'abonnement
      </h2>
      <dl className="grid gap-4 text-[13.5px] sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
            Plateforme
          </dt>
          <dd className="mt-1 font-semibold">
            DatacenterMarket — Anavim Advisory SAS
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
            Fournisseur sélectionné
          </dt>
          <dd className="mt-1 font-semibold">
            {offer.provider?.name ??
              "Non communiqué — ne poursuivez pas le paiement"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
            Périodicité
          </dt>
          <dd className="mt-1">
            Abonnement avec facturation mensuelle récurrente via Stripe.
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
            Durée demandée
          </dt>
          <dd className="mt-1">
            {requestedDuration
              ? `${requestedDuration} — donnée de cadrage à confirmer dans le contrat fournisseur.`
              : "Non récupérée dans ce navigateur — à confirmer avant paiement."}
          </dd>
        </div>
      </dl>
      <p
        id="purchase-terms-warning"
        className="mb-0 mt-4 text-[12.5px] leading-[1.6] text-muted-foreground"
      >
        Les CGU actuelles indiquent que le contrat est conclu directement avec
        le fournisseur. Elles ne précisent pas la durée minimale, le mécanisme
        de renouvellement, la procédure de résiliation ni les éventuels
        remboursements. Faites confirmer ces points par écrit avant de payer.
      </p>
    </section>
  );
}

const REASSURANCE = [
  "Prix HT affiché avant paiement",
  "Frais d'installation détaillés",
  "Facturation mensuelle récurrente via Stripe",
];

export function RecapSidebar({
  offer,
  cta,
  hint,
}: {
  offer: PurchasableOffer;
  cta: ReactNode;
  hint?: ReactNode;
}) {
  const monthly = Number(offer.monthlyPrice);
  const setup = Number(offer.setupFee);
  const total = monthly + setup;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-[26px] md:sticky md:top-8">
      <PanelLabel>Récapitulatif</PanelLabel>
      <div className="flex flex-col gap-[11px] border-b border-border pb-3.5">
        <div className="flex justify-between text-[13.5px]">
          <span className="text-muted-foreground">Abonnement mensuel HT</span>
          <span className="font-mono text-[13px] font-semibold">
            {fmtEUR(monthly)}
          </span>
        </div>
        <div className="flex justify-between text-[13.5px]">
          <span className="text-muted-foreground">Frais d'installation</span>
          <span className="font-mono text-[13px] font-semibold">
            {fmtEUR(setup)}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-[10px] border border-accent/35 bg-accent/8 px-[18px] py-[15px]">
        <span className="text-[12px] text-muted-foreground">
          Total premier mois
        </span>
        <span className="font-mono text-[28px] font-bold text-accent">
          {fmtEUR(total)}
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          puis {fmtEUR(monthly)}/mois HT
        </span>
      </div>
      <div className="flex flex-col gap-2 text-[13px]">
        {REASSURANCE.map(item => (
          <div key={item} className="flex gap-2">
            <span className="font-bold text-accent">✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
      {cta}
      {hint}
    </div>
  );
}

export function HelpCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-[26px] text-sm">
      <h4 className="mb-2 font-semibold">Besoin d'aide ?</h4>
      <p className="mb-0 text-muted-foreground">
        Un conseiller répond à vos questions sur cette infrastructure —
        contactez-nous avant de vous engager.
      </p>
    </div>
  );
}
