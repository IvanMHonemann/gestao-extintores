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
    // A prévia é acessada por HTTPS público, mas o Vite tenta anunciar o
    // WebSocket interno localhost:5173 em alguns celulares. HMR não é
    // necessário para o usuário final e esse anúncio abre o painel de erro.
    hmr: false,
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Em alguns reinícios do preview, o middleware do Vite pode delegar
  // módulos com query string ao Express. Transforme esses recursos
  // explicitamente antes do fallback HTML, para nunca devolver index.html
  // como resposta de um import JavaScript/CSS.
  app.use(async (req, res, next) => {
    const pathname = req.path;
    const isViteAsset = pathname.startsWith("/src/") || pathname.startsWith("/@fs/") || pathname.startsWith("/@id/") || pathname.startsWith("/@vite/");
    if (!isViteAsset) return next();
    try {
      const transformed = await vite.transformRequest(req.originalUrl);
      if (!transformed) return next();
      const contentType = pathname.endsWith(".css") ? "text/css" : "text/javascript";
      res.status(200).set({ "Content-Type": contentType }).end(transformed.code);
    } catch (error) {
      next(error);
    }
  });
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
      // O preview público não precisa do cliente HMR. Remova-o para que
      // celulares não tentem abrir localhost:5173 e exibam o overlay de erro.
      const pageWithoutHmr = page.replace(/<script[^>]+src="\/\@vite\/client"[^>]*><\/script>/g, "");
      res.status(200).set({ "Content-Type": "text/html" }).end(pageWithoutHmr);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      }
    },
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
