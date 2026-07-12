import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { MarketChrome } from "@/components/market";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";

/**
 * Branded login page. Surfaces one-click Google/GitHub (via the Manus flow) plus
 * a generic fallback. Already-authenticated visitors are routed to their area.
 */
export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    setLocation(user.role === "admin" ? "/admin" : "/dashboard");
  }, [loading, user, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome onBrandClick={() => setLocation("/")} />

      <div className="mx-auto flex max-w-[440px] flex-col items-center px-5 pb-16 pt-16 md:pt-24">
        {loading || user ? (
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        ) : (
          <div className="w-full rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-2 text-center">
              <h1 className="m-0 text-[26px] font-extrabold uppercase tracking-[-0.03em]">
                Connexion<span className="text-accent">.</span>
              </h1>
              <p className="m-0 text-[13.5px] leading-[1.55] text-muted-foreground">
                Accédez à votre espace client ou administrateur.
              </p>
            </div>

            <SocialLoginButtons />

            <p className="mt-6 text-center text-[11.5px] leading-[1.55] text-muted-foreground">
              En vous connectant, vous acceptez la{" "}
              <a href="/privacy" className="text-accent hover:underline">
                politique de confidentialité
              </a>{" "}
              et les{" "}
              <a href="/terms" className="text-accent hover:underline">
                conditions générales
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
