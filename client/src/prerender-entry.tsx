/**
 * Entrée SSR utilisée UNIQUEMENT au build par scripts/prerender.ts pour produire
 * les snapshots HTML des routes publiques indexables (dist/public/<route>/index.html).
 *
 * Les pages sont importées statiquement (pas de lazy() : renderToString rendrait
 * le fallback Suspense au lieu du contenu). Toute page listée ici doit rester
 * SSR-safe : pas d'accès à window/localStorage pendant le rendu.
 */
import { renderToString } from "react-dom/server";
import { Route, Router, Switch } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import GpuAsAService from "@/pages/GpuAsAService";
import GpuPrixLocation from "@/pages/GpuPrixLocation";
import GpuSouverainFrance from "@/pages/GpuSouverainFrance";
import Home from "@/pages/Home";
import LegalNotice from "@/pages/LegalNotice";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";

export function render(url: string): string {
  return renderToString(
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Router ssrPath={url}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/gpu-as-a-service/prix-location-gpu" component={GpuPrixLocation} />
            <Route path="/gpu-as-a-service/gpu-souverain-france" component={GpuSouverainFrance} />
            <Route path="/gpu-as-a-service" component={GpuAsAService} />
            <Route path="/terms" component={TermsOfService} />
            <Route path="/privacy" component={PrivacyPolicy} />
            <Route path="/legal" component={LegalNotice} />
          </Switch>
        </Router>
      </TooltipProvider>
    </ThemeProvider>
  );
}
