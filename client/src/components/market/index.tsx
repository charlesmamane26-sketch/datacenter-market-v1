import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared "place de marché" primitives (design handoff 7a/7b): chrome bar,
 * journey stepper, market-open chip, quote ticker, status pills, meter bars.
 * All data text is JetBrains Mono; lime (--accent) is the only saturated color.
 */

/** CSS-drawn logo: lime-bordered rounded square with a centered lime square. */
export function MarketLogo({ size = 20 }: { size?: number }) {
  const inner = size >= 22 ? 8 : 7;
  return (
    <div
      className="flex items-center justify-center rounded-[5px] border-[1.5px] border-accent"
      style={{ width: size, height: size }}
    >
      <div className="rounded-[2px] bg-accent" style={{ width: inner, height: inner }} />
    </div>
  );
}

export function MarketBrand({
  size = 20,
  onClick,
  className,
}: {
  size?: number;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2.5", onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      <MarketLogo size={size} />
      <span
        className="font-bold tracking-[-0.01em] text-foreground"
        style={{ fontSize: size >= 22 ? 16.5 : 15 }}
      >
        DatacenterMarket
      </span>
    </div>
  );
}

/** "MARCHÉ OUVERT" chip — bordered pill with a pulsing lime dot. */
export function MarketOpenChip({ bordered = true }: { bordered?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[.1em] text-accent",
        bordered && "rounded-full border border-accent/40 px-[13px] py-1.5",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-live-dot" />
      MARCHÉ OUVERT
    </span>
  );
}

const STEPS = ["DEMANDE", "RÉSULTATS", "OFFRE", "PAIEMENT"] as const;

/**
 * Journey stepper: 01 DEMANDE — 02 RÉSULTATS — 03 OFFRE — 04 PAIEMENT.
 * current: 1-based active step (pill). Done steps show a lime ✓ (label kept up
 * to step 2, compact "0n ✓" from step 3 on, as in the prototype). allDone marks
 * every step lime; failed renders step 4 in red with ✗; pulsing adds the live
 * dot inside the current pill (processing screen).
 */
export function JourneyStepper({
  current,
  allDone = false,
  failed = false,
  pulsing = false,
  className,
}: {
  current: number;
  allDone?: boolean;
  failed?: boolean;
  pulsing?: boolean;
  className?: string;
}) {
  const compactDone = current >= 3 || allDone || failed;
  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-3.5 font-mono text-[11px] tracking-[.1em]",
        className,
      )}
    >
      {STEPS.map((label, i) => {
        const n = i + 1;
        const num = `0${n}`;
        const isFailed = failed && n === 4;
        const isDone = allDone || (!isFailed && n < current);
        const isCurrent = !allDone && !isFailed && n === current;
        return (
          <span key={label} className="flex items-center gap-3.5">
            {i > 0 && <span className="text-border">—</span>}
            {isFailed ? (
              <span className="text-destructive">
                {num} {label} ✗
              </span>
            ) : isDone ? (
              <span className="text-accent">
                {compactDone && !(allDone && n === 4) ? `${num} ✓` : `${num} ${label} ✓`}
              </span>
            ) : isCurrent ? (
              <span className="inline-flex items-center gap-[7px] rounded-full border border-accent/50 px-[11px] py-1 text-foreground">
                {pulsing && (
                  <span className="h-[5px] w-[5px] rounded-full bg-accent animate-live-dot-fast" />
                )}
                {num} {label}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {num} {label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Chrome bar (56–64px, bottom border): brand on the left, an optional centered
 * slot (stepper) and a right slot (nav, account, status chip).
 */
export function MarketChrome({
  center,
  right,
  height = 56,
  onBrandClick,
  logoSize = 20,
}: {
  center?: ReactNode;
  right?: ReactNode;
  height?: number;
  onBrandClick?: () => void;
  logoSize?: number;
}) {
  return (
    <div className="border-b border-border/60">
      <div
        className="mx-auto flex max-w-[1240px] items-center justify-between px-5 md:px-10"
        style={{ height }}
      >
        <MarketBrand size={logoSize} onClick={onBrandClick} />
        {center}
        {right}
      </div>
    </div>
  );
}

export interface TickerQuote {
  site: string;
  config: string;
  price: string;
  /** e.g. { text: "▼ −4,2 %", tone: "accent" | "cyan" | "down" } or "· 24 h" plain suffix */
  delta?: { text: string; tone: "accent" | "cyan" | "down" };
  suffix?: string;
}

const DEFAULT_QUOTES: TickerQuote[] = [
  { site: "FRA", config: "H100 ×8", price: "18 400 €/mois", delta: { text: "▼ −4,2 %", tone: "accent" } },
  { site: "PAR", config: "H100 ×8", price: "22 000 €/mois", suffix: "· 24 h" },
  { site: "AMS", config: "H100 ×16", price: "34 000 €/mois", delta: { text: "▼ −2,1 %", tone: "cyan" } },
  { site: "VAR", config: "A100 ×8", price: "9 600 €/mois" },
  { site: "MAD", config: "A100 ×4", price: "5 200 €/mois", delta: { text: "▲ +1,8 %", tone: "down" } },
  { site: "DUB", config: "L40S ×8", price: "8 800 €/mois" },
  { site: "STO", config: "RTX 4090 ×8", price: "7 200 €/mois", suffix: "· 48 h" },
];

function TickerRun({ quotes }: { quotes: TickerQuote[] }) {
  const toneClass = { accent: "text-accent", cyan: "text-chart-2", down: "text-destructive" };
  return (
    <div className="flex items-center whitespace-nowrap py-[11px] font-mono text-[12.5px] tracking-[.03em]">
      {quotes.map((q, i) => (
        <span key={i} className="flex items-center">
          <span className="px-4 text-muted-foreground">
            {q.site} · {q.config} — <span className="text-foreground">{q.price}</span>
            {q.delta && <span className={cn("ml-1", toneClass[q.delta.tone])}>{q.delta.text}</span>}
            {q.suffix && <span> {q.suffix}</span>}
          </span>
          <span className="text-accent/50">◆</span>
        </span>
      ))}
    </div>
  );
}

/** Quote ticker band: darker sunken surface, content duplicated for a seamless loop. */
export function MarketTicker({ quotes = DEFAULT_QUOTES }: { quotes?: TickerQuote[] }) {
  return (
    <div className="overflow-hidden border-y border-border/60 bg-surface-sunken">
      <div className="flex w-max animate-ticker">
        <TickerRun quotes={quotes} />
        <TickerRun quotes={quotes} />
      </div>
    </div>
  );
}

export type StatusTone = "lime" | "cyan" | "amber" | "violet" | "red" | "muted";

const STATUS_DOT: Record<StatusTone, string> = {
  lime: "bg-accent",
  cyan: "bg-chart-2",
  amber: "bg-chart-5",
  violet: "bg-chart-3",
  red: "bg-destructive",
  muted: "bg-muted-foreground",
};

const STATUS_TEXT: Record<StatusTone, string> = {
  lime: "text-accent",
  cyan: "text-chart-2",
  amber: "text-chart-5",
  violet: "text-chart-3",
  red: "text-destructive",
  muted: "text-muted-foreground",
};

/** Status pill: 6px dot + mono uppercase label (lime=active, cyan=provisioning…). */
export function StatusPill({
  tone,
  label,
  pulse = false,
}: {
  tone: StatusTone;
  label: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] font-mono text-[10.5px] font-semibold tracking-[.08em] uppercase",
        STATUS_TEXT[tone],
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[tone], pulse && "animate-live-dot-fast")}
      />
      {label}
    </span>
  );
}

/** Thin progress/capacity bar: 4–8px track on --input, rounded colored fill. */
export function MeterBar({
  value,
  tone = "lime",
  height = 5,
  className,
}: {
  value: number;
  tone?: StatusTone;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-input", className)}
      style={{ height }}
    >
      <div
        className={cn("h-full rounded-full", STATUS_DOT[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Mono uppercase section label (panel headers) in lime. */
export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] font-medium uppercase tracking-[.14em] text-accent",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Page title: uppercase display ended by a lime period. */
export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "text-[32px] md:text-[44px] font-extrabold uppercase leading-none tracking-[-0.035em]",
        className,
      )}
    >
      {children}
      <span className="text-accent">.</span>
    </h1>
  );
}
