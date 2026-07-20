import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { leadRef } from "@/lib/format";
import { JourneyStepper, MarketChrome } from "@/components/market";

const SIMULATION_LOGS = [
  { text: "Validation des critères transmis", duration: 1000 },
  { text: "Consultation du catalogue disponible", duration: 1200 },
  { text: "Filtrage des configurations GPU", duration: 1000 },
  { text: "Classement par prix et délai", duration: 1000 },
  { text: "Préparation des options disponibles", duration: 800 },
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
  const leadId = new URLSearchParams(window.location.search).get("leadId");

  useEffect(() => {
    let elapsed = 0;
    const timers: NodeJS.Timeout[] = [];

    SIMULATION_LOGS.forEach((log, index) => {
      elapsed += log.duration + 200;
      timers.push(
        setTimeout(() => {
          setTimestamps(prev => [...prev, timeNow()]);
          setCurrentLine(index + 1);
        }, elapsed),
      );
    });

    // Mark as complete and redirect, carrying the lead id forward.
    timers.push(
      setTimeout(() => {
        setIsComplete(true);
        setTimeout(() => {
          setLocation(leadId ? `/results?leadId=${leadId}` : "/results");
        }, 1500);
      }, elapsed + 400),
    );

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [setLocation, leadId]);

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
            {SIMULATION_LOGS.map((log, i) => {
              const done = i < currentLine;
              const running = i === currentLine && !isComplete;
              return (
                <div key={i} className="flex justify-between gap-4">
                  <span
                    className={
                      done ? "text-accent" : running ? "text-foreground" : "text-muted-foreground/60"
                    }
                  >
                    {done ? "✓" : running ? "→" : "○"} {log.text}
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
