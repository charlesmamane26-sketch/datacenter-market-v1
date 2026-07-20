/**
 * Contenu SEO structuré partagé entre les pages éditoriales (client) et les
 * balisages JSON-LD (SeoManager + prérendu) : FAQ de la page pilier, builders
 * Service et FAQPage. Même contrainte que shared/seo.ts : agnostique de
 * l'environnement.
 *
 * Véracité : toute donnée chiffrée dérive du catalogue (server/seed.ts). Les
 * configurations hors catalogue sont présentées comme indisponibles ou à étudier,
 * sans prétendre qu'une consultation fournisseur a déjà eu lieu.
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
      "Parce que les offres sont difficiles à comparer. DatacenterMarket présente son catalogue dans un format commun — prix mensuel, délai indicatif, SLA et localisation — afin de comparer les configurations actuellement référencées.",
  },
  {
    question: "Qu'est-ce que le GPU as a Service ?",
    answer:
      "C'est la location de puissance de calcul GPU hébergée en datacenter, en souscription mensuelle, plutôt que l'achat de serveurs. DatacenterMarket permet de comparer les configurations européennes actuellement référencées dans son catalogue.",
  },
  {
    question: "Combien coûte la location d'un GPU H100 ?",
    answer:
      "Sur notre catalogue, l'équivalent horaire dérivé des prix mensuels se situe entre 2,9 et 3,8 €/GPU/h environ pour un H100 80 Go (base 730 h/mois, hors frais d'installation). Ce sont des ordres de grandeur selon configuration et engagement, pas des prix garantis.",
  },
  {
    question: "Quels sont les délais pour obtenir des GPU ?",
    answer:
      "De 24 h à 7 jours selon la configuration du catalogue : dès 24 h sur certains clusters H100, 48 h à 72 h sur plusieurs configurations et 6 à 7 jours pour les pods A100. Le délai applicable est celui affiché sur l'option choisie.",
  },
  {
    question: "Peut-on héberger ses GPU en France ?",
    answer:
      "Une configuration de notre catalogue est hébergée à Paris et les localisations affichées sont situées dans l'UE. Pour une exigence 100 % France hors catalogue, contactez-nous : disponibilité et conditions restent à confirmer.",
  },
  {
    question: "Vaut-il mieux louer ou acheter ses GPU ?",
    answer:
      "L'achat (CAPEX) se justifie pour une charge stable qui saturera le matériel plusieurs années, avec une équipe pour l'exploiter. La location (OPEX) l'emporte quand le besoin est ponctuel, évolutif ou urgent : démarrage rapide, budget mensuel, risque d'obsolescence porté par le fournisseur.",
  },
  {
    question: "Quelle gamme GPU choisir pour l'inférence LLM ?",
    answer:
      "Le NVIDIA L40S 48 Go est conçu pour l'inférence en production. Les H200 ne figurent pas au catalogue standard et nécessitent une étude de disponibilité. Pour le prototypage, la RTX 4090 24 Go reste l'option la plus économique du catalogue.",
  },
  {
    question: "DatacenterMarket est-il un fournisseur de cloud ?",
    answer:
      "Non. DatacenterMarket est édité par Anavim Advisory SAS et ne possède ni n'exploite l'infrastructure. Le service compare les options distinctes disponibles dans son catalogue ; leur nombre dépend des critères saisis.",
  },
  {
    question: "Peut-on louer des H200 ou des B200 ?",
    answer:
      "Ces gammes ne figurent pas au catalogue standard à ce jour. Vous pouvez nous transmettre le besoin pour étude, mais leur disponibilité et leurs tarifs restent à confirmer.",
  },
];

/** FAQ anglaise pour la landing /en — balisée FAQPage. */
export const GAAS_FAQ_EN: FaqItem[] = [
  {
    question: "Why compare GPU-as-a-Service offers through a marketplace?",
    answer:
      "GPU offers are difficult to compare. DatacenterMarket presents its current catalogue in one format — monthly price, indicative lead time, SLA and location — so referenced configurations can be compared consistently.",
  },
  {
    question: "What is GPU as a Service?",
    answer:
      "It is renting datacenter-hosted GPU compute on a monthly subscription instead of buying servers. DatacenterMarket lets you compare the European configurations currently referenced in its catalogue.",
  },
  {
    question: "How much does it cost to rent an H100 GPU?",
    answer:
      "On our catalogue, the hourly equivalent derived from monthly prices is roughly €2.9–3.8 per H100 80 GB per hour (based on 730 h/month, excluding setup fees). These are orders of magnitude by configuration and commitment, not guaranteed prices.",
  },
  {
    question: "How fast can I get GPUs?",
    answer:
      "From 24 hours to 7 days depending on the catalogue configuration: as fast as 24 h on some H100 clusters, 48–72 h on several configurations, and 6–7 days for A100 pods. The applicable estimate is shown on each option.",
  },
  {
    question: "Can I host GPUs in the EU under GDPR?",
    answer:
      "The locations displayed in our catalogue are in the EU, including a configuration in Paris. For a 100% France requirement outside the catalogue, contact us; availability and terms remain to be confirmed.",
  },
  {
    question: "Is it better to rent or buy GPUs?",
    answer:
      "Buying (CAPEX) makes sense for a stable workload that will saturate the hardware for several years, with a team to operate it. Renting (OPEX) wins when the need is occasional, evolving or urgent: fast start, monthly budget, obsolescence risk carried by the provider.",
  },
  {
    question: "Which GPU range should I choose for LLM inference?",
    answer:
      "The NVIDIA L40S 48 GB is designed for production inference. H200 configurations are not in the standard catalogue and require an availability review. For prototyping, the RTX 4090 24 GB remains the catalogue's most economical option.",
  },
  {
    question: "Is DatacenterMarket a cloud provider?",
    answer:
      "No. DatacenterMarket is operated by Anavim Advisory SAS and neither owns nor runs infrastructure. It compares the distinct options available in its catalogue; the number returned depends on the criteria supplied.",
  },
  {
    question: "Can I rent H200 or B200 GPUs?",
    answer:
      "These ranges are not part of the standard catalogue today. You can submit the requirement for review, but availability and pricing remain to be confirmed.",
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
      "DatacenterMarket compare les configurations GPU as a Service actuellement référencées dans son catalogue européen selon leur prix, leur délai indicatif, leur SLA et leur localisation.",
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
      "DatacenterMarket compares the GPU-as-a-Service configurations currently referenced in its European catalogue by price, indicative lead time, SLA and location.",
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
