import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";

interface LogEntry {
  id: string;
  text: string;
  timestamp: string;
  status: "pending" | "completed" | "processing";
}

const SIMULATION_LOGS = [
  { text: "Validating workload specifications...", duration: 1000 },
  { text: "Scanning 500+ GPU providers in EU...", duration: 1500 },
  { text: "Matching infrastructure requirements...", duration: 1200 },
  { text: "Generating compliance reports...", duration: 1000 },
  { text: "Calculating optimal configurations...", duration: 1500 },
  { text: "Preparing 3 best offers...", duration: 800 },
];

export default function ProcessingScreen() {
  const [, setLocation] = useLocation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const leadId = new URLSearchParams(window.location.search).get("leadId");

  useEffect(() => {
    let currentTime = 0;
    const logTimers: NodeJS.Timeout[] = [];

    SIMULATION_LOGS.forEach((log, index) => {
      // Add log as pending
      const pendingTimer = setTimeout(() => {
        setLogs(prev => [
          ...prev,
          {
            id: `log-${index}`,
            text: log.text,
            timestamp: new Date().toLocaleTimeString(),
            status: "processing",
          },
        ]);
      }, currentTime);
      logTimers.push(pendingTimer);

      // Mark as completed
      const completedTimer = setTimeout(() => {
        setLogs(prev =>
          prev.map(l =>
            l.id === `log-${index}` ? { ...l, status: "completed" } : l
          )
        );
      }, currentTime + log.duration);
      logTimers.push(completedTimer);

      currentTime += log.duration + 200;
    });

    // Mark as complete and redirect
    const completeTimer = setTimeout(() => {
      setIsComplete(true);
      // Redirect to results after 2 seconds, carrying the lead id forward.
      setTimeout(() => {
        setLocation(leadId ? `/results?leadId=${leadId}` : "/results");
      }, 2000);
    }, currentTime);
    logTimers.push(completeTimer);

    return () => {
      logTimers.forEach(timer => clearTimeout(timer));
    };
  }, [setLocation, leadId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center py-12">
      <div className="container max-w-2xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {isComplete ? (
                <CheckCircle2 className="w-16 h-16 text-lime-400 animate-pulse" />
              ) : (
                <Loader2 className="w-16 h-16 text-accent animate-spin" />
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">
              {isComplete ? "Offers Ready!" : "Processing Your Request"}
            </h1>
            <p className="text-lg text-muted-foreground">
              {isComplete
                ? "We found 3 perfect infrastructure matches for you."
                : "Our AI is analyzing providers and generating custom offers..."}
            </p>
          </div>

          {/* Logs Terminal */}
          <div className="tech-card bg-black/50 border border-lime-400/30 font-mono text-sm">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-lime-400 opacity-50">
                  $ Initializing DatacenterMarket AI Engine...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <span className="text-lime-400 opacity-75 flex-shrink-0">
                      {log.status === "completed" ? "✓" : "→"}
                    </span>
                    <div className="flex-1">
                      <span className="text-lime-400">{log.text}</span>
                      {log.status === "processing" && (
                        <span className="ml-2 inline-block animate-pulse">▌</span>
                      )}
                    </div>
                    <span className="text-lime-400/50 text-xs flex-shrink-0">
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Progress Info */}
          <div className="text-center text-muted-foreground">
            <p className="text-sm">
              {isComplete
                ? "Redirecting to results..."
                : `Processing: ${logs.length} / ${SIMULATION_LOGS.length} steps`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
