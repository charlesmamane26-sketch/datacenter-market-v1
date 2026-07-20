import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

function sampleRate(value: string | undefined, fallback: number): number {
  const parsed = value == null || value === "" ? fallback : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

// Import dynamique : le SDK Sentry (~100 ko) sort du bundle critique et n'est
// chargé qu'aux builds où un DSN est configuré (perf Lighthouse, lot 4 SEO).
if (import.meta.env.VITE_SENTRY_DSN) {
  import("@sentry/react").then(Sentry => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: sampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1),
      // The API is same-origin (/api/*), so propagate tracing headers to this
      // deployment's own origin rather than a hard-coded host.
      tracePropagationTargets: ["localhost", `${window.location.origin}/api`],
      replaysSessionSampleRate: sampleRate(
        import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
        0,
      ),
      replaysOnErrorSampleRate: sampleRate(
        import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
        0.1,
      ),
    });
    console.log("[Sentry] Client monitoring initialized.");
  });
}

// Umami (optionnel) : injecté depuis le bundle (pas d'inline dans index.html — la
// CSP de production est stricte) et seulement si l'endpoint est configuré au build.
// L'origine doit alors figurer dans CSP_EXTRA_ORIGINS (voir DEPLOYMENT.md §2).
if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
  const umami = document.createElement("script");
  umami.defer = true;
  umami.src = `${import.meta.env.VITE_ANALYTICS_ENDPOINT}/umami`;
  umami.setAttribute(
    "data-website-id",
    import.meta.env.VITE_ANALYTICS_WEBSITE_ID ?? ""
  );
  document.head.appendChild(umami);
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
