import type { RequestHandler } from "express";

export const MAX_TRPC_BATCH_OPERATIONS = 10;

export function countTrpcOperations(originalUrl: string): number {
  const pathOnly = originalUrl.split("?", 1)[0] ?? "";
  const marker = "/api/trpc/";
  const markerIndex = pathOnly.indexOf(marker);
  if (markerIndex === -1) return 0;

  const encodedProcedures = pathOnly.slice(markerIndex + marker.length);
  if (!encodedProcedures) return 0;
  let procedures: string;
  try {
    procedures = decodeURIComponent(encodedProcedures);
  } catch {
    // The tRPC middleware will return the canonical bad-path error later.
    procedures = encodedProcedures;
  }
  return procedures.split(",").filter(Boolean).length;
}

/** Bounds tRPC HTTP batching before context/auth/database work begins. */
export function trpcBatchLimit(
  maxOperations = MAX_TRPC_BATCH_OPERATIONS
): RequestHandler {
  return (req, res, next) => {
    const operations = countTrpcOperations(req.originalUrl);
    if (operations > maxOperations) {
      res.status(413).json({
        error: {
          message: `A tRPC batch may contain at most ${maxOperations} operations.`,
          code: "TRPC_BATCH_TOO_LARGE",
        },
      });
      return;
    }
    next();
  };
}
