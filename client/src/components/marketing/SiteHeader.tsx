import { Link, useLocation } from "wouter";
import { Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/gpu-as-a-service/", label: "GPU as a Service" },
  { href: "/gpu-as-a-service/prix-location-gpu/", label: "Prix de location" },
  { href: "/gpu-as-a-service/gpu-souverain-france/", label: "GPU souverain" },
];

export default function SiteHeader() {
  const [, setLocation] = useLocation();

  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between h-16 gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="DatacenterMarket — accueil">
          <Cpu className="w-6 h-6 text-accent" aria-hidden="true" />
          <span className="font-bold text-lg">DatacenterMarket</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6" aria-label="Navigation principale">
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
        <Button
          size="sm"
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
          onClick={() => setLocation("/workload")}
        >
          Décrire mon besoin
        </Button>
      </div>
    </header>
  );
}
