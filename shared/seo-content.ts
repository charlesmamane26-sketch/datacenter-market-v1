/**
 * Contenu SEO structuré partagé entre les pages éditoriales (client) et les
 * balisages JSON-LD (SeoManager + prérendu) : FAQ de la page pilier, builders
 * Service et FAQPage. Même contrainte que shared/seo.ts : agnostique de
 * l'environnement.
 *
 * Véracité : toute donnée chiffrée dérive du catalogue (server/seed.ts) ;
 * les points non confirmés sont formulés « à confirmer via l'appel au marché »
 * (suivi éditorial : voir les marqueurs [À VALIDER] du récapitulatif de mission).
 */
// Helper local (dupliqué de shared/seo.ts) pour garder ce module sans import :
// seo.ts importe seo-content.ts, l'inverse créerait un cycle.
const absoluteUrl = (base: string, path: string) => base.replace(/\/+$/, "") + path;

export type FaqItem = { question: string; answer: string };

/** FAQ de la page pilier /gpu-as-a-service/ — balisée FAQPage. */
export const GAAS_FAQ: FaqItem[] = [
  {
    question: "Qu'est-ce que le GPU as a Service ?",
    answer:
      "C'est la location de puissance de calcul GPU hébergée en datacenter, en souscription mensuelle, plutôt que l'achat de serveurs. L'organisation accède à une infrastructure dédiée provisionnée par un fournisseur et la paie en charge d'exploitation. Sur DatacenterMarket, plusieurs fournisseurs européens sont mis en concurrence sur votre besoin.",
  },
  {
    question: "Combien coûte la location d'un GPU H100 ?",
    answer:
      "Sur notre catalogue, l'équivalent horaire dérivé des prix mensuels se situe entre 2,9 et 3,8 €/GPU/h environ pour un H100 80 Go (base 730 h/mois, hors frais d'installation). Ce sont des ordres de grandeur selon configuration et engagement, pas des prix garantis.",
  },
  {
    question: "Quels sont les délais pour obtenir des GPU ?",
    answer:
      "De 24 h à 7 jours selon la configuration : dès 24 h sur certains clusters H100, 48 h à 72 h sur les configurations phares, 6 à 7 jours pour les pods A100. Notre promesse produit : capacité mobilisée en 72 h par appel au marché.",
  },
  {
    question: "Peut-on héberger ses GPU en France ?",
    answer:
      "Une configuration de notre catalogue est hébergée à Paris, et toutes les offres résident dans l'UE, en conformité RGPD. Un hébergement 100 % France peut être recherché via l'appel au marché, selon la disponibilité des fournisseurs partenaires.",
  },
  {
    question: "Vaut-il mieux louer ou acheter ses GPU ?",
    answer:
      "L'achat (CAPEX) se justifie pour une charge stable qui saturera le matériel plusieurs années, avec une équipe pour l'exploiter. La location (OPEX) l'emporte quand le besoin est ponctuel, évolutif ou urgent : démarrage rapide, budget mensuel, risque d'obsolescence porté par le fournisseur.",
  },
  {
    question: "Quelle gamme GPU choisir pour l'inférence LLM ?",
    answer:
      "Le NVIDIA L40S 48 Go est conçu pour l'inférence en production. Pour de très grands modèles ou des contextes longs, des GPU à forte mémoire comme le H200 (141 Go) peuvent être recherchés via l'appel au marché, selon disponibilité. Pour le prototypage, la RTX 4090 24 Go reste l'option la plus économique de notre catalogue.",
  },
  {
    question: "DatacenterMarket est-il un fournisseur de cloud ?",
    answer:
      "Non. DatacenterMarket est une place de marché éditée par Anavim Advisory SAS : nous ne possédons ni n'exploitons d'infrastructure. Nous mettons en concurrence des fournisseurs partenaires et vous proposons jusqu'à trois offres, à commander et payer en ligne.",
  },
  {
    question: "Peut-on louer des H200 ou des B200 ?",
    answer:
      "Ces gammes ne figurent pas à notre catalogue standard à ce jour. Elles peuvent être mobilisées via l'appel au marché : décrivez votre besoin et nous consultons nos fournisseurs partenaires — disponibilité et tarifs à confirmer.",
  },
];

/** JSON-LD Service pour la page pilier. */
export function serviceJsonLd(base: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": absoluteUrl(base, "/gpu-as-a-service/#service"),
    name: "GPU as a Service",
    serviceType: "Location de capacité GPU en datacenter (place de marché)",
    description:
      "Place de marché de capacité GPU : mise en concurrence de fournisseurs européens, jusqu'à trois offres comparées, capacité mobilisée en 72 h par appel au marché.",
    provider: { "@id": absoluteUrl(base, "/#organization") },
    areaServed: "Europe",
    url: absoluteUrl(base, "/gpu-as-a-service/"),
  };
}

/** JSON-LD FAQPage à partir d'une liste de questions/réponses. */
export function faqJsonLd(items: FaqItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
