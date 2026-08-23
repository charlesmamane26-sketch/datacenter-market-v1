export const LAST_SIGNED_IN_UPDATE_INTERVAL_MS = 15 * 60 * 1000;

export function shouldRefreshLastSignedIn(
  previous: Date,
  now: Date,
  intervalMs = LAST_SIGNED_IN_UPDATE_INTERVAL_MS
): boolean {
  const previousMs = previous.getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(previousMs) || !Number.isFinite(nowMs)) return true;
  return nowMs - previousMs >= intervalMs;
}
