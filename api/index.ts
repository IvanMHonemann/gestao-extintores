import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { runScheduledMaintenance } from "../server/scheduledMaintenance";
import { notifyOwner } from "../server/_core/notification";
import crypto from "node:crypto";

async function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  app.post("/api/scheduled/database-maintenance", async (req, res) => {
    try {
      const configuredSecret = process.env.SCHEDULE_SECRET;
      const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-schedule-secret"];
      if (!configuredSecret || typeof suppliedSecret !== "string" || suppliedSecret.length !== configuredSecret.length || !crypto.timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(configuredSecret))) {
        return res.status(401).json({ error: "Schedule authentication required" });
      }
      const result = await runScheduledMaintenance();
      return res.json({ ok: true, result });
    } catch (error) {
      console.error("[Maintenance] failed:", error);
      await notifyOwner({ title: "Falha no backup diário", content: "O backup automático falhou." }).catch(() => undefined);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }
      },
    }));
    app.use("*", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }
  return app;
}

let appPromise: ReturnType<typeof createApp> | null = null;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req as any, res as any);
}
