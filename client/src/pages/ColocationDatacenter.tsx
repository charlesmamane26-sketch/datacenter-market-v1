import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";
import SiteHeader from "@/components/marketing/SiteHeader";

/**
 * Page satellite SEO « Colocation datacenter » (/colocation-datacenter/).
 * Ouvre le cluster « capacité datacenter hors GPU » (colocation, baies, kW)
 * dans le positionnement comparateur — voir docs/SEO-ROADMAP.md.
 * Véracité : la colocation ne figure PAS au catalogue standard (GPU) ; les
 * offres sont mobilisées via l'appel au marché auprès des opérateurs
 * partenaires — formulé comme tel, sans chiffres inventés.
 */
export default function ColocationDatacenter() {
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
              Colocation datacenter
            </li>
          </ol>
        </nav>

        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Colocation datacenter : la location de capacité classique, comparée sur le marché
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Louer de la capacité datacenter — une baie, une cage, une salle privative, des kW —
              pour y héberger ses propres serveurs reste la voie classique de l'infrastructure :
              vous gardez la maîtrise du matériel, l'opérateur fournit l'énergie, le
              refroidissement, la sécurité physique et la connectivité.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Ce marché est encore plus opaque que celui du GPU : les grilles tarifaires sont
              rarement publiques, les périmètres varient (kW IT ou kW facturés, interconnexions
              incluses ou non) et chaque opérateur impose son format de devis. DatacenterMarket
              applique à la colocation la même méthode qu'au GPU as a Service : un appel au marché
              soumis aux opérateurs partenaires, des offres normalisées, une comparaison sur des
              critères identiques.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Qu'est-ce que la location de capacité datacenter ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              La colocation consiste à installer vos équipements dans un datacenter tiers. Selon le
              besoin, la capacité se loue à plusieurs granularités :
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">L'unité ou la demi-baie</strong> — quelques U
                pour des serveurs isolés, mutualisés dans une baie partagée.
              </li>
              <li>
                <strong className="text-foreground">La baie dédiée (rack 42-47U)</strong> — le
                standard : facturation à la baie avec une enveloppe de puissance (couramment 5 à
                10 kW), ou directement au kW.
              </li>
              <li>
                <strong className="text-foreground">La cage ou la salle privative</strong> — un
                espace clos pour des dizaines de baies, avec contrôle d'accès dédié.
              </li>
              <li>
                <strong className="text-foreground">Le contrat de capacité (kW / MW)</strong> —
                pour les déploiements importants, on ne raisonne plus en baies mais en puissance
                IT réservée, souvent en build-to-suit.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Colocation, cloud ou GPU as a Service : trois façons de consommer l'infrastructure
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              La colocation vous laisse propriétaire du matériel : CAPEX serveurs, mais loyer
              d'hébergement prévisible et maîtrise complète de la pile technique. Le cloud et le{" "}
              <Link href="/gpu-as-a-service/" className="text-accent hover:underline">
                GPU as a Service
              </Link>{" "}
              inversent l'équation : l'infrastructure appartient au fournisseur, vous consommez en
              OPEX. Entre les deux, la{" "}
              <Link href="/gpu-as-a-service/location-gpu/" className="text-accent hover:underline">
                location de GPU dédiés
              </Link>{" "}
              offre l'exclusivité du matériel sans l'acheter.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              La colocation reste le bon choix quand le matériel existe déjà (migration de salle
              serveur), quand la conformité impose la maîtrise physique des équipements, ou quand
              le TCO à long terme d'un parc stable bat le cloud. Et pour l'IA : héberger ses
              propres serveurs GPU en colocation exige des baies haute densité — c'est justement là
              que la comparaison des offres devient critique.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Les critères qui rendent les offres de colocation comparables
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">Le prix complet</strong> — loyer baie ou €/kW,
                frais d'installation, énergie incluse ou refacturée (et à quel tarif), coût des
                interconnexions (cross-connects).
              </li>
              <li>
                <strong className="text-foreground">La densité disponible</strong> — 5 kW par baie
                ne loge pas un serveur GPU moderne ; l'IA exige 20 à 40 kW et plus, souvent avec
                refroidissement liquide ou direct-to-chip.
              </li>
              <li>
                <strong className="text-foreground">La redondance et le niveau de service</strong>{" "}
                — architecture électrique et froid (N+1, 2N), certification ou équivalence Tier,
                SLA de disponibilité et pénalités.
              </li>
              <li>
                <strong className="text-foreground">L'efficacité énergétique (PUE)</strong> — elle
                pilote directement votre facture d'énergie refacturée.
              </li>
              <li>
                <strong className="text-foreground">La connectivité</strong> — opérateurs présents,
                neutralité, accès aux points d'échange et aux clouds.
              </li>
              <li>
                <strong className="text-foreground">La localisation et la juridiction</strong> —
                proximité de vos équipes et de vos utilisateurs, hébergement UE et conformité RGPD,
                jusqu'à l'exigence souveraine (voir notre page{" "}
                <Link href="/gpu-as-a-service/gpu-souverain-france/" className="text-accent hover:underline">
                  GPU souverain en France
                </Link>
                ).
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-bold">
              Comment DatacenterMarket compare les offres de colocation
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              La colocation ne figure pas à notre catalogue standard, qui est aujourd'hui centré
              sur les configurations GPU dédiées. Elle se mobilise par l'appel au marché : décrivez
              votre besoin (nombre de baies ou puissance, densité, localisation, contraintes de
              conformité) et nous consultons les opérateurs de datacenters partenaires — les mêmes
              acteurs qui hébergent les offres GPU de notre place de marché.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Vous recevez des offres normalisées sur les critères ci-dessus, comparables entre
              elles — disponibilité et conditions à confirmer par chaque opérateur.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base"
            >
              <Link href="/workload">
                Décrire mon besoin de capacité datacenter
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Astuce : choisissez le type « Autre » dans le formulaire et précisez baies, kW et
              contraintes dans le champ libre — l'appel au marché en tient compte.
            </p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
