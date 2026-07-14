import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";
import SiteHeader from "@/components/marketing/SiteHeader";
import { GAAS_FAQ } from "@shared/seo-content";

/**
 * Page pilier SEO « GPU as a Service » (/gpu-as-a-service/).
 * Véracité : chiffres dérivés du catalogue (server/seed.ts) ; H200/B200 hors
 * catalogue → « à confirmer via l'appel au marché » ([À VALIDER] : disponibilité
 * et tarifs H200/B200 ; hébergement 100 % France).
 */
export default function GpuAsAService() {
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
            <li aria-current="page" className="text-foreground">
              GPU as a Service
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              GPU as a Service : comparer les offres du marché pour vos projets IA
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              L'accès à la puissance de calcul est devenu le principal goulot d'étranglement des
              projets d'intelligence artificielle. Entraîner un modèle, affiner un LLM ou servir de
              l'inférence en production exige des GPU récents, longs à obtenir et coûteux à
              immobiliser. Le GPU as a Service répond à ce problème : louer des GPU à la demande,
              hébergés en datacenter, plutôt qu'acheter des serveurs.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket est la plateforme qui centralise les offres GPU as a Service du
              marché européen, éditée par Anavim Advisory. Nous ne possédons ni n'exploitons
              d'infrastructure : nous agrégeons et normalisons les offres de fournisseurs
              partenaires — opérateurs de datacenters, clouds GPU — puis les mettons en concurrence
              pour vous proposer jusqu'à trois offres comparables, avec une capacité mobilisée en
              72 h par appel au marché.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Ce guide fait le point : définition, cas d'usage, gammes NVIDIA, tarifs indicatifs en
              €/GPU/h, achat ou location, délais et souveraineté des données.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Qu'est-ce que le GPU as a Service ?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le GPU as a Service (GPUaaS) désigne la mise à disposition de puissance de calcul GPU
              hébergée en datacenter, en location ou souscription mensuelle, plutôt que par l'achat
              de matériel. Votre organisation accède à une infrastructure dédiée, provisionnée et
              exploitée par un fournisseur, et la paie comme une charge d'exploitation.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Face à l'achat de serveurs, la location de GPU supprime trois frictions :
              l'investissement initial, les délais d'approvisionnement du matériel et le risque
              d'obsolescence, élevé au rythme actuel des générations de GPU.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Face aux grands clouds généralistes, une place de marché comme DatacenterMarket
              introduit la mise en concurrence : votre besoin est confronté aux offres de plusieurs
              fournisseurs européens plutôt qu'à la grille tarifaire d'un acteur unique. Les
              configurations sont dédiées (bare metal chez nos fournisseurs partenaires) et
              facturées mensuellement.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Un accès rapide à des GPU récents, sans achat de matériel</li>
              <li>Une facturation mensuelle prévisible (OPEX)</li>
              <li>Des configurations dédiées, dimensionnées sur votre charge de travail</li>
              <li>La liberté de faire évoluer la capacité au fil des besoins</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Cas d'usage : quand louer des GPU à la demande ?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trois familles de charges de travail concentrent l'essentiel des besoins en GPU à la
              demande.
            </p>
            <h3 className="text-xl font-semibold">Entraînement de modèles</h3>
            <p className="text-muted-foreground leading-relaxed">
              L'entraînement de modèles — de fondation ou spécialisés — mobilise des clusters
              multi-GPU pendant des semaines, parfois des mois, et privilégie les gammes les plus
              récentes. Sur notre catalogue, les clusters NVIDIA H100 de 8 à 16 GPU, à Francfort,
              Paris ou Amsterdam, sont dimensionnés pour ce cas d'usage.
            </p>
            <h3 className="text-xl font-semibold">Fine-tuning et adaptation de modèles</h3>
            <p className="text-muted-foreground leading-relaxed">
              Le fine-tuning adapte un modèle existant à un domaine, une langue ou des données
              propriétaires, pour un coût bien moindre qu'un entraînement complet. Des pods de 4 à
              8 GPU A100 80 Go offrent souvent le bon compromis coût/performance ; un cluster H100
              reste pertinent quand les itérations doivent être rapides.
            </p>
            <h3 className="text-xl font-semibold">Inférence LLM en production</h3>
            <p className="text-muted-foreground leading-relaxed">
              Servir un LLM en production impose une latence stable, une disponibilité
              contractuelle et un coût par requête maîtrisé : les GPU orientés inférence comme le
              NVIDIA L40S 48 Go sont conçus pour ce profil. Pour la R&D ou le prototypage à budget
              contraint, des configurations RTX 4090 24 Go permettent d'itérer avant le passage à
              l'échelle.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Gammes GPU : H100, H200, B200, A100 et alternatives</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les capacités mémoire citées sont les spécifications publiques des constructeurs. La
              disponibilité mentionnée est celle de notre catalogue à date : elle est donnée à
              titre indicatif et peut évoluer.
            </p>
            <h3 className="text-xl font-semibold">
              NVIDIA H100 80 Go : le haut de gamme entraînement de notre catalogue
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Avec 80 Go de mémoire, le H100 est la gamme que nous recommandons en priorité pour
              l'entraînement et le fine-tuning intensif. Notre catalogue propose des clusters de 8
              à 16 GPU à Francfort, Paris et Amsterdam, avec des SLA de 99,9 % à 99,99 % et des
              délais de 24 h à 96 h.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA H200 : 141 Go de HBM3e</h3>
            <p className="text-muted-foreground leading-relaxed">
              Le H200 porte la mémoire embarquée à 141 Go de HBM3e, un atout pour l'inférence de
              très grands modèles et les contextes longs. Absent de notre catalogue standard à ce
              jour, il peut être recherché via l'appel au marché — disponibilité et tarifs à
              confirmer.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA B200 (Blackwell) : 192 Go de HBM3e</h3>
            <p className="text-muted-foreground leading-relaxed">
              Le B200, sur architecture Blackwell, embarque 192 Go de HBM3e. Lui aussi absent du
              catalogue standard, il peut faire l'objet d'une consultation de nos fournisseurs
              partenaires — disponibilité et tarifs à confirmer.
            </p>
            <h3 className="text-xl font-semibold">NVIDIA A100 80 Go : le rapport qualité/prix éprouvé</h3>
            <p className="text-muted-foreground leading-relaxed">
              L'A100 80 Go reste une valeur sûre pour le fine-tuning et l'entraînement de modèles
              de taille intermédiaire. Notre catalogue le propose en pods de 4 à 8 GPU à Varsovie
              et Madrid, avec un SLA de 99,5 %.
            </p>
            <h3 className="text-xl font-semibold">
              L40S et RTX 4090 : inférence optimisée et R&D à budget maîtrisé
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Le NVIDIA L40S 48 Go, en configuration 8 GPU à Dublin, cible l'inférence en
              production. La RTX 4090 24 Go, en configuration 8 GPU à Stockholm, s'adresse à la R&D
              et aux projets à budget contraint.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Tarifs indicatifs : combien coûte la location d'un GPU ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Les repères ci-dessous sont des équivalents horaires dérivés des prix mensuels de
              notre catalogue (base 730 h/mois, hors frais d'installation). Ce sont des ordres de
              grandeur constatés, selon configuration et engagement — jamais des prix garantis.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>NVIDIA H100 80 Go : ≈ 2,9 à 3,8 €/GPU/h</li>
              <li>NVIDIA A100 80 Go : ≈ 1,6 à 1,8 €/GPU/h</li>
              <li>NVIDIA L40S 48 Go : ≈ 1,5 €/GPU/h</li>
              <li>NVIDIA RTX 4090 24 Go : ≈ 1,2 €/GPU/h</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Le prix final varie selon la gamme et la génération du GPU, la taille du cluster, la
              durée d'engagement, la localisation, le niveau de SLA, ainsi que le réseau et le
              stockage associés. D'éventuels frais d'installation peuvent s'appliquer en sus de la
              souscription mensuelle.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Pour le détail gamme par gamme et les facteurs de variation, consultez{" "}
              <Link
                href="/gpu-as-a-service/prix-location-gpu/"
                className="text-accent hover:underline"
              >
                notre guide des prix de location de GPU
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Acheter ou louer ses GPU : CAPEX contre OPEX</h2>
            <p className="text-muted-foreground leading-relaxed">
              Acheter des serveurs GPU relève de l'investissement (CAPEX) : décaissement initial
              important, cycle d'achat et d'installation, puis exploitation à votre charge —
              hébergement, énergie, refroidissement, maintenance — avec un risque d'obsolescence
              intégralement porté par l'acheteur.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Louer relève de la charge d'exploitation (OPEX) : démarrage rapide, budget mensuel
              lissé, capacité ajustable, risque matériel porté par le fournisseur. C'est le modèle
              de DatacenterMarket : location d'infrastructure dédiée en souscription mensuelle,
              sans vente de matériel.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              L'achat garde du sens pour une charge stable qui saturera l'infrastructure plusieurs
              années, avec une équipe pour l'exploiter. La location s'impose pour un besoin
              ponctuel, évolutif ou incertain, ou quand la rapidité de mise sur le marché prime.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Délais de mise à disposition : de 24 h à 7 jours</h2>
            <p className="text-muted-foreground leading-relaxed">
              Sur notre catalogue : dès 24 h pour certains clusters H100, 48 h pour les
              configurations RTX 4090, 72 h pour le L40S, et 6 à 7 jours pour les pods A100.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Notre promesse produit : une capacité mobilisée en 72 h par appel au marché sur les
              configurations phares — à comparer aux cycles d'achat de serveurs (commande,
              livraison, installation), sensiblement plus longs.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Souveraineté et RGPD : où tournent vos GPU ?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Toutes les offres de notre catalogue sont hébergées dans l'Union européenne —
              Francfort, Paris, Amsterdam, Varsovie, Madrid, Dublin, Stockholm — avec résidence des
              données dans l'UE et conformité RGPD.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Une configuration du catalogue est hébergée à Paris. Si votre projet exige un
              hébergement 100 % France, nous pouvons le rechercher via l'appel au marché, selon la
              disponibilité des fournisseurs partenaires.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Les certifications (SecNumCloud, HDS, ISO 27001…) relèvent de chaque fournisseur :
              nous ne les revendiquons pas en leur nom, mais en faisons un critère à vérifier
              contractuellement. Pour approfondir, consultez notre page dédiée au{" "}
              <Link
                href="/gpu-as-a-service/gpu-souverain-france/"
                className="text-accent hover:underline"
              >
                GPU souverain et à la conformité RGPD
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Comment fonctionne DatacenterMarket ?</h2>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket est un intermédiaire de mise en relation édité par Anavim Advisory
              SAS (Paris) : nous ne possédons ni n'exploitons les GPU, nous organisons la mise en
              concurrence de fournisseurs européens. Le parcours tient en quatre étapes.
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
              <li>
                Décrivez votre besoin : type de charge de travail (entraînement, fine-tuning,
                inférence), nombre de GPU, budget et contraintes, via notre formulaire en ligne.
              </li>
              <li>
                Comparez jusqu'à trois offres : notre moteur de comparaison retient l'offre au
                meilleur rapport qualité/prix, la plus rapide à déployer et la moins chère.
              </li>
              <li>
                Commandez et payez en ligne : paiement sécurisé via Stripe, en souscription
                mensuelle.
              </li>
              <li>
                Suivez le provisionnement : le fournisseur met l'infrastructure à disposition ;
                vous suivez l'avancement depuis votre tableau de bord client.
              </li>
            </ol>
            <p className="text-muted-foreground leading-relaxed">
              Prêt à comparer ?{" "}
              <Link href="/workload" className="text-accent hover:underline">
                Décrivez votre charge de travail
              </Link>{" "}
              et recevez jusqu'à trois offres. Pour une vue d'ensemble du service, retrouvez aussi{" "}
              <Link href="/" className="text-accent hover:underline">
                la page d'accueil de DatacenterMarket
              </Link>
              .
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Questions fréquentes sur le GPU as a Service</h2>
            <div className="space-y-6">
              {GAAS_FAQ.map(item => (
                <div key={item.question} className="space-y-2">
                  <h3 className="text-xl font-semibold">{item.question}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-border/50 pt-10 text-center space-y-6">
            <h2 className="text-3xl font-bold">Décrivez votre besoin, le marché répond</h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Quelques minutes suffisent pour décrire votre charge de travail et comparer jusqu'à
              trois offres de nos fournisseurs partenaires.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Décrire mon besoin GPU
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
