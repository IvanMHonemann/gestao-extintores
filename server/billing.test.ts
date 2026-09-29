import { describe, expect, it } from "vitest";
import { resolveSubscriptionAccess } from "./billing";

const plan = { id: 1, name: "Essencial" } as any;
const baseSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: 1, companyId: 1, planId: 1, status: "ACTIVE", startsAt: new Date("2026-01-01T00:00:00Z"), currentPeriodStart: new Date("2026-01-01T00:00:00Z"), currentPeriodEnd: new Date("2026-02-01T00:00:00Z"), trialEndsAt: null, gracePeriodEndsAt: null, autoRenew: false, provider: null, providerSubscriptionId: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
}) as any;
const now = new Date("2026-01-15T00:00:00Z");

describe("subscription access rules", () => {
  it("preserves compatibility when no subscription is configured", () => {
    expect(resolveSubscriptionAccess(null, null, now)).toMatchObject({ configured: false, allowed: true, status: "UNCONFIGURED" });
  });
  it("allows an active subscription and calculates days dynamically", () => {
    expect(resolveSubscriptionAccess(baseSubscription(), plan, now)).toMatchObject({ allowed: true, status: "ACTIVE", daysRemaining: 17 });
  });
  it("allows trial status while its period is valid", () => {
    expect(resolveSubscriptionAccess(baseSubscription({ status: "TRIAL", trialEndsAt: new Date("2026-01-20T00:00:00Z") }), plan, now)).toMatchObject({ allowed: true, status: "TRIAL" });
  });
  it("allows access inside the grace period", () => {
    expect(resolveSubscriptionAccess(baseSubscription({ currentPeriodEnd: new Date("2026-01-10T00:00:00Z"), gracePeriodEndsAt: new Date("2026-01-20T00:00:00Z") }), plan, now)).toMatchObject({ allowed: true, status: "GRACE_PERIOD" });
  });
  it("blocks expired, suspended and canceled companies", () => {
    expect(resolveSubscriptionAccess(baseSubscription({ currentPeriodEnd: new Date("2026-01-10T00:00:00Z") }), plan, now).allowed).toBe(false);
    expect(resolveSubscriptionAccess(baseSubscription({ status: "SUSPENDED" }), plan, now).allowed).toBe(false);
    expect(resolveSubscriptionAccess(baseSubscription({ status: "CANCELED" }), plan, now).allowed).toBe(false);
  });
});
