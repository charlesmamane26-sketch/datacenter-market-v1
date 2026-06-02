import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
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
            <h1 className="text-4xl font-bold mb-2">Conditions Générales d'Utilisation</h1>
            <p className="text-muted-foreground">Dernière mise à jour : 27 mai 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">1. Objet et Définitions</h2>
            <p>
              DatacenterMarket est un service fourni par Anavim Advisory SAS, une boutique de conseil spécialisée en recherche et innovation. 
              Le service permet aux utilisateurs de demander des devis pour des ressources de calcul GPU et d'infrastructure datacenter auprès de fournisseurs européens.
            </p>
            <p>
              <strong>Anavim Advisory SAS</strong> - 10 Rue du Colisée, 75008 Paris, France
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">2. Acceptation des Conditions</h2>
            <p>
              En accédant et en utilisant DatacenterMarket, vous acceptez d'être lié par ces conditions générales d'utilisation. 
              Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">3. Utilisation du Service</h2>
            <p>
              Vous vous engagez à utiliser DatacenterMarket uniquement à des fins légales et conformément à toutes les lois et réglementations applicables. 
              Vous ne devez pas :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Utiliser le service de manière frauduleuse ou trompeuse</li>
              <li>Fournir des informations fausses ou inexactes</li>
              <li>Accéder au service de manière non autorisée</li>
              <li>Perturber ou interférer avec le fonctionnement du service</li>
              <li>Utiliser le service pour des activités illégales</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">4. Demandes de Devis</h2>
            <p>
              Les demandes de devis soumises via DatacenterMarket sont traitées par Anavim Advisory et ses partenaires fournisseurs. 
              Les devis fournis sont à titre informatif et ne constituent pas une offre contractuelle. 
              Tout contrat sera conclu directement entre vous et le fournisseur sélectionné.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">5. Propriété Intellectuelle</h2>
            <p>
              Tous les contenus, logos, marques et éléments visuels de DatacenterMarket sont la propriété d'Anavim Advisory SAS ou de ses partenaires. 
              Vous ne pouvez pas reproduire, modifier ou distribuer ces contenus sans autorisation préalable écrite.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">6. Limitation de Responsabilité</h2>
            <p>
              DatacenterMarket est fourni "tel quel" sans garantie d'aucune sorte. Anavim Advisory ne sera pas responsable des dommages directs, 
              indirects, accessoires ou consécutifs résultant de votre utilisation du service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">7. Modifications des Conditions</h2>
            <p>
              Anavim Advisory se réserve le droit de modifier ces conditions à tout moment. 
              Les modifications seront effectives dès leur publication sur le site.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">8. Droit Applicable</h2>
            <p>
              Ces conditions sont régies par la loi française. Tout litige sera soumis à la juridiction compétente de Paris.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">9. Contact</h2>
            <p>
              Pour toute question concernant ces conditions, veuillez contacter :
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
