/**
 * Workload recap handed from the form to the results screen (leads have no
 * public read procedure — PII — so the summary chips travel via sessionStorage).
 */

const KEY = "dcm-workload-recap";

export interface WorkloadRecap {
  chips: string[];
}

export function saveWorkloadRecap(recap: WorkloadRecap) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(recap));
  } catch {
    // Storage unavailable (private mode) — the results screen falls back to generic chips.
  }
}

export function loadWorkloadRecap(): WorkloadRecap | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkloadRecap;
    return Array.isArray(parsed?.chips) ? parsed : null;
  } catch {
    return null;
  }
}
