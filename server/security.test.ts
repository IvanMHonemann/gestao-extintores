import { describe, expect, it, beforeEach } from "vitest";
import { csrfProtection, redact, securityHeaders } from "./security";
import { consumeRateLimit } from "./rateLimit";

function response() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader(name: string, value: string) { headers.set(name, value); },
    status(code: number) { return { code, json: (body: unknown) => ({ code, body }) }; },
  } as any;
}

describe("controles de segurança HTTP", () => {
  beforeEach(() => { process.env.NODE_ENV = "test"; });

  it("aplica HSTS, nosniff, frame denial e CSP", () => {
    const res = response();
    securityHeaders({} as any, res, () => undefined);
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("rejeita mutação sem origem autorizada", () => {
    const req = { method: "POST", path: "/api/trpc/auth.login", get: () => undefined, headers: {}, protocol: "https", hostname: "app.exemplo.com" } as any;
    const result = csrfProtection(req, response(), () => undefined);
    expect(result.code).toBe(403);
  });

  it("remove credenciais e mascara e-mail em auditoria", () => {
    expect(redact({ password: "secret", token: "abc", email: "ivan@example.com", safe: "ok" })).toEqual({ email: "i***@example.com", safe: "ok" });
  });

  it("aplica limite em memória no ambiente de teste", async () => {
    const key = `test-limit-${Date.now()}`;
    const rule = { limit: 2, windowSeconds: 60, blockSeconds: 60 } as const;
    expect((await consumeRateLimit(key, rule)).allowed).toBe(true);
    expect((await consumeRateLimit(key, rule)).allowed).toBe(true);
    expect((await consumeRateLimit(key, rule)).allowed).toBe(false);
  });
});
