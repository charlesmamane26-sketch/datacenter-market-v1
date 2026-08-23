import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export type ServeStaticOptions = {
  /**
   * Tells apart a route the SPA router owns (served as index.html + HTTP 200)
   * from an unknown URL (same shell, but HTTP 404). Without it every bogus URL
   * answers 200 with the prerendered home page — a soft 404 that crawlers index
   * as a duplicate of "/". Defaults to "every path is an app route", which
   * preserves the template's original behaviour.
   */
  isAppRoute?: (pathname: string) => boolean;
};

export function serveStatic(app: Express, options: ServeStaticOptions = {}) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html if the file doesn't exist: the SPA router renders
  // the page client-side. Unknown URLs get the same shell but a 404 status, so a
  // crawler is told the page does not exist instead of indexing the home page
  // under an arbitrary URL.
  app.use("*", (req, res) => {
    const pathname = req.originalUrl.split(/[?#]/, 1)[0];
    const isAppRoute = options.isAppRoute?.(pathname) ?? true;
    if (!isAppRoute) {
      res.status(404).set("X-Robots-Tag", "noindex");
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
