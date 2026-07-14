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
    question: "Pourquoi comparer les offres GPU as a Service via une place de marché ?",
    answer:
      "Parce que le marché est fragmenté : chaque fournisseur publie ses prix, délais et SLA dans son propre format, quand il les publie. DatacenterMarket centralise ces offres et les normalise (prix mensuel, délai de mobilisation, SLA, localisation) : un seul appel au marché remplace le démarchage fournisseur par fournisseur, et les offres deviennent réellement comparables.",
  },
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

/** FAQ anglaise pour la landing /en — balisée FAQPage. */
export const GAAS_FAQ_EN: FaqItem[] = [
  {
    question: "Why compare GPU-as-a-Service offers through a marketplace?",
    answer:
      "Because the market is fragmented: every provider publishes its pricing, lead times and SLAs in its own format — when it publishes them at all. DatacenterMarket centralises those offers and normalises them (monthly price, mobilisation lead time, SLA, location): one market call replaces provider-by-provider prospecting, and offers become genuinely comparable.",
  },
  {
    question: "What is GPU as a Service?",
    answer:
      "It is renting datacenter-hosted GPU compute on a monthly subscription instead of buying servers. You access dedicated infrastructure provisioned by a provider and pay for it as an operating cost. On DatacenterMarket, several European providers compete on your workload.",
  },
  {
    question: "How much does it cost to rent an H100 GPU?",
    answer:
      "On our catalogue, the hourly equivalent derived from monthly prices is roughly €2.9–3.8 per H100 80 GB per hour (based on 730 h/month, excluding setup fees). These are orders of magnitude by configuration and commitment, not guaranteed prices.",
  },
  {
    question: "How fast can I get GPUs?",
    answer:
      "From 24 hours to 7 days depending on the configuration: as fast as 24 h on some H100 clusters, 48–72 h on flagship configurations, 6–7 days for A100 pods. Our product promise: capacity mobilised within 72 h via a market call.",
  },
  {
    question: "Can I host GPUs in the EU under GDPR?",
    answer:
      "Yes. Every offer in our catalogue is hosted in the EU and GDPR-compliant, including a configuration in Paris. Sovereign, single-country hosting (e.g. 100% France) can be sourced via a market call, subject to partner-provider availability.",
  },
  {
    question: "Is it better to rent or buy GPUs?",
    answer:
      "Buying (CAPEX) makes sense for a stable workload that will saturate the hardware for several years, with a team to operate it. Renting (OPEX) wins when the need is occasional, evolving or urgent: fast start, monthly budget, obsolescence risk carried by the provider.",
  },
  {
    question: "Which GPU range should I choose for LLM inference?",
    answer:
      "The NVIDIA L40S 48 GB is designed for production inference. For very large models or long contexts, high-memory GPUs such as the H200 (141 GB) can be sourced via a market call, subject to availability. For prototyping, the RTX 4090 24 GB remains the most economical option in our catalogue.",
  },
  {
    question: "Is DatacenterMarket a cloud provider?",
    answer:
      "No. DatacenterMarket is a marketplace operated by Anavim Advisory SAS: we neither own nor run infrastructure. We put partner providers in competition and return up to three quotes, ordered and paid online.",
  },
  {
    question: "Can I rent H200 or B200 GPUs?",
    answer:
      "These ranges are not part of our standard catalogue today. They can be mobilised via a market call: describe your need and we consult our partner providers — availability and pricing to be confirmed.",
  },
];

/** JSON-LD Service pour la page pilier. */
export function serviceJsonLd(base: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": absoluteUrl(base, "/gpu-as-a-service/#service"),
    name: "Comparateur d'offres GPU as a Service",
    serviceType: "Centralisation et comparaison d'offres de capacité GPU (place de marché)",
    description:
      "DatacenterMarket centralise les offres GPU as a Service du marché : fournisseurs européens mis en concurrence, jusqu'à trois offres comparées, capacité mobilisée en 72 h par appel au marché.",
    provider: { "@id": absoluteUrl(base, "/#organization") },
    areaServed: "Europe",
    url: absoluteUrl(base, "/gpu-as-a-service/"),
  };
}

/** JSON-LD Service (version anglaise) pour la landing /en. */
export function serviceJsonLdEn(base: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": absoluteUrl(base, "/en/#service"),
    name: "GPU-as-a-Service offer comparison",
    serviceType: "Centralisation and comparison of GPU capacity offers (marketplace)",
    description:
      "DatacenterMarket centralises the market's GPU-as-a-Service offers: EU providers put in competition, up to three quotes compared, capacity mobilised within 72 h via a market call.",
    provider: { "@id": absoluteUrl(base, "/#organization") },
    areaServed: "Europe",
    url: absoluteUrl(base, "/en/"),
    inLanguage: "en",
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
