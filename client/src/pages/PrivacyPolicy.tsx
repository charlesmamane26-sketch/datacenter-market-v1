import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CONSENT_POLICY_UPDATED_AT_FR,
  CONSENT_POLICY_VERSION,
} from "@shared/const";

export default function PrivacyPolicy() {
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
            Retour
          </Button>
          <span className="font-bold text-lg">DatacenterMarket</span>
          <div className="w-20" />
        </div>
      </header>

      {/* Content */}
      <main className="container py-12 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              Politique de Confidentialité
            </h1>
            <p className="text-muted-foreground">
              Dernière mise à jour :{" "}
              <time dateTime={CONSENT_POLICY_VERSION}>{CONSENT_POLICY_UPDATED_AT_FR}</time>
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">1. Introduction</h2>
            <p>
              Anavim Advisory SAS ("nous", "notre" ou "nos") exploite le service
              DatacenterMarket. Cette page vous informe de nos politiques
              concernant la collecte, l'utilisation et la divulgation de données
              personnelles lorsque vous utilisez notre service et les choix que
              vous avez associés à ces données.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">
              2. Collecte et Utilisation des Données
            </h2>
            <p>
              Nous collectons plusieurs types d'informations à différentes fins
              pour vous fournir et améliorer notre service.
            </p>

            <h3 className="text-xl font-semibold mt-4">
              Types de données collectées :
            </h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>Données d'identification</strong> : Nom, prénom, email,
                téléphone, entreprise
              </li>
              <li>
                <strong>Données de qualification</strong> : Type de charge de
                travail, besoins en GPU, budget, contraintes d'infrastructure
              </li>
              <li>
                <strong>Données techniques</strong> : Adresse IP, type de
                navigateur, pages visitées
              </li>
              <li>
                <strong>Données de communication</strong> : Contenu des messages
                et demandes de devis
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-4">
              Finalités du traitement :
            </h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                Traiter vos demandes de devis et vous mettre en relation avec
                les fournisseurs appropriés
              </li>
              <li>Améliorer et optimiser notre service</li>
              <li>Vous envoyer des communications pertinentes</li>
              <li>Respecter les obligations légales et réglementaires</li>
              <li>Prévenir la fraude et assurer la sécurité</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">3. Base Légale du Traitement</h2>
            <p>Le traitement de vos données personnelles est fondé sur :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Votre consentement explicite</li>
              <li>L'exécution d'un contrat auquel vous êtes partie</li>
              <li>Le respect d'une obligation légale</li>
              <li>Nos intérêts légitimes</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">4. Partage des Données</h2>
            <p>Vos données peuvent être partagées avec :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                Les fournisseurs de ressources GPU et datacenter pour traiter
                votre demande
              </li>
              <li>
                Les prestataires techniques qui nous aident à exploiter le
                service
              </li>
              <li>Les autorités légales si requis par la loi</li>
            </ul>
            <p className="mt-4">
              Nous ne vendons jamais vos données personnelles à des tiers.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">5. Sécurité des Données</h2>
            <p>
              La sécurité de vos données personnelles est importante pour nous.
              Nous utilisons des mesures de sécurité appropriées, y compris le
              chiffrement SSL, pour protéger vos informations contre l'accès non
              autorisé, l'altération ou la destruction.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">6. Conservation des Données</h2>
            <p>
              Nous conservons vos données personnelles uniquement le temps
              nécessaire aux finalités décrites :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>Prospects non convertis</strong> : 24 mois à compter du
                dernier contact, puis suppression automatique.
              </li>
              <li>
                <strong>Clients et commandes</strong> : pendant la durée de la
                relation contractuelle, puis selon les obligations légales et
                comptables (jusqu'à 10 ans).
              </li>
              <li>
                <strong>Données techniques de navigation</strong> : 13 mois
                maximum.
              </li>
            </ul>
            <p className="mt-4">
              À l'issue de ces durées, vos données sont supprimées ou
              anonymisées.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">7. Vos Droits</h2>
            <p>Vous avez le droit de :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Accéder à vos données personnelles</li>
              <li>Rectifier les données inexactes</li>
              <li>Demander l'effacement de vos données</li>
              <li>Vous opposer au traitement de vos données</li>
              <li>Demander la portabilité de vos données</li>
              <li>Retirer votre consentement à tout moment</li>
            </ul>
            <p className="mt-4">
              Pour exercer ces droits, contactez-nous à l'adresse indiquée
              ci-dessous.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">8. Cookies</h2>
            <p>
              DatacenterMarket utilise des cookies pour améliorer votre
              expérience utilisateur. Vous pouvez contrôler les cookies via les
              paramètres de votre navigateur.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">
              9. Modifications de cette Politique
            </h2>
            <p>
              Nous pouvons mettre à jour cette politique de confidentialité de
              temps à autre. Nous vous notifierons de tout changement important
              par email ou par un avis sur notre site.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">10. Contact</h2>
            <p>
              Si vous avez des questions concernant cette politique de
              confidentialité, veuillez contacter :
            </p>
            <p>
              <strong>Anavim Advisory SAS</strong>
              <br />
              10 Rue du Colisée
              <br />
              75008 Paris, France
              <br />
              <a
                href="https://www.anavimadvisory.com"
                className="text-accent hover:underline"
              >
                www.anavimadvisory.com
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
