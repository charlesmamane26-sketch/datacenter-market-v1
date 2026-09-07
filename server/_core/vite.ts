import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { matchRouteSeo } from "../../shared/seo";

export async function setupVite(app: Express, server: Server) {
  // Keep Vite and its plugins out of the production module graph/runtime image.
  const [{ createServer: createViteServer }, { default: viteConfig }] =
    await Promise.all([import("vite"), import("../../vite.config")]);
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

export function getSpaFallbackPolicy(pathname: string): {
  known: boolean;
  status: 200 | 404;
  noindex: boolean;
} {
  const route = matchRouteSeo(pathname);
  if (!route) return { known: false, status: 404, noindex: true };
  return {
    known: true,
    status: route.pattern === "/404" ? 404 : 200,
    noindex: Boolean(route.noindex),
  };
}

export function serveStatic(app: Express) {
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

  // Fall through to the SPA only for declared application routes. Unknown
  // assets/paths get a real 404 instead of an indexable home-page soft-404.
  app.use("*", (req, res) => {
    let pathname = "/__invalid_path__";
    try {
      pathname = new URL(req.originalUrl, "http://localhost").pathname;
    } catch {
      // Keep the fail-closed unknown-path policy.
    }
    const policy = getSpaFallbackPolicy(pathname);
    if (!policy.known) {
      res
        .status(404)
        .set("X-Robots-Tag", "noindex, nofollow")
        .type("text/plain")
        .send("Not found");
      return;
    }
    if (policy.noindex) {
      res.set("X-Robots-Tag", "noindex, nofollow");
    }
    res.status(policy.status).sendFile(path.resolve(distPath, "index.html"));
  });
}
