/**
 * Workload recap handed from the form to the results screen (leads have no
 * public read procedure — PII — so the summary chips travel via sessionStorage).
 */

const PREFIX = "dcm-workload-recap:";

export interface WorkloadRecap {
  chips: string[];
}

export function saveWorkloadRecap(leadId: number, recap: WorkloadRecap) {
  try {
    sessionStorage.setItem(PREFIX + leadId, JSON.stringify(recap));
  } catch {
    // Storage unavailable (private mode) — the results screen falls back to generic chips.
  }
}

export function loadWorkloadRecap(leadId: number | undefined): WorkloadRecap | null {
  if (leadId == null) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + leadId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkloadRecap;
    return Array.isArray(parsed?.chips) ? parsed : null;
  } catch {
    return null;
  }
}
