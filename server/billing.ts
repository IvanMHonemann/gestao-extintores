import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { payments, plans, subscriptionEvents, subscriptions, type Plan, type Subscription } from "../drizzle/schema";

export type BillingStatus = "UNCONFIGURED" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELED" | "EXPIRED";

export const BILLING_FEATURES = [
  { key: "dashboard", label: "Painel e indicadores" },
  { key: "clients", label: "Cadastro de clientes" },
  { key: "extinguishers", label: "Cadastro de extintores" },
  { key: "orders", label: "Ordens de serviço" },
  { key: "alerts", label: "Alertas de vencimento" },
  { key: "reports", label: "Relatórios e impressão" },
  { key: "team", label: "Gestão de usuários" },
  { key: "backup", label: "Backup e restauração" },
  { key: "offline", label: "Operação offline/PWA" },
] as const;

export type SubscriptionAccess = {
  configured: boolean;
  allowed: boolean;
  status: BillingStatus;
  subscription: Subscription | null;
  plan: Plan | null;
  daysRemaining: number | null;
  reason: "NO_SUBSCRIPTION" | "ACTIVE" | "TRIAL" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELED" | "EXPIRED";
};

const DAY_MS = 24 * 60 * 60 * 1000;
const toDays = (date: Date, now = new Date()) => Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
const LEGACY_UNLIMITED_LIMIT = 999999;

export function normalizePlanLimit(value: number | null | undefined): number | null {
  if (value === null || value === undefined || value === 0 || value >= LEGACY_UNLIMITED_LIMIT) return null;
  if (!Number.isInteger(value) || value < 1) throw new Error("Os limites do plano devem ser inteiros positivos ou ilimitados.");
  return value;
}

export function resolveSubscriptionAccess(subscription: Subscription | null, plan: Plan | null, now = new Date()): SubscriptionAccess {
  if (!subscription) return { configured: false, allowed: true, status: "UNCONFIGURED", subscription: null, plan: null, daysRemaining: null, reason: "NO_SUBSCRIPTION" };
  const end = new Date(subscription.currentPeriodEnd);
  const graceEnd = subscription.gracePeriodEndsAt ? new Date(subscription.gracePeriodEndsAt) : null;
  const daysRemaining = toDays(end, now);
  if (subscription.status === "SUSPENDED") return { configured: true, allowed: false, status: "SUSPENDED", subscription, plan, daysRemaining, reason: "SUSPENDED" };
  if (subscription.status === "CANCELED") return { configured: true, allowed: false, status: "CANCELED", subscription, plan, daysRemaining, reason: "CANCELED" };
  if (end.getTime() >= now.getTime()) {
    const status = subscription.status === "TRIAL" && (!subscription.trialEndsAt || new Date(subscription.trialEndsAt).getTime() >= now.getTime()) ? "TRIAL" : subscription.status === "PAST_DUE" ? "PAST_DUE" : "ACTIVE";
    return { configured: true, allowed: true, status, subscription, plan, daysRemaining, reason: status === "TRIAL" ? "TRIAL" : "ACTIVE" };
  }
  if (graceEnd && graceEnd.getTime() >= now.getTime()) return { configured: true, allowed: true, status: "GRACE_PERIOD", subscription, plan, daysRemaining, reason: "GRACE_PERIOD" };
  return { configured: true, allowed: false, status: "EXPIRED", subscription, plan, daysRemaining, reason: "EXPIRED" };
}

export async function getLatestSubscription(companyId: number) {
  const database = await getDb();
  if (!database) return null;
  try {
    const rows = await database.select({ subscription: subscriptions, plan: plans })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.companyId, companyId))
      .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
      .limit(1);
    return rows[0] ?? null;
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146) return null;
    throw error;
  }
}

export async function getSubscriptionAccess(companyId: number, now = new Date()): Promise<SubscriptionAccess> {
  const current = await getLatestSubscription(companyId);
  return resolveSubscriptionAccess(current?.subscription ?? null, current?.plan ?? null, now);
}

export function assertSubscriptionAccess(access: SubscriptionAccess) {
  if (!access.allowed) throw new Error(`A assinatura da empresa está ${access.status.toLowerCase()}. Renove o acesso para continuar.`);
}

export async function listPlans(includeInactive = false) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(plans).where(includeInactive ? undefined : eq(plans.active, true)).orderBy(plans.price);
}

export async function listSubscriptions() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ subscription: subscriptions, plan: plans }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId)).orderBy(desc(subscriptions.currentPeriodEnd));
}

export async function listPayments(companyId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(payments).where(eq(payments.companyId, companyId)).orderBy(desc(payments.createdAt));
}

export function parsePlanFeatures(features: unknown): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features.filter((item): item is string => typeof item === "string");
  if (typeof features === "object") return [];
  try {
    const parsed = JSON.parse(String(features));
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
  } catch { /* compatibilidade com planos antigos em CSV */ }
  return String(features).split(",").map(item => item.trim()).filter(Boolean);
}

export async function getCompanyEntitlements(companyId: number) {
  const access = await getSubscriptionAccess(companyId);
  return {
    ...access,
    features: parsePlanFeatures(access.plan?.features),
    limits: {
      maxUsers: access.plan?.maxUsers ?? null,
      maxClients: access.plan?.maxClients ?? null,
      maxExtinguishers: access.plan?.maxExtinguishers ?? null,
    },
  };
}

export async function companyHasFeature(companyId: number, feature: string) {
  const entitlements = await getCompanyEntitlements(companyId);
  return !entitlements.configured || entitlements.features.includes(feature);
}

export async function listSubscriptionEvents(companyId: number, subscriptionId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(subscriptionEvents).where(and(eq(subscriptionEvents.companyId, companyId), eq(subscriptionEvents.subscriptionId, subscriptionId))).orderBy(desc(subscriptionEvents.createdAt));
}

export async function createPlan(input: { name: string; description?: string; price: string; billingInterval: "MONTHLY" | "YEARLY"; maxUsers?: number | null; maxClients?: number | null; maxExtinguishers?: number | null; features?: string; active?: boolean }) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.insert(plans).values({ name: input.name.trim(), price: input.price, billingInterval: input.billingInterval, maxUsers: normalizePlanLimit(input.maxUsers), maxClients: normalizePlanLimit(input.maxClients), maxExtinguishers: normalizePlanLimit(input.maxExtinguishers), description: input.description?.trim() || null, features: parsePlanFeatures(input.features), active: input.active ?? true });
  return Number(result[0].insertId);
}

export async function updatePlan(id: number, input: Partial<{ name: string; description: string | null; price: string; billingInterval: "MONTHLY" | "YEARLY"; maxUsers: number | null; maxClients: number | null; maxExtinguishers: number | null; features: string | null; active: boolean }>) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const { features, ...rest } = input;
  await database.update(plans).set({ ...rest, ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}), ...(input.maxUsers !== undefined ? { maxUsers: normalizePlanLimit(input.maxUsers) } : {}), ...(input.maxClients !== undefined ? { maxClients: normalizePlanLimit(input.maxClients) } : {}), ...(input.maxExtinguishers !== undefined ? { maxExtinguishers: normalizePlanLimit(input.maxExtinguishers) } : {}), ...(features !== undefined ? { features: parsePlanFeatures(features) } : {}) }).where(eq(plans.id, id));
}

type SubscriptionEventSource = "MANUAL" | "SYSTEM" | "GATEWAY";

async function recordEventWithDatabase(database: any, companyId: number, subscriptionId: number, eventType: string, source: SubscriptionEventSource, referenceId?: string, payload?: unknown) {
  if (referenceId) {
    const previous = await database.select().from(subscriptionEvents).where(eq(subscriptionEvents.referenceId, referenceId)).limit(1);
    if (previous[0]) return { id: previous[0].id, duplicate: true };
  }
  const result = await database.insert(subscriptionEvents).values({ companyId, subscriptionId, eventType, source, referenceId: referenceId || null, payload: payload === undefined ? null : payload as Record<string, unknown> });
  return { id: Number(result[0].insertId), duplicate: false };
}

async function recordEvent(companyId: number, subscriptionId: number, eventType: string, source: SubscriptionEventSource, referenceId?: string, payload?: unknown) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  return recordEventWithDatabase(database, companyId, subscriptionId, eventType, source, referenceId, payload);
}

export async function createManualSubscription(input: { companyId: number; planId: number; startsAt: Date; currentPeriodStart: Date; currentPeriodEnd: Date; trialEndsAt?: Date | null; gracePeriodEndsAt?: Date | null; autoRenew?: boolean; status?: "TRIAL" | "ACTIVE" }) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const existing = await getLatestSubscription(input.companyId);
  if (input.currentPeriodEnd.getTime() < input.currentPeriodStart.getTime()) throw new Error("O vencimento deve ser posterior ao início do período.");
  if (existing) throw new Error("A empresa já possui uma assinatura. Use Editar na assinatura existente para alterar plano ou datas.");
  return database.transaction(async (transaction: any) => {
    const result = await transaction.insert(subscriptions).values({ ...input, status: input.status || "ACTIVE", autoRenew: input.autoRenew ?? false });
    const id = Number(result[0].insertId);
    await recordEventWithDatabase(transaction, input.companyId, id, "SUBSCRIPTION_CREATED", "MANUAL", undefined, input);
    return id;
  });
}

export async function updateManualSubscription(input: { subscriptionId: number; companyId: number; planId: number; startsAt: Date; currentPeriodStart: Date; currentPeriodEnd: Date; trialEndsAt?: Date | null; gracePeriodEndsAt?: Date | null; autoRenew?: boolean; status?: "TRIAL" | "ACTIVE" }) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const current = await database.select().from(subscriptions).where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.companyId, input.companyId))).limit(1);
  if (!current[0]) throw new Error("Assinatura não encontrada para esta empresa.");
  await database.update(subscriptions).set({ planId: input.planId, startsAt: input.startsAt, currentPeriodStart: input.currentPeriodStart, currentPeriodEnd: input.currentPeriodEnd, trialEndsAt: input.trialEndsAt ?? null, gracePeriodEndsAt: input.gracePeriodEndsAt ?? null, autoRenew: input.autoRenew ?? false, status: input.status || "ACTIVE" }).where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.companyId, input.companyId)));
  await recordEvent(input.companyId, input.subscriptionId, "SUBSCRIPTION_UPDATED", "MANUAL", undefined, { previous: current[0], next: input });
}

function addPeriod(start: Date, days?: number, months?: number) {
  if (days) return new Date(start.getTime() + days * DAY_MS);
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + (months || 1));
  return next;
}

export async function renewSubscription(companyId: number, days: number, executedBy = "PLATFORM_ADMIN") {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const current = await getLatestSubscription(companyId);
  if (!current) throw new Error("A empresa ainda não possui assinatura.");
  const now = new Date();
  const base = new Date(current.subscription.currentPeriodEnd).getTime() > now.getTime() ? new Date(current.subscription.currentPeriodEnd) : now;
  const end = addPeriod(base, days);
  await database.update(subscriptions).set({ currentPeriodEnd: end, status: "ACTIVE", gracePeriodEndsAt: null }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(companyId, current.subscription.id, "SUBSCRIPTION_RENEWED", "MANUAL", undefined, { executedBy, previousEnd: current.subscription.currentPeriodEnd, newEnd: end, days });
  return end;
}

export async function setSubscriptionStatus(companyId: number, status: "ACTIVE" | "SUSPENDED" | "CANCELED", executedBy = "PLATFORM_ADMIN") {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const current = await getLatestSubscription(companyId);
  if (!current) throw new Error("A empresa ainda não possui assinatura.");
  await database.update(subscriptions).set({ status }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(companyId, current.subscription.id, `SUBSCRIPTION_${status}`, "MANUAL", undefined, { executedBy, previousStatus: current.subscription.status, status });
}

export async function changeSubscriptionPlan(companyId: number, planId: number, executedBy = "PLATFORM_ADMIN") {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const current = await getLatestSubscription(companyId);
  if (!current) throw new Error("A empresa ainda não possui assinatura.");
  await database.update(subscriptions).set({ planId }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(companyId, current.subscription.id, "PLAN_CHANGED", "MANUAL", undefined, { executedBy, previousPlanId: current.subscription.planId, planId });
}

export async function createPayment(input: { companyId: number; subscriptionId: number; amount: string; status?: "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED" | "OVERDUE"; paymentMethod?: string; dueAt?: Date | null; paidAt?: Date | null; periodStart?: Date | null; periodEnd?: Date | null; provider?: string | null; providerPaymentId?: string | null }, referenceId?: string) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  if (referenceId) {
    const duplicate = await database.select().from(subscriptionEvents).where(eq(subscriptionEvents.referenceId, referenceId)).limit(1);
    if (duplicate[0]) return { id: duplicate[0].id, duplicate: true };
  }
  const result = await database.insert(payments).values({ ...input, status: input.status || "PENDING", paymentMethod: input.paymentMethod || null, provider: input.provider || null, providerPaymentId: input.providerPaymentId || null });
  await recordEvent(input.companyId, input.subscriptionId, input.status === "PAID" ? "PAYMENT_RECEIVED" : "PAYMENT_CREATED", input.provider ? "GATEWAY" : "MANUAL", referenceId, input);
  return { id: Number(result[0].insertId), duplicate: false };
}

export type BillingProvider = {
  createSubscription: (...args: any[]) => Promise<never>;
  cancelSubscription: (...args: any[]) => Promise<never>;
  updateSubscription: (...args: any[]) => Promise<never>;
  getSubscription: (...args: any[]) => Promise<never>;
  listPayments: (...args: any[]) => Promise<never>;
  processWebhook: (...args: any[]) => Promise<never>;
};

export const futureBillingProvider: BillingProvider = Object.fromEntries(["createSubscription", "cancelSubscription", "updateSubscription", "getSubscription", "listPayments", "processWebhook"].map((name) => [name, async () => { throw new Error("Gateway de pagamento ainda não está configurado."); }])) as BillingProvider;
