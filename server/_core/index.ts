import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { runScheduledMaintenance } from "../scheduledMaintenance";
import { notifyOwner } from "./notification";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const manusIntegrationsEnabled = process.env.MANUS_INTEGRATIONS === "true";
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/scheduled/database-maintenance", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "Cron session required" });
      const result = await runScheduledMaintenance();
      return res.json({ ok: true, taskUid: user.taskUid, result });
    } catch (error) {
      console.error("[Maintenance] Scheduled backup failed:", error);
      await notifyOwner({ title: "Falha no backup diário", content: "O backup automático e a limpeza programada falharam. Verifique os logs do projeto e o armazenamento persistente configurado." }).catch(() => undefined);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  if (manusIntegrationsEnabled) {
    const [{ registerOAuthRoutes }, { registerStorageProxy }] = await Promise.all([
      import("./oauth"),
      import("./storageProxy"),
    ]);
    registerStorageProxy(app);
    registerOAuthRoutes(app);
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // A prévia deve usar o bundle estático validado. Isso evita que o Vite de
  // desenvolvimento injete HMR/proxies no navegador móvel. Para trabalhar
  // explicitamente com Vite, defina VITE_DEV_SERVER=true.
  if (process.env.NODE_ENV === "development" && process.env.VITE_DEV_SERVER === "true") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
