import { Link } from "wouter";

/** English marketing footer (mirrors SiteFooter) used by the /en/* content pages. */
export default function SiteFooterEn() {
  return (
    <footer className="border-t border-border/50 py-12 bg-card/30">
      <div className="container">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h2 className="font-semibold mb-4 text-base">GPU as a Service</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/en/gpu-as-a-service" className="hover:text-foreground transition-colors">
                  The GPU rental guide
                </Link>
              </li>
              <li>
                <Link href="/en/gpu-as-a-service/gpu-rental-pricing" className="hover:text-foreground transition-colors">
                  GPU rental pricing
                </Link>
              </li>
              <li>
                <Link href="/en/gpu-as-a-service/sovereign-gpu-europe" className="hover:text-foreground transition-colors">
                  Sovereign GPU in Europe
                </Link>
              </li>
              <li>
                <Link href="/workload" className="hover:text-foreground transition-colors">
                  Describe your GPU need
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-4 text-base">Legal</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/terms/" className="hover:text-foreground transition-colors">
                  Terms of service
                </Link>
              </li>
              <li>
                <Link href="/privacy/" className="hover:text-foreground transition-colors">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/legal/" className="hover:text-foreground transition-colors">
                  Legal notice
                </Link>
              </li>
              <li>
                <Link href="/" hrefLang="fr" className="hover:text-foreground transition-colors">
                  Version française
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-4 text-base">Publisher</h2>
            <p className="text-sm text-muted-foreground">
              DatacenterMarket is a service by Anavim Advisory SAS
              <br />
              10 rue du Colisée, 75008 Paris, France
            </p>
            <p className="text-sm mt-2">
              <a
                href="https://www.anavimadvisory.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Learn more about Anavim Advisory
              </a>
            </p>
          </div>
        </div>
        <div className="border-t border-border/50 pt-8 text-sm text-muted-foreground">
          <p>&copy; 2026 DatacenterMarket — Anavim Advisory SAS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
