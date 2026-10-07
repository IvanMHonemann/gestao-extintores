import { and, desc, eq, gte, lte, like, or, sql } from "drizzle-orm";
import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";

function safeJson(value: unknown) { return value == null ? null : JSON.stringify(value); }
function pageArgs(page = 1, pageSize = 25) { const size = Math.min(100, Math.max(1, Math.trunc(pageSize))); const current = Math.max(1, Math.trunc(page)); return { page: current, pageSize: size, offset: (current - 1) * size }; }

type AuditFilters = { companyId?: number; enforceTenant?: boolean; page?: number; pageSize?: number; from?: string; to?: string; userId?: number; module?: string; action?: string; entityType?: string; entityId?: number; search?: string };
function conditions(filters: AuditFilters) {
  const c: any[] = [];
  if (filters.enforceTenant && filters.companyId) c.push(eq(auditLogs.companyId, filters.companyId));
  else if (filters.companyId) c.push(eq(auditLogs.companyId, filters.companyId));
  if (filters.from) c.push(gte(auditLogs.createdAt, new Date(filters.from)));
  if (filters.to) c.push(lte(auditLogs.createdAt, new Date(filters.to)));
  if (filters.userId) c.push(eq(auditLogs.userId, filters.userId));
  if (filters.module) c.push(eq(auditLogs.module, filters.module));
  if (filters.action) c.push(eq(auditLogs.action, filters.action));
  if (filters.entityType) c.push(eq(auditLogs.entityType, filters.entityType));
  if (filters.entityId) c.push(eq(auditLogs.entityId, filters.entityId));
  if (filters.search) { const q = `%${filters.search}%`; c.push(or(like(auditLogs.description, q), like(auditLogs.entityLabel, q), like(auditLogs.userName, q))); }
  return c.length ? and(...c) : undefined;
}

export async function auditFromCtx(ctx: TrpcContext, data: { companyId?: number | null; action: string; module: string; entityType: string; entityId?: number | null; entityLabel?: string; description: string; oldData?: unknown; newData?: unknown }) {
  const db = await getDb(); if (!db) return;
  await db.insert(auditLogs).values({ companyId: data.companyId ?? ctx.accountId ?? null, userId: ctx.memberAccountId ?? ctx.platformAdminId ?? null, userName: ctx.user?.name ?? null, userEmail: ctx.user?.email ?? null, action: data.action, module: data.module, entityType: data.entityType, entityId: data.entityId ?? null, entityLabel: data.entityLabel ?? null, description: data.description, oldData: safeJson(data.oldData), newData: safeJson(data.newData), ipAddress: String(ctx.req.headers["x-forwarded-for"] ?? ctx.req.socket.remoteAddress ?? "").slice(0, 64), userAgent: String(ctx.req.headers["user-agent"] ?? "").slice(0, 512) });
}
export function diffAuditData(before: any, after: any) { const oldData: Record<string, unknown> = {}; const newData: Record<string, unknown> = {}; const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])); for (const key of keys) if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) { oldData[key] = before?.[key] ?? null; newData[key] = after?.[key] ?? null; } return { oldData, newData }; }
export async function listAuditLogs(filters: AuditFilters) { const db = await getDb(); if (!db) return { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 }; const { page, pageSize, offset } = pageArgs(filters.page ?? 1, filters.pageSize ?? 25); const where = conditions(filters); const [items, count] = await Promise.all([db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(pageSize).offset(offset), db.select({ total: sql<number>`count(*)` }).from(auditLogs).where(where)]); const total = Number(count[0]?.total ?? 0); return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }; }
export async function getAuditLogById(id: number, companyId?: number) { const db = await getDb(); if (!db) return null; const where = companyId ? and(eq(auditLogs.id, id), eq(auditLogs.companyId, companyId)) : eq(auditLogs.id, id); const rows = await db.select().from(auditLogs).where(where).limit(1); return rows[0] ?? null; }
export async function listEntityAuditHistory(filters: { companyId: number; entityType: string; entityId: number; page?: number; pageSize?: number }) { return listAuditLogs({ ...filters, enforceTenant: true }); }
export async function exportAuditLogsCsv(filters: AuditFilters) { const rows = (await listAuditLogs({ ...filters, page: 1, pageSize: 100 })).items; const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`; return ["id;data;ação;módulo;entidade;descrição;usuário", ...rows.map(r => [r.id, r.createdAt.toISOString(), r.action, r.module, r.entityType, r.description, r.userEmail].map(esc).join(';'))].join("\n"); }
