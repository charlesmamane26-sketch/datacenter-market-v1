import { Link } from "wouter";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/50 py-12 bg-card/30">
      <div className="container">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h2 className="font-semibold mb-4 text-base">GPU as a Service</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/gpu-as-a-service/" className="hover:text-foreground transition-colors">
                  Le guide de la location GPU
                </Link>
              </li>
              <li>
                <Link href="/gpu-as-a-service/location-gpu/" className="hover:text-foreground transition-colors">
                  Location de GPU dédiés
                </Link>
              </li>
              <li>
                <Link href="/gpu-as-a-service/prix-location-gpu/" className="hover:text-foreground transition-colors">
                  Prix de location d'un GPU
                </Link>
              </li>
              <li>
                <Link href="/gpu-as-a-service/gpu-souverain-france/" className="hover:text-foreground transition-colors">
                  GPU souverain en France
                </Link>
              </li>
              <li>
                <Link href="/workload" className="hover:text-foreground transition-colors">
                  Décrire mon besoin GPU
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-4 text-base">Informations légales</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/terms/" className="hover:text-foreground transition-colors">
                  Conditions générales d'utilisation
                </Link>
              </li>
              <li>
                <Link href="/privacy/" className="hover:text-foreground transition-colors">
                  Politique de confidentialité
                </Link>
              </li>
              <li>
                <Link href="/legal/" className="hover:text-foreground transition-colors">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-4 text-base">Éditeur</h2>
            <p className="text-sm text-muted-foreground">
              DatacenterMarket est un service d'Anavim Advisory SAS
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
                En savoir plus sur Anavim Advisory
              </a>
            </p>
          </div>
        </div>
        <div className="border-t border-border/50 pt-8 text-sm text-muted-foreground">
          <p>&copy; 2026 DatacenterMarket — Anavim Advisory SAS. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
