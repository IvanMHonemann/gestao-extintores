import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { memberAccounts, memberSessions } from "../drizzle/schema";
import { getDb } from "./db";

const SESSION_DAYS = 30;

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
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.id, accountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) return false;
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, accountId));
  return true;
}

export async function resetMemberPassword(accountId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, accountId));
  await db.delete(memberSessions).where(eq(memberSessions.accountId, accountId));
}

export async function setRecoveryCode(accountId: number, recoveryCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ recoveryCodeHash: hashPassword(recoveryCode) }).where(eq(memberAccounts.id, accountId));
}

export async function recoverMemberPassword(email: string, recoveryCode: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.email, email.toLowerCase())).limit(1);
  const account = result[0];
  if (!account?.active || !account.recoveryCodeHash || !verifyPassword(recoveryCode, account.recoveryCodeHash)) return false;
  const nextRecoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq(memberAccounts.id, account.id));
  await db.delete(memberSessions).where(eq(memberSessions.accountId, account.id));
  return { recoveryCode: nextRecoveryCode };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticateMember(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.email, email.toLowerCase())).limit(1);
  const account = result[0];
  if (!account || !account.active || !verifyPassword(password, account.passwordHash)) return null;
  return account;
}

export async function createMemberAccount(input: {
  companyName: string;
  userName: string;
  email: string;
  password: string;
}, role: "user" | "admin" = "user") {
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
}

export async function createMemberSession(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(memberSessions).values({
    accountId,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });
  return { rawToken, expiresAt };
}

export async function getMemberBySessionToken(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const result = await db.select({
    account: memberAccounts,
    session: memberSessions,
  }).from(memberSessions)
    .innerJoin(memberAccounts, eq(memberSessions.accountId, memberAccounts.id))
    .where(and(
      eq(memberSessions.tokenHash, hashToken(rawToken)),
      gt(memberSessions.expiresAt, new Date()),
      eq(memberAccounts.active, true),
    ))
    .limit(1);
  return result[0]?.account ?? null;
}

export async function revokeMemberSession(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return;
  await db.delete(memberSessions).where(eq(memberSessions.tokenHash, hashToken(rawToken)));
}
