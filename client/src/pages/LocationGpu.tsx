import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";
import SiteHeader from "@/components/marketing/SiteHeader";

/**
 * Page satellite SEO « Location de GPU » (/gpu-as-a-service/location-gpu/).
 * Cible les requêtes « location GPU », « louer des GPU », « location capacité
 * GPU » (la voie classique : capacité dédiée à l'engagement mensuel), dans le
 * cadre du positionnement comparateur — voir docs/SEO-ROADMAP.md.
 * Véracité : chiffres dérivés du catalogue (server/seed.ts).
 */
export default function LocationGpu() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="container py-12 max-w-4xl">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Accueil
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link href="/gpu-as-a-service/" className="hover:text-foreground transition-colors">
                GPU as a Service
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-foreground">
              Location de GPU
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Location de GPU : la capacité dédiée classique, comparée sur le marché
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              La location classique de capacité GPU — une configuration dédiée, réservée pour vous,
              facturée à l'engagement mensuel — reste le socle du calcul IA en production. Elle se
              distingue du cloud à l'heure (instances spot, serverless GPU) par des performances
              constantes, un budget prévisible et une localisation maîtrisée des données.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket centralise les offres de location GPU des fournisseurs européens et
              les normalise (prix mensuel, délai de mobilisation, SLA, localisation) : décrivez
              votre besoin une fois, et comparez jusqu'à trois options chiffrées du catalogue plutôt que de démarcher
              les fournisseurs un par un.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Qu'est-ce que la location classique de capacité GPU ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              C'est la mise à disposition d'une infrastructure GPU dédiée — serveurs bare metal ou
              clusters réservés de 4 à 16 GPU — hébergée en datacenter et souscrite au mois. Vous
              ne partagez ni les cartes, ni la bande passante mémoire, ni l'interconnexion : la
              configuration est provisionnée pour votre usage exclusif, avec un SLA contractuel.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Sur notre catalogue, ces configurations vont du serveur RTX 4090 pour la R&D au
              cluster 16× H100 InfiniBand pour l'entraînement distribué, avec des délais de mise à
              disposition de 24 h à 7 jours selon l'offre.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Location dédiée ou cloud à l'heure : que choisir ?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le cloud GPU à l'heure (instances à la demande, spot, serverless) excelle pour les
              pics courts et l'expérimentation : on paie à la minute, on coupe quand on veut. Mais
              dès qu'une charge devient continue — entraînement long, inférence en production,
              équipe qui consomme du calcul toute l'année — la location dédiée mensuelle reprend
              l'avantage :
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">Coût prévisible :</strong> un prix mensuel fixe,
                sans surprise de facturation à l'usage ni flambée des prix spot.
              </li>
              <li>
                <strong className="text-foreground">Performances constantes :</strong> pas de
                voisinage bruyant ni de préemption — la capacité est à vous, y compris
                l'interconnexion (InfiniBand sur les clusters d'entraînement).
              </li>
              <li>
                <strong className="text-foreground">Localisation maîtrisée :</strong> vous savez
                dans quel datacenter tournent vos workloads — un prérequis RGPD que le serverless
                mutualisé garantit rarement.
              </li>
              <li>
                <strong className="text-foreground">Disponibilité garantie :</strong> les gammes
                récentes (H100) sont souvent introuvables à l'heure au moment où on en a besoin ;
                une capacité réservée ne disparaît pas.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Louer plutôt qu'acheter : le rappel CAPEX/OPEX</h2>
            <p className="text-muted-foreground leading-relaxed">
              Face à l'achat de serveurs, la location transforme un investissement (CAPEX) en
              charge d'exploitation (OPEX) : démarrage en jours plutôt qu'en mois, budget mensuel,
              risque d'obsolescence porté par le fournisseur. L'achat ne se justifie que pour une
              charge stable qui saturera le matériel plusieurs années, avec une équipe pour
              l'exploiter. Le détail de l'arbitrage est dans notre{" "}
              <Link href="/gpu-as-a-service/" className="text-accent hover:underline">
                guide GPU as a Service
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Comment comparer les offres de location GPU du marché ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Le marché de la location GPU est fragmenté : chaque fournisseur publie ses prix dans
              son format, avec des périmètres différents (frais d'installation inclus ou non,
              SLA variables, engagement de 1 à 36 mois). Quatre critères rendent les offres
              réellement comparables :
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">Le prix mensuel complet</strong> — y compris
                frais d'installation amortis, réseau et stockage (voir nos{" "}
                <Link href="/gpu-as-a-service/prix-location-gpu/" className="text-accent hover:underline">
                  prix GPU comparés en €/GPU/h
                </Link>
                ).
              </li>
              <li>
                <strong className="text-foreground">Le délai de mobilisation</strong> — de 24 h à
                7 jours sur notre catalogue.
              </li>
              <li>
                <strong className="text-foreground">Le SLA</strong> — 99,5 % à 99,99 % selon les
                offres, avec des pénalités contractuelles ou non.
              </li>
              <li>
                <strong className="text-foreground">La localisation</strong> — pays d'hébergement
                et juridiction, jusqu'à l'option{" "}
                <Link href="/gpu-as-a-service/gpu-souverain-france/" className="text-accent hover:underline">
                  GPU souverain en France
                </Link>
                .
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              C'est exactement ce que fait l'appel au marché DatacenterMarket : vos critères sont
              soumis aux fournisseurs partenaires, et vous recevez jusqu'à trois offres normalisées
              sur ces quatre axes — commandables et payables en ligne.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Comparer les offres de location pour mon besoin
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
