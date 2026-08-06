import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { leadRef } from "@/lib/format";
import { loadLeadClaim } from "@/lib/leadClaim";
import { trpc } from "@/lib/trpc";
import { JourneyStepper, MarketChrome } from "@/components/market";

const SIMULATION_LOGS = [
  "Validation des critères transmis",
  "Consultation du catalogue disponible",
  "Filtrage des configurations GPU",
  "Classement par prix et délai",
  "Préparation des options disponibles",
];

function timeNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function ProcessingScreen() {
  const [, setLocation] = useLocation();
  // Index of the line currently "running"; lines before it are done.
  const [currentLine, setCurrentLine] = useState(0);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const utils = trpc.useUtils();
  const rawLeadId = new URLSearchParams(window.location.search).get("leadId");
  const parsedLeadId = rawLeadId == null ? Number.NaN : Number(rawLeadId);
  const leadId =
    Number.isInteger(parsedLeadId) && parsedLeadId > 0
      ? parsedLeadId
      : undefined;

  useEffect(() => {
    let active = true;
    setCurrentLine(1);

    // Start the real matching request immediately and warm the Results query
    // cache. The console is progress feedback for actual work, never a fixed
    // artificial delay before the request begins.
    void utils.offers.match
      .fetch(
        leadId != null
          ? { leadId, claimToken: loadLeadClaim(leadId) ?? undefined }
          : {}
      )
      .then(() => {
        if (!active) return;
        const completedAt = timeNow();
        setTimestamps(SIMULATION_LOGS.map(() => completedAt));
        setCurrentLine(SIMULATION_LOGS.length);
        setIsComplete(true);
        setLocation(leadId ? `/results?leadId=${leadId}` : "/results");
      })
      .catch(() => {
        if (!active) return;
        // ResultsScreen owns the actionable error/retry UI.
        setLocation(leadId ? `/results?leadId=${leadId}` : "/results");
      });

    return () => {
      active = false;
    };
  }, [leadId, setLocation, utils]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        center={<JourneyStepper current={2} pulsing />}
        right={
          <span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground">
            {leadId ? leadRef(Number(leadId)) : "MATCHING"}
          </span>
        }
      />

      <div className="flex flex-col items-center gap-[26px] px-5 py-14 md:px-10 md:py-20">
        {/* Spinner: 46px ring, lime quarter */}
        <div
          className="h-[46px] w-[46px] animate-spin rounded-full border-[3px] border-border"
          style={{ borderTopColor: "var(--accent)", animationDuration: "0.9s" }}
        />

        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1 className="m-0 text-[30px] font-extrabold uppercase leading-none tracking-[-0.035em] md:text-[38px]">
            {isComplete ? "Offres prêtes" : "Analyse en cours"}
            <span className="text-accent">.</span>
          </h1>
          <p className="m-0 max-w-[540px] text-[15px] text-muted-foreground">
            {isComplete
              ? "Vos options disponibles vous attendent — redirection…"
              : "Notre moteur classe les configurations disponibles selon vos critères, leur prix et leur délai."}
          </p>
        </div>

        {/* Matching console */}
        <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-accent/30 bg-surface-sunken shadow-[0_24px_60px_rgba(0,0,0,.5)]">
          <div className="flex items-center gap-2 border-b border-border/70 px-[18px] py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="ml-2.5 font-mono text-[11.5px] tracking-[.08em] text-muted-foreground">
              dcm · matching{leadId ? ` — lead #${leadId}` : ""}
            </span>
          </div>
          <div className="flex flex-col px-[22px] py-5 font-mono text-[13px] leading-[2]">
            {SIMULATION_LOGS.map((text, i) => {
              const done = i < currentLine;
              const running = i === currentLine && !isComplete;
              return (
                <div key={i} className="flex justify-between gap-4">
                  <span
                    className={
                      done ? "text-accent" : running ? "text-foreground" : "text-muted-foreground/60"
                    }
                  >
                    {done ? "✓" : running ? "→" : "○"} {text}
                    {running && (
                      <span className="ml-1 inline-block h-4 w-2 translate-y-[3px] bg-accent animate-cursor-blink" />
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {done ? timestamps[i] : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground">
          {isComplete
            ? "REDIRECTION VERS VOS OPTIONS…"
            : `MATCHING ${Math.min(currentLine, SIMULATION_LOGS.length)}/${SIMULATION_LOGS.length}`}
        </span>
      </div>
    </div>
  );
}
