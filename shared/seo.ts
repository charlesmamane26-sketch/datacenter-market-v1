/**
 * Source de vérité du SEO par route, partagée entre :
 *  - le client (client/src/components/SeoManager.tsx) — applique les balises dans <head> ;
 *  - les scripts de build (scripts/generate-seo-files.ts, scripts/prerender.ts) —
 *    génèrent sitemap.xml, robots.txt et les snapshots HTML.
 * Ce module doit rester agnostique de l'environnement : pas de `window`,
 * pas de `process`, pas de `import.meta`.
 */
import { GAAS_FAQ, GAAS_FAQ_EN, faqJsonLd, serviceJsonLd, serviceJsonLdEn } from "./seo-content";

export const SITE_NAME = "DatacenterMarket";

/**
 * Domaine canonique de production. [À VALIDER : domaine définitif]
 * Surcharger via VITE_SITE_URL (client + scripts de build).
 */
export const DEFAULT_SITE_URL = "https://www.datacentermarket.fr";

/**
 * Image de partage social (Open Graph / Twitter) par défaut, servie depuis
 * client/public. NB : un rendu PNG/JPG 1200×630 est recommandé pour un aperçu
 * fiable sur LinkedIn/Facebook/Twitter (le SVG n'est pas rendu par tous).
 */
export const DEFAULT_OG_IMAGE = "/og-cover.svg";

export type BreadcrumbItem = { name: string; path: string };

export type RouteSeo = {
  /** motif de route wouter, ex. "/offer-detail/:offerId" */
  pattern: string;
  /**
   * Chemin canonique absolu (sans domaine). Les routes prérendues autres que "/"
   * sont servies comme répertoires par express.static → forme avec slash final.
   */
  canonicalPath: string;
  /** ≤ 60 caractères */
  title: string;
  /** ≤ 155 caractères */
  description: string;
  /** true → meta robots "noindex,nofollow" (tunnel transactionnel, dashboards) */
  noindex?: boolean;
  /** true → listée dans sitemap.xml et prérendue au build */
  indexable?: boolean;
  breadcrumb?: BreadcrumbItem[];
  /** JSON-LD additionnel propre à la route (Service, FAQPage…) */
  extraJsonLd?: (base: string) => object[];
  /** Image OG spécifique à la route (sinon DEFAULT_OG_IMAGE). Chemin sous /public. */
  ogImage?: string;
  /** Langue de la page (défaut "fr"). Pilote <html lang> et og:locale. */
  lang?: "fr" | "en";
  /**
   * Alternates hreflang du cluster de langue (réciproques, identiques entre
   * versions fr/en d'une même page). Défaut si absent : fr-FR + x-default
   * auto-référents (comportement mono-langue).
   */
  hreflang?: { hreflang: string; path: string }[];
};

/** Alternates hreflang partagés par l'accueil FR (/) et EN (/en/). */
const HOME_HREFLANG: { hreflang: string; path: string }[] = [
  { hreflang: "fr-FR", path: "/" },
  { hreflang: "en", path: "/en/" },
  { hreflang: "x-default", path: "/" },
];

/** Clusters hreflang des pages de contenu (pilier + satellites), réciproques fr/en. */
const PILLAR_HREFLANG: { hreflang: string; path: string }[] = [
  { hreflang: "fr-FR", path: "/gpu-as-a-service/" },
  { hreflang: "en", path: "/en/gpu-as-a-service/" },
  { hreflang: "x-default", path: "/gpu-as-a-service/" },
];
const PRICING_HREFLANG: { hreflang: string; path: string }[] = [
  { hreflang: "fr-FR", path: "/gpu-as-a-service/prix-location-gpu/" },
  { hreflang: "en", path: "/en/gpu-as-a-service/gpu-rental-pricing/" },
  { hreflang: "x-default", path: "/gpu-as-a-service/prix-location-gpu/" },
];
const RENTAL_HREFLANG: { hreflang: string; path: string }[] = [
  { hreflang: "fr-FR", path: "/gpu-as-a-service/location-gpu/" },
  { hreflang: "en", path: "/en/gpu-as-a-service/gpu-rental/" },
  { hreflang: "x-default", path: "/gpu-as-a-service/location-gpu/" },
];
const COLOCATION_HREFLANG: { hreflang: string; path: string }[] = [
  { hreflang: "fr-FR", path: "/colocation-datacenter/" },
  { hreflang: "en", path: "/en/datacenter-colocation/" },
  { hreflang: "x-default", path: "/colocation-datacenter/" },
];
const SOVEREIGN_HREFLANG: { hreflang: string; path: string }[] = [
  { hreflang: "fr-FR", path: "/gpu-as-a-service/gpu-souverain-france/" },
  { hreflang: "en", path: "/en/gpu-as-a-service/sovereign-gpu-europe/" },
  { hreflang: "x-default", path: "/gpu-as-a-service/gpu-souverain-france/" },
];

export const SEO_ROUTES: RouteSeo[] = [
  {
    pattern: "/",
    canonicalPath: "/",
    title: "Comparez les offres GPU as a Service | DatacenterMarket",
    description:
      "DatacenterMarket centralise les offres GPU as a Service des fournisseurs européens : comparez prix, délais et SLA en un appel au marché. Hébergement UE, RGPD.",
    indexable: true,
    lang: "fr",
    hreflang: HOME_HREFLANG,
    extraJsonLd: base => [webSiteJsonLd(base), serviceJsonLd(base), faqJsonLd(GAAS_FAQ)],
  },
  {
    pattern: "/en",
    canonicalPath: "/en/",
    title: "Compare GPU-as-a-Service offers | DatacenterMarket",
    description:
      "DatacenterMarket centralises GPU-as-a-Service offers from EU providers: compare pricing, lead times and SLAs in one market call. EU-hosted, GDPR-compliant.",
    indexable: true,
    lang: "en",
    hreflang: HOME_HREFLANG,
    extraJsonLd: base => [webSiteJsonLdEn(base), serviceJsonLdEn(base), faqJsonLd(GAAS_FAQ_EN)],
  },
  {
    pattern: "/gpu-as-a-service",
    canonicalPath: "/gpu-as-a-service/",
    title: "GPU as a Service : comparer les offres du marché",
    description:
      "Le comparateur GPU as a Service : offres H100, A100, L40S des fournisseurs européens centralisées. Jusqu'à 3 offres comparées, capacité en 72 h, RGPD.",
    indexable: true,
    lang: "fr",
    hreflang: PILLAR_HREFLANG,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "GPU as a Service", path: "/gpu-as-a-service/" },
    ],
    extraJsonLd: base => [serviceJsonLd(base), faqJsonLd(GAAS_FAQ)],
  },
  {
    pattern: "/en/gpu-as-a-service",
    canonicalPath: "/en/gpu-as-a-service/",
    title: "GPU as a Service: compare offers across the market",
    description:
      "The GPU-as-a-Service comparison platform: H100, A100, L40S offers from EU providers, centralised. Up to 3 quotes compared, capacity in 72 h, GDPR.",
    indexable: true,
    lang: "en",
    hreflang: PILLAR_HREFLANG,
    breadcrumb: [
      { name: "Home", path: "/en/" },
      { name: "GPU as a Service", path: "/en/gpu-as-a-service/" },
    ],
    extraJsonLd: base => [serviceJsonLdEn(base), faqJsonLd(GAAS_FAQ_EN)],
  },
  {
    pattern: "/gpu-as-a-service/prix-location-gpu",
    canonicalPath: "/gpu-as-a-service/prix-location-gpu/",
    title: "Prix GPU comparés : H100, A100, L40S en €/GPU/h",
    description:
      "Prix de location GPU comparés sur le marché : H100 ≈ 2,9–3,8 €/GPU/h, A100, L40S, RTX 4090. Facteurs de variation et offre ferme via appel au marché.",
    indexable: true,
    lang: "fr",
    hreflang: PRICING_HREFLANG,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "GPU as a Service", path: "/gpu-as-a-service/" },
      { name: "Prix de location GPU", path: "/gpu-as-a-service/prix-location-gpu/" },
    ],
  },
  {
    pattern: "/en/gpu-as-a-service/gpu-rental-pricing",
    canonicalPath: "/en/gpu-as-a-service/gpu-rental-pricing/",
    title: "GPU prices compared: H100, A100, L40S in €/GPU/h",
    description:
      "GPU rental prices compared across the market: H100 ≈ €2.9–3.8/GPU/h, plus A100, L40S, RTX 4090. Cost drivers and a firm quote via a market call.",
    indexable: true,
    lang: "en",
    hreflang: PRICING_HREFLANG,
    breadcrumb: [
      { name: "Home", path: "/en/" },
      { name: "GPU as a Service", path: "/en/gpu-as-a-service/" },
      { name: "GPU rental pricing", path: "/en/gpu-as-a-service/gpu-rental-pricing/" },
    ],
  },
  {
    pattern: "/gpu-as-a-service/location-gpu",
    canonicalPath: "/gpu-as-a-service/location-gpu/",
    title: "Location GPU : capacité dédiée comparée sur le marché",
    description:
      "Louer des GPU dédiés (H100, A100, L40S) à l'engagement mensuel : coût prévisible, performances constantes, RGPD. Offres du marché comparées en un appel.",
    indexable: true,
    lang: "fr",
    hreflang: RENTAL_HREFLANG,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "GPU as a Service", path: "/gpu-as-a-service/" },
      { name: "Location de GPU", path: "/gpu-as-a-service/location-gpu/" },
    ],
  },
  {
    pattern: "/en/gpu-as-a-service/gpu-rental",
    canonicalPath: "/en/gpu-as-a-service/gpu-rental/",
    title: "GPU rental: dedicated capacity compared on the market",
    description:
      "Rent dedicated GPUs (H100, A100, L40S) on a monthly commitment: predictable cost, constant performance, GDPR. Market offers compared in one call.",
    indexable: true,
    lang: "en",
    hreflang: RENTAL_HREFLANG,
    breadcrumb: [
      { name: "Home", path: "/en/" },
      { name: "GPU as a Service", path: "/en/gpu-as-a-service/" },
      { name: "GPU rental", path: "/en/gpu-as-a-service/gpu-rental/" },
    ],
  },
  {
    pattern: "/colocation-datacenter",
    canonicalPath: "/colocation-datacenter/",
    title: "Colocation datacenter : comparer les offres du marché",
    description:
      "Location de capacité datacenter — baies, kW, salles privatives : DatacenterMarket centralise les offres de colocation des opérateurs européens. RGPD.",
    indexable: true,
    lang: "fr",
    hreflang: COLOCATION_HREFLANG,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Colocation datacenter", path: "/colocation-datacenter/" },
    ],
  },
  {
    pattern: "/en/datacenter-colocation",
    canonicalPath: "/en/datacenter-colocation/",
    title: "Datacenter colocation: compare market offers",
    description:
      "Datacenter capacity rental — racks, kW, private suites: DatacenterMarket centralises colocation offers from European operators in one market call. GDPR.",
    indexable: true,
    lang: "en",
    hreflang: COLOCATION_HREFLANG,
    breadcrumb: [
      { name: "Home", path: "/en/" },
      { name: "Datacenter colocation", path: "/en/datacenter-colocation/" },
    ],
  },
  {
    pattern: "/gpu-as-a-service/gpu-souverain-france",
    canonicalPath: "/gpu-as-a-service/gpu-souverain-france/",
    title: "GPU souverain : comparer les offres UE et France",
    description:
      "Comparez les offres GPU souverain du marché : hébergement UE dont Paris, conformité RGPD, jusqu'à 3 offres via appel au marché, capacité en 72 h.",
    indexable: true,
    lang: "fr",
    hreflang: SOVEREIGN_HREFLANG,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "GPU as a Service", path: "/gpu-as-a-service/" },
      { name: "GPU souverain France", path: "/gpu-as-a-service/gpu-souverain-france/" },
    ],
  },
  {
    pattern: "/en/gpu-as-a-service/sovereign-gpu-europe",
    canonicalPath: "/en/gpu-as-a-service/sovereign-gpu-europe/",
    title: "Sovereign GPU: compare EU-hosted offers",
    description:
      "Compare sovereign GPU offers across the market: EU-hosted including Paris, GDPR-compliant, up to 3 quotes via a market call, capacity within 72 h.",
    indexable: true,
    lang: "en",
    hreflang: SOVEREIGN_HREFLANG,
    breadcrumb: [
      { name: "Home", path: "/en/" },
      { name: "GPU as a Service", path: "/en/gpu-as-a-service/" },
      { name: "Sovereign GPU in Europe", path: "/en/gpu-as-a-service/sovereign-gpu-europe/" },
    ],
  },
  {
    pattern: "/terms",
    canonicalPath: "/terms/",
    title: "Conditions générales d'utilisation | DatacenterMarket",
    description:
      "Conditions générales d'utilisation de DatacenterMarket, place de marché de capacité GPU et datacenter éditée par Anavim Advisory SAS.",
    indexable: true,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Conditions générales d'utilisation", path: "/terms/" },
    ],
  },
  {
    pattern: "/privacy",
    canonicalPath: "/privacy/",
    title: "Politique de confidentialité | DatacenterMarket",
    description:
      "Politique de confidentialité de DatacenterMarket : données collectées, finalités, durées de conservation et droits RGPD (accès, effacement).",
    indexable: true,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Politique de confidentialité", path: "/privacy/" },
    ],
  },
  {
    pattern: "/legal",
    canonicalPath: "/legal/",
    title: "Mentions légales | DatacenterMarket",
    description:
      "Mentions légales du site DatacenterMarket, édité par Anavim Advisory SAS — 10 rue du Colisée, 75008 Paris, France.",
    indexable: true,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Mentions légales", path: "/legal/" },
    ],
  },
  // ---- Tunnel transactionnel et dashboards : jamais indexés ----
  {
    pattern: "/workload",
    canonicalPath: "/workload",
    title: "Décrire votre besoin GPU | DatacenterMarket",
    description:
      "Décrivez votre charge de travail IA pour recevoir jusqu'à 3 offres de capacité GPU adaptées.",
    noindex: true,
  },
  {
    pattern: "/processing",
    canonicalPath: "/processing",
    title: "Analyse de votre besoin | DatacenterMarket",
    description: "Analyse de votre besoin et mise en concurrence du marché en cours.",
    noindex: true,
  },
  {
    pattern: "/results",
    canonicalPath: "/results",
    title: "Offres recommandées | DatacenterMarket",
    description: "Comparez les offres de capacité GPU recommandées pour votre besoin.",
    noindex: true,
  },
  {
    pattern: "/offer-detail/:offerId",
    canonicalPath: "/offer-detail",
    title: "Détail de l'offre | DatacenterMarket",
    description: "Détail d'une offre de capacité GPU proposée pour votre besoin.",
    noindex: true,
  },
  {
    pattern: "/checkout",
    canonicalPath: "/checkout",
    title: "Commande | DatacenterMarket",
    description: "Finalisation de votre commande de capacité GPU.",
    noindex: true,
  },
  {
    pattern: "/confirmation",
    canonicalPath: "/confirmation",
    title: "Confirmation de commande | DatacenterMarket",
    description: "Confirmation de votre commande de capacité GPU.",
    noindex: true,
  },
  {
    pattern: "/login",
    canonicalPath: "/login",
    title: "Connexion | DatacenterMarket",
    description: "Connectez-vous à votre espace client ou administrateur DatacenterMarket.",
    noindex: true,
  },
  {
    pattern: "/dashboard",
    canonicalPath: "/dashboard",
    title: "Tableau de bord client | DatacenterMarket",
    description: "Suivi de vos commandes et de votre infrastructure GPU.",
    noindex: true,
  },
  {
    pattern: "/admin",
    canonicalPath: "/admin",
    title: "Administration | DatacenterMarket",
    description: "Espace d'administration DatacenterMarket.",
    noindex: true,
  },
  {
    pattern: "/404",
    canonicalPath: "/404",
    title: "Page introuvable | DatacenterMarket",
    description: "La page demandée n'existe pas ou n'est plus disponible.",
    noindex: true,
  },
];

/**
 * Retrouve la config SEO d'un pathname (motifs à paramètre, slash final, casse).
 * Insensible à la casse, comme le matcher de wouter (regexparam compile en /…/i).
 */
export function matchRouteSeo(pathname: string): RouteSeo | undefined {
  const lower = pathname.toLowerCase();
  const norm = lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
  return SEO_ROUTES.find(route => {
    if (!route.pattern.includes(":")) return route.pattern === norm;
    const prefix = route.pattern.slice(0, route.pattern.indexOf(":"));
    if (!norm.startsWith(prefix)) return false;
    const rest = norm.slice(prefix.length);
    return rest.length > 0 && !rest.includes("/");
  });
}

export function absoluteUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + path;
}

/**
 * Chemin de la version d'une route dans l'autre langue (pour le sélecteur de
 * langue), lu depuis le cluster hreflang réciproque. Renvoie null si la page
 * n'a pas d'équivalent déclaré dans l'autre langue.
 */
export function alternatePath(route: RouteSeo, targetLang: "fr" | "en"): string | null {
  const wanted = targetLang === "en" ? "en" : "fr-FR";
  const alt = route.hreflang?.find(a => a.hreflang === wanted);
  return alt ? alt.path : null;
}

export function organizationJsonLd(base: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl(base, "/#organization"),
    name: SITE_NAME,
    legalName: "Anavim Advisory SAS",
    url: absoluteUrl(base, "/"),
    logo: absoluteUrl(base, "/favicon.svg"),
    description:
      "La plateforme qui centralise les offres GPU as a Service du marché : fournisseurs européens mis en concurrence, offres comparées en un appel au marché, hébergement UE conforme RGPD.",
    // Marchés visés — signal géographique pour la France et l'UE.
    areaServed: ["FR", "BE", "LU", "CH", "EU"],
    // Profils officiels rattachés (désambiguïsation d'entité).
    sameAs: ["https://www.anavimadvisory.com"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "10 rue du Colisée",
      postalCode: "75008",
      addressLocality: "Paris",
      addressCountry: "FR",
    },
  };
}

/** JSON-LD WebSite (émis sur l'accueil) : nom du site, langue, éditeur. */
export function webSiteJsonLd(base: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl(base, "/#website"),
    name: SITE_NAME,
    url: absoluteUrl(base, "/"),
    inLanguage: "fr-FR",
    publisher: { "@id": absoluteUrl(base, "/#organization") },
  };
}

/** WebSite JSON-LD (version anglaise, émis sur /en). */
export function webSiteJsonLdEn(base: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl(base, "/en/#website"),
    name: SITE_NAME,
    url: absoluteUrl(base, "/en/"),
    inLanguage: "en",
    publisher: { "@id": absoluteUrl(base, "/#organization") },
  };
}

// ---- Internationalisation : hreflang / lang / og:locale par route ----

/** `<html lang>` de la route (défaut fr). */
export function htmlLang(route: RouteSeo): string {
  return route.lang ?? "fr";
}

/** `og:locale` de la route. */
export function ogLocale(route: RouteSeo): string {
  return route.lang === "en" ? "en_US" : "fr_FR";
}

/**
 * Liens hreflang à émettre pour une route. Si le cluster est déclaré
 * (route.hreflang), on l'utilise tel quel (réciproque fr/en/x-default) ; sinon
 * on retombe sur fr-FR + x-default auto-référents (pages mono-langue).
 */
export function hreflangAlternates(
  route: RouteSeo,
  base: string,
): { hreflang: string; href: string }[] {
  const canonical = absoluteUrl(base, route.canonicalPath);
  if (route.hreflang?.length) {
    return route.hreflang.map(a => ({ hreflang: a.hreflang, href: absoluteUrl(base, a.path) }));
  }
  return [
    { hreflang: route.lang === "en" ? "en" : "fr-FR", href: canonical },
    { hreflang: "x-default", href: canonical },
  ];
}

export function breadcrumbJsonLd(base: string, items: BreadcrumbItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(base, item.path),
    })),
  };
}

/** JSON-LD complet d'une route : Organization partout + breadcrumb/extras éventuels. */
export function jsonLdForRoute(route: RouteSeo, base: string): object[] {
  const blocks: object[] = [organizationJsonLd(base)];
  if (route.breadcrumb?.length) blocks.push(breadcrumbJsonLd(base, route.breadcrumb));
  if (route.extraJsonLd) blocks.push(...route.extraJsonLd(base));
  return blocks;
}
