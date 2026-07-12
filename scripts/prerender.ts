/**
 * Prérendu au build des routes publiques indexables (Lot 2 SEO).
 *
 * 1) Compile client/src/prerender-entry.tsx en bundle SSR (Vite, API JS).
 * 2) Rend chaque route indexable de shared/seo.ts en HTML statique.
 * 3) Injecte le <head> SEO complet (title, description, canonical, OG, JSON-LD)
 *    et le corps rendu dans le template dist/public/index.html, puis écrit
 *    dist/public/<route>/index.html — servi tel quel par express.static
 *    (serveStatic sert les index de répertoire), sans toucher server/_core.
 *
 * Critère d'acceptation : `curl` sur une route publique retourne le contenu
 * complet (texte, titres, JSON-LD) sans exécuter de JavaScript.
 *
 * Lancé après `vite build` : pnpm prerender (intégré à `pnpm build`).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_SITE_URL,
  SEO_ROUTES,
  SITE_NAME,
  absoluteUrl,
  jsonLdForRoute,
  type RouteSeo,
} from "../shared/seo";

const projectRoot = path.resolve(import.meta.dirname, "..");
const clientRoot = path.join(projectRoot, "client");
const publicDir = path.join(projectRoot, "dist", "public");
const ssrOutDir = path.join(projectRoot, "dist", "prerender");
const base = (process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

const escapeAttr = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function headBlock(route: RouteSeo): string {
  const canonical = absoluteUrl(base, route.canonicalPath);
  const ogImage = absoluteUrl(base, route.ogImage ?? DEFAULT_OG_IMAGE);
  const jsonLd = jsonLdForRoute(route, base)
    .map(
      block =>
        // `<` échappé en < : interdit à "</script>" de casser le document.
        `<script type="application/ld+json" data-seo-jsonld="true">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>`,
    )
    .join("\n    ");
  return [
    `<title>${escapeAttr(route.title)}</title>`,
    `<meta name="description" content="${escapeAttr(route.description)}" />`,
    `<meta name="robots" content="index,follow" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<link rel="alternate" hreflang="fr-FR" href="${canonical}" />`,
    `<link rel="alternate" hreflang="x-default" href="${canonical}" />`,
    `<meta property="og:title" content="${escapeAttr(route.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(route.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(route.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(route.description)}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
    jsonLd,
  ].join("\n    ");
}

const TITLE_RE = /<title>[\s\S]*?<\/title>/;
const DESC_RE = /[ \t]*<meta\s+name="description"[\s\S]*?\/>\s*/;
const ROOT_RE = /<div id="root"><\/div>/;

async function main() {
  const templatePath = path.join(publicDir, "index.html");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template introuvable : ${templatePath} — lancez d'abord vite build.`);
  }
  const template = fs.readFileSync(templatePath, "utf-8");
  if (!TITLE_RE.test(template) || !ROOT_RE.test(template)) {
    throw new Error(
      'Le template dist/public/index.html n\'a pas la forme attendue (<title>…</title> et <div id="root"></div>).',
    );
  }

  // ---- 1) Bundle SSR de l'entrée de prérendu ----
  await build({
    configFile: false,
    root: clientRoot,
    logLevel: "warn",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.join(clientRoot, "src"),
        "@shared": path.join(projectRoot, "shared"),
        "@assets": path.join(projectRoot, "attached_assets"),
      },
    },
    build: {
      ssr: path.join(clientRoot, "src", "prerender-entry.tsx"),
      outDir: ssrOutDir,
      emptyOutDir: true,
    },
  });

  const entryUrl = pathToFileURL(path.join(ssrOutDir, "prerender-entry.js")).href;
  const { render } = (await import(entryUrl)) as { render: (url: string) => string };

  // ---- 2/3) Rendu + injection dans le template ----
  const routes = SEO_ROUTES.filter(r => r.indexable);
  for (const route of routes) {
    const appHtml = render(route.pattern);
    if (!appHtml || appHtml.length < 500) {
      throw new Error(
        `Rendu suspect pour ${route.pattern} (${appHtml?.length ?? 0} caractères) — page absente du Switch de prerender-entry.tsx ?`,
      );
    }
    // Remplacements par fonction : le contenu peut contenir des séquences `$…`
    // que String.replace interpréterait dans une chaîne de remplacement.
    let html = template.replace(DESC_RE, "");
    html = html.replace(TITLE_RE, () => headBlock(route));
    html = html.replace(ROOT_RE, () => `<div id="root">${appHtml}</div>`);

    const outFile =
      route.canonicalPath === "/"
        ? templatePath
        : path.join(publicDir, ...route.canonicalPath.split("/").filter(Boolean), "index.html");
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, "utf-8");
    console.log(
      `[prerender] ${route.canonicalPath} → ${path.relative(projectRoot, outFile)} (${(html.length / 1024).toFixed(1)} ko)`,
    );
  }
  console.log(`[prerender] ${routes.length} route(s) prérendue(s) (base : ${base})`);
}

main().catch(error => {
  console.error("[prerender] Échec :", error);
  process.exit(1);
});
