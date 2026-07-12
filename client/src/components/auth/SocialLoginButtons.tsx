import { getLoginUrl, type OAuthProvider } from "@/const";
import { markRoleRedirect } from "@/lib/postLoginRedirect";
import { cn } from "@/lib/utils";

/**
 * Quick-login buttons that route through the existing Manus OAuth flow with a
 * best-effort provider hint (see getLoginUrl). Google and GitHub are already
 * federated by the Manus portal — these just surface them as one-click CTAs.
 *
 * `onBeforeRedirect` runs first (e.g. to persist a pending checkout intent) so
 * the funnel can resume after login; a role redirect is also armed unless a
 * checkout intent overrides it (see PostLoginRedirect).
 */
export function SocialLoginButtons({
  onBeforeRedirect,
  className,
  showGenericFallback = true,
}: {
  onBeforeRedirect?: () => void;
  className?: string;
  showGenericFallback?: boolean;
}) {
  const start = (provider?: OAuthProvider) => {
    onBeforeRedirect?.();
    markRoleRedirect();
    window.location.href = getLoginUrl(provider);
  };

  const btn =
    "flex w-full items-center justify-center gap-2.5 rounded-[9px] border border-border bg-card px-5 py-3 text-[14px] font-semibold text-foreground transition-colors hover:bg-input";

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <button type="button" onClick={() => start("google")} className={btn}>
        <GoogleIcon />
        Continuer avec Google
      </button>
      <button type="button" onClick={() => start("github")} className={btn}>
        <GithubIcon />
        Continuer avec GitHub
      </button>
      {showGenericFallback && (
        <button
          type="button"
          onClick={() => start()}
          className="mt-0.5 text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Autre méthode de connexion
        </button>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
