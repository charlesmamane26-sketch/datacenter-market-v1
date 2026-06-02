import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LegalNotice() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <span className="font-bold text-lg">DatacenterMarket</span>
          <div className="w-20" />
        </div>
      </header>

      {/* Content */}
      <main className="container py-12 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Mentions Légales</h1>
            <p className="text-muted-foreground">Dernière mise à jour : 27 mai 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">1. Identification de l'Exploitant</h2>
            <p>
              <strong>Nom de l'entreprise :</strong> Anavim Advisory SAS
            </p>
            <p>
              <strong>Adresse :</strong> 10 Rue du Colisée, 75008 Paris, France
            </p>
            <p>
              <strong>Forme juridique :</strong> Société par Actions Simplifiée
            </p>
            <p>
              <strong>Site web :</strong> <a href="https://www.anavimadvisory.com" className="text-accent hover:underline">www.anavimadvisory.com</a>
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">2. Description du Service</h2>
            <p>
              DatacenterMarket est un service d'Anavim Advisory SAS permettant aux utilisateurs de demander des devis 
              pour des ressources de calcul GPU et d'infrastructure datacenter auprès de fournisseurs européens.
            </p>
            <p>
              Anavim Advisory est une boutique de conseil spécialisée en recherche et innovation, travaillant uniquement 
              dans l'intérêt de ses clients. Notre objectif n'est pas de vendre des services mais de créer des opportunités pour nos clients.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">3. Services d'Anavim Advisory</h2>
            <p>
              Anavim Advisory propose les services suivants :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Off Market Investment</strong> : Sélection qualitative d'actifs Off market et quasi Off en France et à l'étranger</li>
              <li><strong>Applied Corporate Finance</strong> : Conseils techniques et financiers sur des sujets de dettes de private equity et de Joint Venture</li>
              <li><strong>Recherche</strong> : Service externalisé d'analyse et de valorisation d'actifs immobiliers</li>
              <li><strong>Product Development</strong> : Développement de produits innovants dans le secteur immobilier</li>
              <li><strong>DatacenterMarket</strong> : Service de mise en relation avec des fournisseurs de ressources de calcul</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">4. Directeur de la Publication</h2>
            <p>
              La responsabilité de la publication du site est assurée par Anavim Advisory SAS.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">5. Hébergement</h2>
            <p>
              Le site DatacenterMarket est hébergé par Manus, une plateforme de développement web et d'applications.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">6. Propriété Intellectuelle</h2>
            <p>
              Tous les éléments du site DatacenterMarket (textes, images, logos, graphiques, vidéos) sont la propriété 
              d'Anavim Advisory SAS ou de ses partenaires et sont protégés par les lois sur la propriété intellectuelle.
            </p>
            <p>
              Aucune reproduction, distribution ou transmission de ces contenus n'est autorisée sans permission écrite préalable.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">7. Responsabilité</h2>
            <p>
              Anavim Advisory s'efforce de fournir des informations exactes et à jour sur DatacenterMarket. 
              Cependant, nous ne garantissons pas l'exactitude, l'exhaustivité ou l'actualité de toutes les informations.
            </p>
            <p>
              Anavim Advisory ne sera pas responsable des dommages directs ou indirects résultant de l'utilisation 
              ou de l'impossibilité d'utiliser le service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">8. Liens Externes</h2>
            <p>
              DatacenterMarket peut contenir des liens vers des sites externes. Anavim Advisory n'est pas responsable 
              du contenu de ces sites externes et ne cautionné pas nécessairement leurs contenus.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">9. Conformité Légale</h2>
            <p>
              DatacenterMarket est exploité conformément aux lois et réglementations françaises et européennes applicables, 
              notamment le Règlement Général sur la Protection des Données (RGPD).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">10. Droit Applicable et Juridiction</h2>
            <p>
              Ces mentions légales sont régies par la loi française. 
              Tout litige relatif à DatacenterMarket sera soumis à la juridiction compétente de Paris.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">11. Contact</h2>
            <p>
              Pour toute question ou réclamation concernant DatacenterMarket, veuillez contacter :
            </p>
            <p>
              <strong>Anavim Advisory SAS</strong><br />
              10 Rue du Colisée<br />
              75008 Paris, France<br />
              <a href="https://www.anavimadvisory.com" className="text-accent hover:underline">www.anavimadvisory.com</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
