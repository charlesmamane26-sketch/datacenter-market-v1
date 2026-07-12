import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";
import SiteHeader from "@/components/marketing/SiteHeader";

/**
 * Page satellite SEO « GPU souverain France » (/gpu-as-a-service/gpu-souverain-france/).
 * Véracité : une seule configuration hébergée à Paris au catalogue (server/seed.ts,
 * « H100 Rapid Deploy », 8× H100, 24 h, SLA 99,99 %) ; aucune certification revendiquée.
 * [À VALIDER] : disponibilité et conditions d'un hébergement 100 % France via l'appel au marché.
 */
export default function GpuSouverainFrance() {
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
              GPU souverain France
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              GPU souverain : héberger vos workloads IA en France
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Entraîner un modèle sur des données clients, affiner un LLM sur des documents
              internes, servir de l'inférence sur des données réglementées : la localisation de
              votre infrastructure GPU n'est pas un détail technique. C'est un enjeu de conformité
              RGPD et de maîtrise du risque.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DatacenterMarket est une place de marché de capacité GPU éditée par Anavim Advisory.
              Nous ne possédons ni n'exploitons de serveurs : nous mettons en concurrence des
              fournisseurs d'infrastructure européens pour trouver la configuration qui respecte
              vos contraintes de souveraineté. Toutes les offres de notre catalogue sont hébergées
              dans l'Union européenne, dont une configuration à Paris.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Cette page détaille ce qu'une résidence des données UE ou France garantit réellement
              et les critères à vérifier avant de vous engager. Pour une vue d'ensemble, consultez
              notre guide{" "}
              <Link href="/gpu-as-a-service/" className="text-accent hover:underline">
                GPU as a Service
              </Link>
              .
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Pourquoi la souveraineté compte pour vos workloads IA
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Les jeux de données utilisés pour l'entraînement et le fine-tuning contiennent
              souvent des données personnelles, des secrets d'affaires ou des données réglementées.
              Or le RGPD encadre strictement les transferts de données personnelles hors de l'Union
              européenne : héberger le traitement dans l'UE simplifie la démonstration de
              conformité.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              S'ajoute une question de dépendance : un fournisseur soumis au droit d'un pays tiers
              peut relever de législations à portée extraterritoriale, indépendamment de la
              localisation physique des serveurs.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                Conformité RGPD : traitement des données personnelles sur le territoire de l'UE,
                sans mécanisme de transfert à documenter pour l'hébergement lui-même.
              </li>
              <li>
                Protection des actifs : jeux de données d'entraînement, poids de modèles
                propriétaires, données métier réglementées.
              </li>
              <li>
                Maîtrise du risque juridique : entité du fournisseur, droit applicable au contrat,
                chaîne de sous-traitance.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Ce que garantit une résidence des données en UE ou en France
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Une résidence des données UE signifie que vos données sont stockées et traitées dans
              des datacenters situés sur le territoire de l'Union, dans un cadre où le RGPD
              s'applique directement. C'est le socle de l'hébergement IA en Europe.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Soyons précis : la localisation ne règle pas tout. L'entité juridique qui exploite le
              datacenter, sa maison mère éventuelle et ses sous-traitants comptent tout autant. Un
              hébergement en France constitue un niveau d'exigence supplémentaire, parfois requis
              par des politiques internes ou des donneurs d'ordre publics.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Cloud GPU France et UE : ce que propose DatacenterMarket
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Notre rôle est celui d'un intermédiaire. Vous décrivez votre besoin (type de charge
              de travail, nombre de GPU, budget, contraintes de localisation) ; notre moteur de
              comparaison confronte le catalogue et vous propose jusqu'à trois offres de
              fournisseurs partenaires. Commande et paiement se font en ligne, puis le fournisseur
              provisionne l'infrastructure, dont vous suivez le déploiement depuis votre tableau de
              bord.
            </p>
            <h3 className="text-xl font-semibold">Un catalogue hébergé dans l'Union européenne</h3>
            <p className="text-muted-foreground leading-relaxed">
              Toutes les configurations de notre catalogue actuel sont situées dans l'UE :
              Francfort, Paris, Amsterdam, Varsovie, Madrid, Dublin et Stockholm. Il s'agit
              d'infrastructures dédiées (bare metal), en souscription mensuelle.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              À Paris : cluster dédié de 8 GPU NVIDIA H100 80 Go, mise à disposition en 24 h, SLA
              de 99,99 %. Sur l'ensemble de la gamme H100 du catalogue (Francfort, Paris, Amsterdam
              — clusters de 8 à 16 GPU, livrés en 24 h à 96 h, SLA de 99,9 % à 99,99 %), comptez de
              2,9 à 3,8 €/GPU/h en équivalent horaire dérivé des prix mensuels, selon configuration
              et engagement, hors frais d'installation — jamais des prix garantis. Le détail figure
              dans notre{" "}
              <Link
                href="/gpu-as-a-service/prix-location-gpu/"
                className="text-accent hover:underline"
              >
                grille de prix de location GPU
              </Link>
              .
            </p>
            <h3 className="text-xl font-semibold">
              Un hébergement 100 % France par appel au marché
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Si votre cahier des charges impose un hébergement exclusivement en France, nous
              relayons cette exigence auprès de nos fournisseurs partenaires via l'appel au marché.
              La disponibilité et les conditions d'une offre 100 % France dépendent des capacités
              des fournisseurs au moment de la demande. Le processus, lui, ne change pas : appel au
              marché, jusqu'à trois offres comparées, avec un objectif de mise à disposition sous
              72 h dès qu'une offre conforme est identifiée.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Les critères à vérifier chez un fournisseur d'hébergement IA
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Que vous passiez par notre place de marché ou en direct, certains points doivent être
              audités avant tout engagement. Nous ne revendiquons aucune certification à la place
              de nos fournisseurs : ces éléments se vérifient au cas par cas, contrat en main.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                Localisation effective : l'adresse physique du datacenter, pas seulement la
                « région » commerciale affichée.
              </li>
              <li>Entité juridique : qui signe le contrat, sous quel droit, avec quelle maison mère.</li>
              <li>
                Certifications : ISO 27001, SecNumCloud ou HDS selon votre secteur — à demander et
                vérifier directement auprès du fournisseur, périmètre et validité compris.
              </li>
              <li>
                Chaîne de sous-traitance : qui exploite les machines, qui assure la maintenance,
                qui dispose d'un accès physique ou logique.
              </li>
              <li>Engagements contractuels : SLA, notification d'incident, conditions de réversibilité.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Réversibilité et portabilité : limiter la dépendance fournisseur
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              La souveraineté ne se limite pas à la localisation : elle inclut la capacité à
              changer de fournisseur. Les offres de notre catalogue sont des souscriptions
              mensuelles sur infrastructure dédiée, ce qui limite l'engagement dans le temps par
              rapport à des contrats pluriannuels.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Le bare metal dédié joue aussi en votre faveur : vous installez votre propre pile
              logicielle (orchestrateur, conteneurs, frameworks) plutôt que des services managés
              propriétaires (lock-in). Cela réduit le coût d'une migration, sans le supprimer —
              documentez sauvegardes et exports dès le départ.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Prêt à comparer des offres hébergées en UE ? Décrivez votre workload : vous recevez
              jusqu'à trois propositions de nos fournisseurs partenaires — meilleur rapport
              qualité/prix, déploiement le plus rapide, prix le plus bas.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Décrire mon workload
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
          </section>

          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Questions fréquentes sur le GPU souverain</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Qu'est-ce qu'un GPU souverain ?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Il n'existe pas de définition légale unique : l'expression désigne une capacité
                  de calcul GPU opérée dans un cadre juridique maîtrisé — serveurs dans l'UE ou en
                  France, entité soumise au droit européen, garanties contractuelles sur l'accès
                  aux données.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  Vos offres sont-elles certifiées SecNumCloud ou ISO 27001 ?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Non. DatacenterMarket est un intermédiaire : les certifications appartiennent aux
                  fournisseurs et nous n'en revendiquons aucune. Si votre projet en exige une,
                  indiquez-le dans votre demande : nous la relayons dans l'appel au marché, à
                  charge pour vous de vérifier les attestations du fournisseur retenu.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  Puis-je héberger mes workloads IA uniquement en France ?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Notre catalogue comprend une configuration à Paris (cluster de 8 GPU NVIDIA H100,
                  provisionné en 24 h). Pour un besoin 100 % France plus large, nous sollicitons
                  nos fournisseurs partenaires via l'appel au marché ; la disponibilité est à
                  confirmer au cas par cas.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  Combien coûte un cloud GPU hébergé en Europe ?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Sur notre catalogue actuel, les équivalents horaires dérivés des prix mensuels
                  vont d'environ 1,2 €/GPU/h (RTX 4090) à 3,8 €/GPU/h (H100), hors frais
                  d'installation. Ce sont des ordres de grandeur constatés, pas des prix garantis.
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
