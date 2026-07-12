import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MarketBrand } from "@/components/market";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** English marketing header (mirrors SiteHeader) used by the /en/* content pages. */
const NAV_LINKS = [
  { href: "/en/gpu-as-a-service", label: "GPU as a Service" },
  { href: "/en/gpu-as-a-service/gpu-rental-pricing", label: "Pricing" },
  { href: "/en/gpu-as-a-service/sovereign-gpu-europe", label: "Sovereign GPU" },
];

export default function SiteHeaderEn() {
  const [, setLocation] = useLocation();

  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between h-16 gap-4">
        <Link href="/en" className="flex items-center" aria-label="DatacenterMarket — home">
          <MarketBrand size={22} />
        </Link>
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            onClick={() => setLocation("/workload")}
          >
            Request capacity
          </Button>
        </div>
      </div>
    </header>
  );
}
