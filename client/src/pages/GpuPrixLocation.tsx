import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";
import SiteHeader from "@/components/marketing/SiteHeader";

/**
 * Page satellite SEO « Prix de location GPU » (/gpu-as-a-service/prix-location-gpu/).
 * Véracité : équivalents €/GPU/h dérivés des prix mensuels du catalogue
 * (server/seed.ts, base 730 h/mois, hors installation). H200/B200 hors
 * catalogue → « à confirmer » ([À VALIDER] : disponibilité et tarifs H200/B200).
 */
export default function GpuPrixLocation() {
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
              Prix de location GPU
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Prix GPU comparés sur le marché : grille indicative en €/GPU/h
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Combien coûte la location d'un GPU pour vos projets d'IA ? Le coût d'un GPU cloud
              dédié varie fortement selon la génération de carte, la taille du cluster et la durée
              d'engagement. Pour vous donner un point de repère, voici une grille indicative en
              euros par GPU et par heure, dérivée des prix mensuels constatés sur notre catalogue.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket est une place de marché de capacité GPU : nous ne possédons ni
              n'exploitons les infrastructures, nous mettons en concurrence des fournisseurs
              européens (opérateurs de datacenters, clouds GPU) pour votre besoin. Les chiffres
              ci-dessous sont donc des ordres de grandeur, selon configuration et engagement —
              jamais des prix garantis.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Location GPU : prix indicatifs par gamme (€/GPU/h)
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Notre catalogue porte sur des configurations dédiées (bare metal chez nos
              fournisseurs partenaires), facturées au mois, avec d'éventuels frais d'installation.
              L'équivalent horaire ci-dessous est calculé sur une base de 730 heures par mois, hors
              frais d'installation, pour faciliter la comparaison avec les clouds GPU à la demande.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA H100 80 Go — ≈ 2,9 à 3,8 €/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              Le prix d'un GPU H100 à l'heure ressort entre environ 2,9 et 3,8 €/GPU/h sur notre
              catalogue. Les offres portent sur des clusters dédiés de 8 à 16 GPU à Francfort,
              Paris ou Amsterdam, livrés en 24 h à 96 h, avec des SLA de 99,9 % à 99,99 %. C'est la
              gamme que nous recommandons pour l'entraînement et le fine-tuning de grands modèles.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA A100 80 Go — ≈ 1,6 à 1,8 €/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              Les pods A100 de 4 à 8 GPU, à Varsovie et Madrid, se situent autour de 1,6 à 1,8
              €/GPU/h (SLA 99,5 %). Comptez 6 à 7 jours de délai : un compromis pertinent quand le
              calendrier le permet.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA L40S 48 Go — ≈ 1,5 €/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              Pensée pour l'inférence, la configuration de 8 GPU L40S à Dublin revient à environ
              1,5 €/GPU/h (délai 72 h, SLA 99,5 %).
            </p>
            <h3 className="text-xl font-semibold">NVIDIA RTX 4090 24 Go — ≈ 1,2 €/GPU/h</h3>
            <p className="text-muted-foreground leading-relaxed">
              Pour la R&D et les budgets contraints, la configuration de 8 GPU RTX 4090 à Stockholm
              s'établit à environ 1,2 €/GPU/h (délai 48 h, SLA 99,0 %).
            </p>
            <h3 className="text-xl font-semibold">H200 et B200 : via l'appel au marché</h3>
            <p className="text-muted-foreground leading-relaxed">
              Les NVIDIA H200 (141 Go HBM3e) et B200 (Blackwell, 192 Go HBM3e) ne figurent pas à
              notre catalogue standard à ce jour. Nous pouvons les rechercher auprès de nos
              fournisseurs partenaires via l'appel au marché — disponibilité et tarifs à confirmer.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Les facteurs qui font varier le prix de location d'un GPU
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Deux offres « H100 » peuvent afficher des écarts de prix significatifs. Avant de
              comparer un coût GPU cloud à un autre, vérifiez sur quoi porte réellement le tarif :
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                Génération du GPU : une H100 se loue nettement plus cher qu'une A100 ou qu'une RTX
                4090, à dimensionnement égal.
              </li>
              <li>
                Nombre de GPU et interconnexion : un cluster de 16 GPU interconnectés pour
                l'entraînement distribué ne se tarife pas comme des cartes isolées.
              </li>
              <li>
                Durée d'engagement : un engagement plus long se négocie généralement mieux qu'un
                besoin ponctuel.
              </li>
              <li>
                Niveau de SLA : passer de 99,0 % à 99,99 % de disponibilité suppose plus de
                redondance, donc un tarif plus élevé.
              </li>
              <li>
                Localisation du datacenter : les prix varient selon les places européennes ; sur
                notre catalogue, les configurations les plus économiques sont hébergées à
                Stockholm, Dublin, Varsovie et Madrid — l'écart tenant aussi à la génération de GPU
                proposée sur chaque site.
              </li>
              <li>
                Stockage et réseau : volumétrie de stockage, débit d'interconnexion et bande
                passante sortante peuvent peser sur la facture finale.
              </li>
              <li>
                Frais d'installation : certaines configurations dédiées comportent des frais de
                mise en service, à intégrer dans le coût complet.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Comment obtenir une offre chiffrée : l'appel au marché
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Pour passer d'un ordre de grandeur à une offre chiffrée correspondant à votre besoin,
              décrivez votre besoin dans notre formulaire en ligne : type de charge de travail
              (entraînement, fine-tuning, inférence), nombre de GPU, budget et contraintes
              éventuelles.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Notre moteur de comparaison confronte votre besoin au catalogue et vous propose
              jusqu'à trois offres : l'offre au meilleur rapport qualité/prix, la plus rapide à
              déployer et la moins chère. Vous commandez et payez en ligne (paiement Stripe), le
              fournisseur provisionne l'infrastructure, et vous suivez le déploiement depuis votre
              tableau de bord client.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Selon la configuration retenue, la capacité est mobilisable dès 24 h. Notre promesse
              — une capacité mobilisée en 72 h par appel au marché — est tenue sur plusieurs
              configurations phares ; seules les options les plus économiques demandent jusqu'à 7
              jours.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Décrire mon besoin et recevoir jusqu'à trois offres
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
          </section>

          <section className="space-y-4 border-t border-border/50 pt-10">
            <h2 className="text-3xl font-bold">Pour aller plus loin</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cette grille complète notre guide{" "}
              <Link href="/gpu-as-a-service/" className="text-accent hover:underline">
                GPU as a Service : louer de la puissance de calcul IA en Europe
              </Link>
              , qui détaille gammes, cas d'usage et critères de choix d'un fournisseur.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Vos données doivent rester en Europe, voire en France ? Les offres de notre catalogue
              sont hébergées dans l'UE (résidence des données UE, conformité RGPD), dont une
              configuration à Paris. Consultez notre page dédiée au{" "}
              <Link
                href="/gpu-as-a-service/gpu-souverain-france/"
                className="text-accent hover:underline"
              >
                GPU souverain et à l'hébergement IA en France
              </Link>
              .
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Questions fréquentes sur les prix de location GPU</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Quel est le prix d'un GPU H100 à l'heure ?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Entre environ 2,9 et 3,8 €/GPU/h en équivalent horaire sur notre catalogue (base
                  730 h/mois, hors installation), selon configuration, engagement et SLA. Ce sont
                  des ordres de grandeur ; une offre chiffrée correspondant à votre besoin
                  s'obtient via l'appel au marché.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">La facturation est-elle vraiment à l'heure ?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Non. Les configurations du catalogue sont dédiées et facturées au mois, avec
                  d'éventuels frais d'installation. L'équivalent €/GPU/h est un indicateur de
                  comparaison (base 730 heures par mois).
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Pourquoi les prix ne sont-ils pas garantis ?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  DatacenterMarket est un intermédiaire : le catalogue est indicatif et évolutif,
                  et le prix final dépend de l'offre retenue chez le fournisseur (configuration,
                  engagement, SLA, localisation). La mise en concurrence via l'appel au marché
                  aboutit à des offres chiffrées : le prix de l'offre que vous retenez est celui
                  appliqué lors du paiement en ligne.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Peut-on louer des H200 ou des B200 ?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pas au catalogue standard à ce jour. Nous pouvons les rechercher auprès de nos
                  fournisseurs partenaires via l'appel au marché — disponibilité et tarifs à
                  confirmer.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  Sous quel délai la capacité est-elle disponible ?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Selon la configuration : dès 24 h pour certaines offres H100, 72 h sur plusieurs
                  configurations phares, et jusqu'à 7 jours pour les options les plus économiques.
                </p>
              </div>
            </div>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
