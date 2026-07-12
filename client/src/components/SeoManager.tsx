import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_SITE_URL,
  SITE_NAME,
  absoluteUrl,
  jsonLdForRoute,
  matchRouteSeo,
} from "@shared/seo";

const JSONLD_ATTR = "data-seo-jsonld";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Upsert a <link rel="alternate" hreflang="…"> pointing at `href`. */
function upsertAlternate(hreflang: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(
    `link[rel="alternate"][hreflang="${hreflang}"]`,
  );
  if (!el) {
    el = document.createElement("link");
    el.rel = "alternate";
    el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Applique les balises SEO de la route courante (title, description, robots,
 * canonical, Open Graph/Twitter, JSON-LD) d'après la config partagée shared/seo.ts.
 * Met à jour les balises existantes (celles du HTML prérendu) au lieu de les dupliquer.
 */
export default function SeoManager() {
  const [location] = useLocation();

  useEffect(() => {
    const route = matchRouteSeo(location) ?? matchRouteSeo("/404");
    if (!route) return;

    const base = import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL;
    const canonical = absoluteUrl(base, route.canonicalPath);
    const ogImage = absoluteUrl(base, route.ogImage ?? DEFAULT_OG_IMAGE);

    document.documentElement.lang = "fr";
    document.title = route.title;
    upsertMeta("name", "description", route.description);
    upsertMeta("name", "robots", route.noindex ? "noindex,nofollow" : "index,follow");

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;

    // hreflang : le site est en français. On référence explicitement la version
    // fr et un x-default pointant sur la même URL — base propre pour ajouter une
    // version /en plus tard (il suffira d'ajouter les alternates correspondants).
    upsertAlternate("fr-FR", canonical);
    upsertAlternate("x-default", canonical);

    upsertMeta("property", "og:title", route.title);
    upsertMeta("property", "og:description", route.description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "fr_FR");
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:alt", route.title);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", route.title);
    upsertMeta("name", "twitter:description", route.description);
    upsertMeta("name", "twitter:image", ogImage);

    document.head
      .querySelectorAll(`script[${JSONLD_ATTR}]`)
      .forEach(el => el.remove());
    for (const block of jsonLdForRoute(route, base)) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute(JSONLD_ATTR, "true");
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    }
  }, [location]);

  return null;
}
