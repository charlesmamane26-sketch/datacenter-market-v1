import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { setLangPref } from "@/lib/langPref";
import { alternatePath, matchRouteSeo } from "@shared/seo";

/**
 * One-click FR ↔ EN switch. Resolves the equivalent page in the other language
 * from the route's reciprocal hreflang cluster (shared/seo.ts). Falls back to
 * the other language's home when the current page has no declared counterpart
 * (e.g. the funnel, which is French-only for now). SSR-safe.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const [location] = useLocation();
  const route = matchRouteSeo(location);
  const currentLang = route?.lang ?? "fr";
  const target: "fr" | "en" = currentLang === "en" ? "fr" : "en";

  const href =
    (route && alternatePath(route, target)) ?? (target === "en" ? "/en" : "/");
  const label = target === "en" ? "EN" : "FR";
  const aria = target === "en" ? "Switch to English" : "Passer en français";

  return (
    <Link
      href={href}
      hrefLang={target}
      aria-label={aria}
      onClick={() => setLangPref(target)}
      className={cn(
        "rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-[.06em] text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {label}
    </Link>
  );
}
