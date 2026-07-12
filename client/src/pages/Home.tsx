import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Euro, FileSearch, Scale, Shield, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";
import SiteHeader from "@/components/marketing/SiteHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { clearCheckoutIntent, loadCheckoutIntent } from "@/lib/checkoutIntent";

// Resume a checkout interrupted by login: OAuth returns the user to "/", so we
// forward them back to the checkout they started (consuming the intent once).
// Kept in a client-only child because useAuth touches localStorage during render,
// which would crash the build-time prerender (see scripts/prerender.ts).
function CheckoutResume() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const intent = loadCheckoutIntent();
    if (!intent) return;
    clearCheckoutIntent();
    setLocation(`/checkout?offerId=${intent.offerId}&leadId=${intent.leadId}`);
  }, [loading, isAuthenticated, setLocation]);

  return null;
}

/**
 * Page d'accueil (refonte SEO lot 3) : H1 « GPU as a Service », contenu français
 * indexable, maillage vers la page pilier et les satellites, CTA /workload.
 * Véracité : chiffres dérivés du catalogue (server/seed.ts) ; aucune statistique
 * inventée (les anciens « 500+ requests » / « €2M+ » ont été retirés).
 */
export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mounted && <CheckoutResume />}
      <SiteHeader />

      {/* Héro */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                GPU as a Service : votre capacité GPU mobilisée en{" "}
                <span className="text-accent">72 h</span> par appel au marché
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground">
                DatacenterMarket est une place de marché de capacité GPU et datacenter, éditée par
                Anavim Advisory. Vous décrivez votre besoin de calcul IA, nous mettons en
                concurrence nos fournisseurs partenaires en Europe — opérateurs de datacenters et
                clouds GPU — et vous comparez jusqu'à trois offres. Nous sommes un intermédiaire :
                nous ne possédons ni n'exploitons les GPU.
              </p>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Location GPU dédiée en souscription mensuelle, hébergée en France ou ailleurs dans
                l'UE : tout le parcours est en ligne, du formulaire de besoin au paiement, avec
                suivi depuis votre tableau de bord client.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
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
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border hover:bg-card px-8 py-6 text-base"
              >
                <Link href="/gpu-as-a-service/">Découvrir le GPU as a Service</Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 pt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>Résidence des données UE</span>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>Jusqu'à trois offres comparées</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>Paiement en ligne sécurisé</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <div className="max-w-3xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Comment ça marche : de votre besoin à l'infrastructure provisionnée
            </h2>
            <p className="text-lg text-muted-foreground">
              Quatre étapes en ligne — la mise en concurrence, c'est notre rôle.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="tech-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <FileSearch className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">1. Décrivez votre besoin</h3>
              <p className="text-muted-foreground text-sm">
                Type de charge de travail (entraînement, fine-tuning, inférence), nombre de GPU,
                budget et contraintes, via un formulaire en ligne.
              </p>
            </div>
            <div className="tech-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Scale className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">2. Comparez jusqu'à trois offres</h3>
              <p className="text-muted-foreground text-sm">
                Notre moteur de comparaison confronte votre besoin au catalogue et retient l'offre
                au meilleur rapport qualité/prix, la plus rapide à déployer et la moins chère.
              </p>
            </div>
            <div className="tech-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Euro className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">3. Commandez et payez en ligne</h3>
              <p className="text-muted-foreground text-sm">
                Paiement sécurisé (Stripe), facturation mensuelle, frais d'installation éventuels.
              </p>
            </div>
            <div className="tech-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Timer className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">4. Suivez le provisionnement</h3>
              <p className="text-muted-foreground text-sm">
                Le fournisseur retenu met l'infrastructure en service ; vous suivez l'avancement
                depuis votre tableau de bord.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pourquoi une place de marché */}
      <section className="py-20 border-t border-border/50 bg-card/50">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 max-w-3xl">
            Pourquoi passer par une place de marché GPU
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Comparaison systématique</h3>
              <p className="text-muted-foreground">
                Chaque demande déclenche un appel au marché, plutôt qu'une dépendance au tarif d'un
                fournisseur unique.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Prix issus du marché</h3>
              <p className="text-muted-foreground">
                Des offres établies selon configuration et engagement, à partir du catalogue —
                indicatif et évolutif — de nos fournisseurs partenaires.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Délais maîtrisés</h3>
              <p className="text-muted-foreground">
                Dès 24 h sur certaines configurations, 72 h sur plusieurs configurations phares,
                jusqu'à 7 jours pour les options les plus économiques.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Résidence des données dans l'UE</h3>
              <p className="text-muted-foreground">
                Les offres du catalogue sont hébergées dans l'Union européenne, dans une logique de
                conformité RGPD.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gammes GPU */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Gammes GPU disponibles à la location
          </h2>
          <p className="text-muted-foreground mb-6">
            Le catalogue couvre les principaux cas d'usage IA, en configurations dédiées (bare
            metal chez nos fournisseurs partenaires) et facturation mensuelle. Il est indicatif et
            évolutif.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
            <li>
              NVIDIA H100 80 Go — entraînement et fine-tuning exigeants : clusters de 8 à 16 GPU à
              Francfort, Paris et Amsterdam, délais de 24 h à 96 h, SLA de 99,9 % à 99,99 %.
            </li>
            <li>
              NVIDIA A100 80 Go — polyvalent : pods de 4 à 8 GPU à Varsovie et Madrid, délais de 6
              à 7 jours, SLA 99,5 %.
            </li>
            <li>NVIDIA L40S 48 Go — inférence : 8 GPU à Dublin, délai 72 h, SLA 99,5 %.</li>
            <li>
              NVIDIA RTX 4090 24 Go — R&D et budgets contraints : 8 GPU à Stockholm, délai 48 h,
              SLA 99,0 %.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Les H200 et B200 (Blackwell) ne figurent pas au catalogue standard à ce jour ; ils
            peuvent être recherchés via l'appel au marché, selon disponibilité et tarifs des
            fournisseurs. Pour approfondir, consultez notre guide{" "}
            <Link href="/gpu-as-a-service/" className="text-accent hover:underline">
              GPU as a Service : louer des GPU à la demande
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Tarifs */}
      <section className="py-20 border-t border-border/50 bg-card/50">
        <div className="container max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Aperçu des tarifs de location GPU</h2>
          <p className="text-muted-foreground mb-6">
            Ordres de grandeur constatés sur notre catalogue, selon configuration et engagement —
            jamais des prix garantis. Ils dérivent des prix mensuels (base 730 h/mois, hors frais
            d'installation).
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
            <li>NVIDIA H100 80 Go : environ 2,9 à 3,8 €/GPU/h en équivalent horaire.</li>
            <li>NVIDIA A100 80 Go : environ 1,6 à 1,8 €/GPU/h.</li>
            <li>NVIDIA RTX 4090 24 Go : environ 1,2 €/GPU/h pour la R&D.</li>
          </ul>
          <p className="text-muted-foreground">
            Pour le détail par gamme et les facteurs de variation, consultez{" "}
            <Link
              href="/gpu-as-a-service/prix-location-gpu/"
              className="text-accent hover:underline"
            >
              nos repères de prix de la location GPU
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Souveraineté */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Souveraineté et RGPD : un cloud GPU ancré en Europe
          </h2>
          <p className="text-muted-foreground mb-4">
            Toutes les offres du catalogue sont hébergées dans l'Union européenne : la résidence
            des données dans l'UE facilite la mise en conformité RGPD de vos traitements IA.
          </p>
          <p className="text-muted-foreground">
            Une configuration du catalogue est hébergée à Paris ; un hébergement 100 % France peut
            être recherché via l'appel au marché, selon disponibilité des fournisseurs partenaires.
            Les certifications (SecNumCloud, HDS, ISO 27001) relèvent de chaque fournisseur :
            vérifiez-les contractuellement selon vos exigences. Pour aller plus loin :{" "}
            <Link
              href="/gpu-as-a-service/gpu-souverain-france/"
              className="text-accent hover:underline"
            >
              GPU souverain et hébergement en France
            </Link>
            .
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Décrivez votre besoin, le marché répond</h2>
            <p className="text-lg text-muted-foreground">
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
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
