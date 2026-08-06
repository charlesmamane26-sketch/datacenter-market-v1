import type { Server } from "node:http";

type Exit = (code: number) => void;

export interface GracefulShutdownOptions {
  server: Server;
  timeoutMs?: number;
  cleanup?: () => Promise<void>;
  flushMonitoring?: () => Promise<unknown>;
  exit?: Exit;
  log?: (message: string) => void;
}

export function createGracefulShutdown({
  server,
  timeoutMs = 10_000,
  cleanup = async () => undefined,
  flushMonitoring = async () => undefined,
  exit = code => process.exit(code),
  log = message => console.log(message),
}: GracefulShutdownOptions): (signal: NodeJS.Signals) => Promise<void> {
  let shuttingDown = false;

  return async signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`[Server] ${signal} received; draining connections.`);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const drained = new Promise<boolean>(resolve => {
      server.close(error => resolve(!error));
      server.closeIdleConnections?.();
    });
    const timedOut = new Promise<boolean>(resolve => {
      timeoutHandle = setTimeout(() => {
        server.closeAllConnections?.();
        resolve(false);
      }, timeoutMs);
    });

    const cleanExit = await Promise.race([drained, timedOut]);
    if (timeoutHandle) clearTimeout(timeoutHandle);

    await Promise.allSettled([cleanup(), flushMonitoring()]);
    log(
      cleanExit
        ? "[Server] Graceful shutdown complete."
        : "[Server] Graceful shutdown timed out; connections were closed."
    );
    exit(cleanExit ? 0 : 1);
  };
}

export function installGracefulShutdown(
  options: GracefulShutdownOptions
): () => void {
  const shutdown = createGracefulShutdown(options);
  const onSigterm = () => void shutdown("SIGTERM");
  const onSigint = () => void shutdown("SIGINT");
  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);
  return () => {
    process.off("SIGTERM", onSigterm);
    process.off("SIGINT", onSigint);
  };
}
