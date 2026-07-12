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

export const SEO_ROUTES: RouteSeo[] = [
  {
    pattern: "/",
    canonicalPath: "/",
    title: "GPU as a Service : capacité GPU en 72 h | DatacenterMarket",
    description:
      "Location GPU dédiée : comparez jusqu'à trois offres de fournisseurs européens et mobilisez votre capacité de calcul IA en 72 h. Hébergement UE, RGPD.",
    indexable: true,
    lang: "fr",
    hreflang: HOME_HREFLANG,
    extraJsonLd: base => [webSiteJsonLd(base)],
  },
  {
    pattern: "/en",
    canonicalPath: "/en/",
    title: "GPU as a Service in Europe — rent H100 GPUs | DatacenterMarket",
    description:
      "European GPU-as-a-Service marketplace: compare up to three quotes from EU providers and get dedicated H100/A100 capacity in 72 h. EU-hosted, GDPR-compliant.",
    indexable: true,
    lang: "en",
    hreflang: HOME_HREFLANG,
    extraJsonLd: base => [webSiteJsonLdEn(base), serviceJsonLdEn(base), faqJsonLd(GAAS_FAQ_EN)],
  },
  {
    pattern: "/gpu-as-a-service",
    canonicalPath: "/gpu-as-a-service/",
    title: "GPU as a Service : louer des GPU H100 à la demande",
    description:
      "Louez des GPU NVIDIA H100, A100, L40S à la demande en Europe. Jusqu'à 3 offres comparées, capacité mobilisée en 72 h, hébergement UE conforme RGPD.",
    indexable: true,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "GPU as a Service", path: "/gpu-as-a-service/" },
    ],
    extraJsonLd: base => [serviceJsonLd(base), faqJsonLd(GAAS_FAQ)],
  },
  {
    pattern: "/gpu-as-a-service/prix-location-gpu",
    canonicalPath: "/gpu-as-a-service/prix-location-gpu/",
    title: "Location GPU : prix indicatifs €/GPU/h – H100, A100, L40S",
    description:
      "Grille indicative de prix de location GPU : H100 ≈ 2,9–3,8 €/GPU/h, A100, L40S, RTX 4090. Facteurs de variation et offre chiffrée via appel au marché.",
    indexable: true,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "GPU as a Service", path: "/gpu-as-a-service/" },
      { name: "Prix de location GPU", path: "/gpu-as-a-service/prix-location-gpu/" },
    ],
  },
  {
    pattern: "/gpu-as-a-service/gpu-souverain-france",
    canonicalPath: "/gpu-as-a-service/gpu-souverain-france/",
    title: "GPU souverain : héberger vos workloads IA en France",
    description:
      "Cloud GPU souverain hébergé en UE, dont Paris : conformité RGPD, jusqu'à 3 offres comparées, capacité mobilisée en 72 h par appel au marché.",
    indexable: true,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "GPU as a Service", path: "/gpu-as-a-service/" },
      { name: "GPU souverain France", path: "/gpu-as-a-service/gpu-souverain-france/" },
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
      "Place de marché de capacité GPU et datacenter : mise en concurrence de fournisseurs européens, offres comparées, hébergement UE conforme RGPD.",
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
