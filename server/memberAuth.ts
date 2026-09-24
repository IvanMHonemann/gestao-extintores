import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { memberAccounts, memberSessions } from "../drizzle/schema";
import { getDb } from "./db";

const SESSION_DAYS = 30;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;
const BLOCK_MS = 15 * 60 * 1000;
type RateEntry = { failures: number; windowStartedAt: number; blockedUntil: number };
const authRate = new Map<string, RateEntry>();

function isRateLimited(key: string) {
  const now = Date.now();
  const current = authRate.get(key);
  if (!current) return false;
  if (current.blockedUntil > now) return true;
  if (now - current.windowStartedAt >= RATE_WINDOW_MS) authRate.delete(key);
  return false;
}

function registerFailure(key: string) {
  const now = Date.now();
  const current = authRate.get(key);
  const entry = !current || now - current.windowStartedAt >= RATE_WINDOW_MS
    ? { failures: 1, windowStartedAt: now, blockedUntil: 0 }
    : { ...current, failures: current.failures + 1 };
  if (entry.failures >= RATE_LIMIT) entry.blockedUntil = now + BLOCK_MS;
  authRate.set(key, entry);
}

function clearRateLimit(key: string) {
  authRate.delete(key);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, stored] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !stored) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function changeMemberPassword(accountId: number, currentPassword: string, newPassword: string) {
  const key = `change:${accountId}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.id, accountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, accountId));
  await db.delete(memberSessions).where(eq(memberSessions.accountId, accountId));
  return true;
}

export async function resetMemberPassword(accountId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, accountId));
  await db.delete(memberSessions).where(eq(memberSessions.accountId, accountId));
  clearRateLimit(`login:${accountId}`);
}

export async function setRecoveryCode(accountId: number, recoveryCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ recoveryCodeHash: hashPassword(recoveryCode) }).where(eq(memberAccounts.id, accountId));
}

export async function recoverMemberPassword(email: string, recoveryCode: string, newPassword: string) {
  const normalizedEmail = email.toLowerCase();
  const key = `recover:${normalizedEmail}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.email, normalizedEmail)).limit(1);
  const account = result[0];
  if (!account?.active || !account.recoveryCodeHash || !verifyPassword(recoveryCode, account.recoveryCodeHash)) {
    registerFailure(key);
    return false;
  }
  const nextRecoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq(memberAccounts.id, account.id));
  await db.delete(memberSessions).where(eq(memberSessions.accountId, account.id));
  clearRateLimit(key);
  return { recoveryCode: nextRecoveryCode };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticateMember(email: string, password: string) {
  const normalizedEmail = email.toLowerCase();
  const key = `login:${normalizedEmail}`;
  if (isRateLimited(key)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.email, normalizedEmail)).limit(1);
  const account = result[0];
  if (!account || !account.active || !verifyPassword(password, account.passwordHash)) {
    registerFailure(key);
    return null;
  }
  clearRateLimit(key);
  return account;
}

export async function createMemberAccount(input: { companyName: string; userName: string; email: string; password: string }, role: "user" | "admin" = "user") {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const result = await db.insert(memberAccounts).values({
    companyName: input.companyName,
    userName: input.userName,
    email: input.email.toLowerCase(),
    passwordHash: hashPassword(input.password),
    recoveryCodeHash: hashPassword(recoveryCode),
    role,
  });
  return { id: Number(result[0].insertId), recoveryCode };
}

export async function listMemberAccounts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: memberAccounts.id,
    companyName: memberAccounts.companyName,
    userName: memberAccounts.userName,
    email: memberAccounts.email,
    role: memberAccounts.role,
    active: memberAccounts.active,
    createdAt: memberAccounts.createdAt,
  }).from(memberAccounts).orderBy(memberAccounts.companyName);
}

export async function setMemberActive(id: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const account = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(eq(memberAccounts.id, id)).limit(1);
  if (account[0]?.role === "admin" && !active) throw new Error("A conta administrativa não pode ser bloqueada.");
  await db.update(memberAccounts).set({ active }).where(eq(memberAccounts.id, id));
  if (!active) await db.delete(memberSessions).where(eq(memberSessions.accountId, id));
}

export async function createMemberSession(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(memberSessions).where(and(eq(memberSessions.accountId, accountId), lte(memberSessions.expiresAt, new Date())));
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(memberSessions).values({ accountId, tokenHash: hashToken(rawToken), expiresAt });
  return { rawToken, expiresAt };
}

export async function getMemberBySessionToken(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = new Date();
  const result = await db.select({ account: memberAccounts, session: memberSessions }).from(memberSessions)
    .innerJoin(memberAccounts, eq(memberSessions.accountId, memberAccounts.id))
    .where(and(eq(memberSessions.tokenHash, hashToken(rawToken)), gt(memberSessions.expiresAt, now), eq(memberAccounts.active, true)))
    .limit(1);
  // Limpeza oportunística evita crescimento indefinido de sessões expiradas.
  await db.delete(memberSessions).where(lte(memberSessions.expiresAt, now));
  return result[0]?.account ?? null;
}

export async function revokeMemberSession(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return;
  await db.delete(memberSessions).where(eq(memberSessions.tokenHash, hashToken(rawToken)));
}
