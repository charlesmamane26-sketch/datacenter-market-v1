/**
 * Génère dist/public/robots.txt et dist/public/sitemap.xml à partir de la
 * config SEO partagée (shared/seo.ts). Lancé après `vite build` :
 *   pnpm seo:files   (intégré à `pnpm build`)
 * Domaine surchargable via VITE_SITE_URL.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SITE_URL, SEO_ROUTES, absoluteUrl } from "../shared/seo";

const base = (process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
const outDir = path.resolve(import.meta.dirname, "..", "dist", "public");

if (!fs.existsSync(outDir)) {
  console.error(`[seo:files] Dossier introuvable : ${outDir} — lancez d'abord vite build.`);
  process.exit(1);
}

// ---- sitemap.xml : uniquement les routes publiques indexables ----
// Pas de <lastmod> : re-tamponner la date à chaque build serait un signal
// inexact que Google ignore (il doit être "consistently accurate").
const urls = SEO_ROUTES.filter(r => r.indexable)
  .map(r => `  <url>\n    <loc>${absoluteUrl(base, r.canonicalPath)}</loc>\n  </url>`)
  .join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap, "utf-8");

// ---- robots.txt : tunnel transactionnel et dashboards exclus du crawl ----
const disallow = SEO_ROUTES.filter(r => r.noindex && r.pattern !== "/404")
  .map(r => (r.pattern.includes(":") ? `${r.canonicalPath}/` : r.canonicalPath))
  .map(p => `Disallow: ${p}`)
  .join("\n");
const robots = `User-agent: *\nAllow: /\n${disallow}\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
fs.writeFileSync(path.join(outDir, "robots.txt"), robots, "utf-8");

console.log(`[seo:files] sitemap.xml (${SEO_ROUTES.filter(r => r.indexable).length} URL) et robots.txt générés dans ${outDir} (base : ${base})`);
