import express from "express";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { runScheduledMaintenance, runExpirationEmailAlerts } from "./scheduledMaintenance";
import { notifyOwner } from "./_core/notification";
import crypto from "node:crypto";
import { csrfProtection, requestId, securityHeaders, validateProductionEnvironment } from "./security";
import { consumeRateLimit, RATE_RULES } from "./rateLimit";
async function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  validateProductionEnvironment();
  app.use(requestId);
  app.use(securityHeaders);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true, parameterLimit: 500 }));
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  app.post("/api/scheduled/database-maintenance", async (req, res) => {
    try {
      const configuredSecret = process.env.SCHEDULE_SECRET;
      const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-schedule-secret"];
      if (!configuredSecret || typeof suppliedSecret !== "string" || suppliedSecret.length !== configuredSecret.length || !crypto.timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(configuredSecret))) {
        return res.status(401).json({ error: "Schedule authentication required" });
      }
      const result = await runScheduledMaintenance();
      let expiry = null;
      try { expiry = await runExpirationEmailAlerts(30); } catch (e) { console.warn("[email] expiry alerts", e); }
      return res.json({ ok: true, result, expiry });
    } catch (error) {
      console.error("[Maintenance] failed:", error);
      await notifyOwner({ title: "Falha no backup diário", content: "O backup automático falhou." }).catch(() => undefined);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  
  app.post("/api/webhooks/asaas", express.json({ limit: "100kb" }), async (req, res) => {
    try {
      const ipLimit = await consumeRateLimit(`asaas:webhook:${req.ip}`, RATE_RULES.webhook);
      if (!ipLimit.allowed) { res.setHeader("Retry-After", ipLimit.retryAfter); return res.status(429).json({ error: "Too many requests" }); }
      const token = process.env.ASAAS_WEBHOOK_TOKEN || "";
      const headerToken = String(req.headers["asaas-access-token"] || req.headers["x-asaas-token"] || "");
      if ((process.env.NODE_ENV === "production" && !token) || !headerToken || !token || token.length !== headerToken.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(headerToken))) {
        return res.status(401).json({ error: "Invalid webhook token" });
      }
      const body = req.body || {};
      const eventId = String(body.id || body.eventId || body.payment?.id || `${body.event || "evt"}_${Date.now()}`);
      const event = String(body.event || body.type || "UNKNOWN");
      const recorded = await (await import("./db")).recordPaymentEvent({
        eventId,
        event,
        paymentId: body.payment?.id ? undefined : undefined,
        subscriptionId: undefined,
        payload: JSON.stringify(body),
        processed: true,
      });
      if (recorded.duplicate) {
        return res.json({ ok: true, duplicate: true });
      }
      // Future: map Asaas events to subscription status updates
      return res.json({ ok: true, duplicate: false });
    } catch (error) {
      console.error("[Asaas webhook]", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });
  app.use(csrfProtection);

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
export default async function handler(req: any, res: any) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req as any, res as any);
}
