import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  const required: Array<[string, (value: string) => boolean]> = [
    ["EXTERNAL_DATABASE_URL", (v) => v.startsWith("mysql://") || v.startsWith("mysqls://")],
    ["JWT_SECRET", (v) => Buffer.byteLength(v, "utf8") >= 32 && !/replace|change|default|secret/i.test(v)],
    ["SCHEDULE_SECRET", (v) => v.length >= 32 && !/replace|change|default|secret/i.test(v)],
  ];
  const missing = required.filter(([name, check]) => !check(process.env[name] || "")).map(([name]) => name);
  const asaasEnv = (process.env.ASAAS_ENVIRONMENT || "mock").toLowerCase();
  if (asaasEnv === "production" && !(process.env.ASAAS_API_KEY && process.env.ASAAS_WEBHOOK_TOKEN)) {
    missing.push("ASAAS_API_KEY/ASAAS_WEBHOOK_TOKEN");
  }
  if (missing.length) throw new Error(`Production security configuration missing: ${missing.join(", ")}`);
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'wasm-unsafe-eval'",
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "frame-src 'self' https://sandbox.asaas.com https://www.asaas.com",
  ].join("; "));
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
}

function allowedOrigins(req: Request): Set<string> {
  const values = [process.env.APP_PUBLIC_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "", ...(process.env.ALLOWED_ORIGINS || "").split(",")];
  const origins = new Set(values.map((v) => String(v || "").trim().replace(/\/$/, "")).filter(Boolean));
  const host = req.get("host");
  if (host && (process.env.NODE_ENV !== "production" || process.env.ALLOW_REQUEST_HOST_ORIGIN === "true")) {
    origins.add(`${req.protocol}://${host}`);
  }
  return origins;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || !req.path.startsWith("/api/trpc")) return next();
  const origin = req.get("origin");
  const referer = req.get("referer");
  const candidate = origin || (referer ? new URL(referer).origin : "");
  if (!candidate || !allowedOrigins(req).has(candidate.replace(/\/$/, ""))) {
    return res.status(403).json({ error: "Origem não autorizada." });
  }
  return next();
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("X-Request-ID", id);
  next();
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/password|token|secret|cookie|authorization|recovery|hash|credit.?card|cvv|api.?key/i.test(key)) continue;
    result[key] = /email/i.test(key) && typeof child === "string" ? child.replace(/^(.).+(@.*)$/, "$1***$2") : redact(child);
  }
  return result;
}
