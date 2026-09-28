import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  clients,
  companies,
  extinguishers,
  memberSessions,
  platformSessions,
  serviceOrders,
  serviceOrderItems,
  trashItems,
  systemSettings,
  users,
  type InsertClient,
  type InsertExtinguisher,
  type InsertServiceOrder,
  type InsertServiceOrderItem,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbUrl: string | null = null;
let _pool: mysql.Pool | null = null;

function monitoredPool(pool: mysql.Pool): mysql.Pool {
  const slowQueryMs = Number(process.env.DB_SLOW_QUERY_MS || 1000);
  return new Proxy(pool as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if ((property !== "query" && property !== "execute") || typeof value !== "function") return value;
      return (...args: any[]) => {
        const startedAt = Date.now();
        const result = value.apply(target, args);
        if (!result || typeof result.finally !== "function") return result;
        return result.finally(() => {
          const elapsed = Date.now() - startedAt;
          if (elapsed >= slowQueryMs) console.warn(`[Database] Slow query: ${elapsed}ms`);
        });
      };
    },
  }) as mysql.Pool;
}

export async function getDb() {
  const databaseUrl = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (_db && _dbUrl !== databaseUrl) {
    await _pool?.end().catch(() => undefined);
    _pool = null;
    _db = null;
    _dbUrl = null;
  }
  if (!_db && databaseUrl) {
    try {
      _pool = monitoredPool(mysql.createPool({
        uri: databaseUrl,
        ssl: { rejectUnauthorized: true },
        connectionLimit: Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || 10)),
        queueLimit: Math.max(0, Number(process.env.DB_QUEUE_LIMIT || 50)),
        connectTimeout: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)),
        enableKeepAlive: true,
        keepAliveInitialDelay: Math.max(1000, Number(process.env.DB_KEEP_ALIVE_MS || 10000)),
      }));
      _db = drizzle(_pool as any) as ReturnType<typeof drizzle>;
      _dbUrl = databaseUrl;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _dbUrl = null;
    }
  }
  return _db;
}

function requireAccountId(accountId: number | undefined): number {
  if (typeof accountId !== "number" || !Number.isInteger(accountId) || accountId <= 0) throw new Error("Tenant comercial obrigatório");
  return accountId;
}

function pageArgs(page = 1, pageSize = 25) {
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize || 25)));
  const safePage = Math.max(1, Math.trunc(page || 1));
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize };
}

function pageResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.openId === ENV.ownerOpenId ? "platform_admin" : (user.role ?? "oauth_user");
    updateSet.role = values.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/* Plataforma */
export async function listCompanies() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companies).orderBy(companies.name);
}

export async function getPlatformDashboardStats(companyId: number, options: { city?: string; from?: string; to?: string } = {}) {
  const tenant = requireAccountId(companyId);
  const db = await getDb();
  if (!db) return { totalClients: 0, totalCities: 0, totalExtinguishers: 0, nearExpirationCount: 0, expiredCount: 0, totalOrders: 0, alertDaysConfig: 30 };
  const daysAhead = parseInt(await getSetting("alert_days_ahead", tenant, "30"), 10) || 30;
  const clientConditions = [eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") clientConditions.push(eq(clients.city, options.city));
  const clientWhere = and(...clientConditions);
  const extinguisherConditions = [eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") extinguisherConditions.push(eq(clients.city, options.city));
  const extinguisherWhere = and(...extinguisherConditions);
  const orderConditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") orderConditions.push(eq(clients.city, options.city));
  if (options.from) orderConditions.push(sql`${serviceOrders.orderDate} >= ${options.from}`);
  if (options.to) orderConditions.push(sql`${serviceOrders.orderDate} <= ${options.to}`);
  const orderWhere = and(...orderConditions);
  const [clientCountRows, cityCountRows, extinguisherCountRows, expiredRows, nearRows, orderCountRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(clients).where(clientWhere),
    db.select({ total: sql<number>`count(distinct ${clients.city})` }).from(clients).where(clientWhere),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(extinguisherWhere),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(extinguisherWhere, sql`${extinguishers.expirationDate} < CURRENT_DATE()`)),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(extinguisherWhere, sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)),
    db.select({ total: sql<number>`count(*)` }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(orderWhere),
  ]);
  return {
    totalClients: Number(clientCountRows[0]?.total || 0),
    totalCities: Number(cityCountRows[0]?.total || 0),
    totalExtinguishers: Number(extinguisherCountRows[0]?.total || 0),
    nearExpirationCount: Number(nearRows[0]?.total || 0),
    expiredCount: Number(expiredRows[0]?.total || 0),
    totalOrders: Number(orderCountRows[0]?.total || 0),
    alertDaysConfig: daysAhead,
  };
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function createCompany(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(companies).values({ name: name.trim(), active: true });
  return Number(result[0].insertId);
}

export async function updateCompany(id: number, data: { name?: string; active?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set({ ...data, name: data.name?.trim() }).where(eq(companies.id, id));
}

export async function getPlatformClients(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  return companyId ? await db.select().from(clients).where(eq(clients.accountId, companyId)).orderBy(desc(clients.createdAt)) : await db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getPlatformExtinguishers(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  return companyId ? await db.select().from(extinguishers).where(eq(extinguishers.accountId, companyId)).orderBy(extinguishers.expirationDate) : await db.select().from(extinguishers).orderBy(extinguishers.expirationDate);
}

export async function getPlatformOrders(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  return companyId ? await query.where(eq(serviceOrders.accountId, companyId)).orderBy(desc(serviceOrders.createdAt)) : await query.orderBy(desc(serviceOrders.createdAt));
}

export async function getClientsPage(accountId: number, options: { page?: number; pageSize?: number; city?: string; search?: string } = {}) {
  const tenant = requireAccountId(accountId); const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const search = options.search?.trim(); const conditions = [eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.cnpj, `%${search}%`), like(clients.contactName, `%${search}%`))!);
  const where = and(...conditions);
  const [items, totalRows] = await Promise.all([
    db.select().from(clients).where(where).orderBy(desc(clients.createdAt), desc(clients.id)).limit(pageSize).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(clients).where(where),
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

/* Clientes */
export async function getClients(cityFilter: string | undefined, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(clients.accountId, tenant)];
  if (cityFilter && cityFilter !== "TODAS") conditions.push(eq(clients.city, cityFilter));
  return await db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.accountId, tenant))).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient) {
  const tenant = requireAccountId(data.accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(clients).values({ ...data, accountId: tenant });
  return Number(result[0].insertId);
}

export async function updateClient(id: number, data: Partial<InsertClient>, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, tenant);
  if (!client) throw new Error("Cliente não encontrado ou sem permissão");
  const { accountId: ignoredAccountId, ...safeData } = data;
  void ignoredAccountId;
  await db.update(clients).set(safeData).where(and(eq(clients.id, id), eq(clients.accountId, tenant)));
}

export async function deleteClient(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, tenant);
  if (!client) throw new Error("Cliente não encontrado ou sem permissão");
  const clientOrders = await db.select().from(serviceOrders).where(and(eq(serviceOrders.clientId, id), eq(serviceOrders.accountId, tenant)));
  const orderIds = clientOrders.map((order) => order.id);
  const clientExtinguishers = await db.select().from(extinguishers).where(and(eq(extinguishers.clientId, id), eq(extinguishers.accountId, tenant)));
  const orderItems = orderIds.length ? await db.select().from(serviceOrderItems).where(inArray(serviceOrderItems.serviceOrderId, orderIds)) : [];
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "client", originalId: id, label: client.companyName, snapshot: JSON.stringify({ client, orders: clientOrders, items: orderItems, extinguishers: clientExtinguishers }), expiresAt });
    for (const order of clientOrders) {
      await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, order.id));
      await tx.delete(serviceOrders).where(and(eq(serviceOrders.id, order.id), eq(serviceOrders.accountId, tenant)));
    }
    await tx.delete(extinguishers).where(and(eq(extinguishers.clientId, id), eq(extinguishers.accountId, tenant)));
    await tx.delete(clients).where(and(eq(clients.id, id), eq(clients.accountId, tenant)));
  });
}

export async function getDistinctCities(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ city: clients.city }).from(clients).where(eq(clients.accountId, tenant)).orderBy(clients.city);
  return result.map(row => row.city).filter(Boolean);
}

export async function getExtinguishersPage(accountId: number, options: { page?: number; pageSize?: number; clientId?: number; search?: string; filter?: "all" | "active" | "near" | "expired" } = {}) {
  const tenant = requireAccountId(accountId); const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(extinguishers.accountId, tenant)]; const search = options.search?.trim();
  if (options.clientId) conditions.push(eq(extinguishers.clientId, options.clientId));
  if (search) conditions.push(or(like(extinguishers.typeModel, `%${search}%`), like(extinguishers.serialNumber, `%${search}%`), like(extinguishers.locationInBuilding, `%${search}%`))!);
  if (options.filter === "active") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE()`);
  if (options.filter === "expired") conditions.push(sql`${extinguishers.expirationDate} < CURRENT_DATE()`);
  if (options.filter === "near") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`);
  const where = and(...conditions);
  const [items, totalRows] = await Promise.all([
    db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(where, eq(clients.accountId, tenant))).orderBy(extinguishers.expirationDate, desc(extinguishers.id)).limit(pageSize).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(where),
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

/* Extintores */
export async function getExtinguishers(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(extinguishers).where(eq(extinguishers.accountId, tenant)).orderBy(extinguishers.expirationDate);
}

export async function getExtinguishersByClient(clientId: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  if (!(await getClientById(clientId, tenant))) return [];
  return await db.select().from(extinguishers).where(and(eq(extinguishers.clientId, clientId), eq(extinguishers.accountId, tenant))).orderBy(extinguishers.expirationDate);
}

export async function createExtinguisher(data: InsertExtinguisher, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (data.accountId !== tenant || !(await getClientById(data.clientId, tenant))) throw new Error("Cliente sem permissão");
  const result = await db.insert(extinguishers).values({ ...data, accountId: tenant });
  return Number(result[0].insertId);
}

export async function updateExtinguisher(id: number, data: Partial<InsertExtinguisher>, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  if (!existing[0]) throw new Error("Extintor sem permissão");
  const { accountId: ignoredAccountId, clientId: ignoredClientId, ...safeData } = data;
  void ignoredAccountId;
  void ignoredClientId;
  await db.update(extinguishers).set(safeData).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)));
}

export async function deleteExtinguisher(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  if (!existing[0]) throw new Error("Extintor sem permissão");
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "extinguisher", originalId: id, label: `${existing[0].typeModel} — ${existing[0].serialNumber || "sem selo"}`, snapshot: JSON.stringify(existing[0]), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await tx.delete(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)));
  });
}

export async function getExpiringExtinguishers(daysAhead: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, and(eq(extinguishers.clientId, clients.id), eq(extinguishers.accountId, clients.accountId))).where(and(eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant), sql`${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)).orderBy(extinguishers.expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return result.map(item => {
    const expDate = new Date(item.extinguisher.expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
    let alertStatus: "expired" | "urgent" | "warning" | "ok" = "ok";
    let alertMessage = "";
    if (diffDays < 0) { alertStatus = "expired"; alertMessage = `VENCIDO há ${Math.abs(diffDays)} dia(s)!`; }
    else if (diffDays <= 15) { alertStatus = "urgent"; alertMessage = diffDays === 0 ? "VENCE HOJE!" : `Vence em ${diffDays} dia(s) (Urgente)`; }
    else if (diffDays <= daysAhead) { alertStatus = "warning"; alertMessage = `Vence em ${diffDays} dia(s) (Alerta prévio)`; }
    return { ...item, diffDays, alertStatus, alertMessage, isNearExpiration: diffDays <= daysAhead };
  });
}

export async function getServiceOrdersPage(accountId: number, options: { page?: number; pageSize?: number; clientId?: number; search?: string; city?: string; from?: string; to?: string } = {}) {
  const tenant = requireAccountId(accountId); const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.clientId) conditions.push(eq(serviceOrders.clientId, options.clientId));
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.from) conditions.push(sql`${serviceOrders.orderDate} >= ${options.from}`);
  if (options.to) conditions.push(sql`${serviceOrders.orderDate} <= ${options.to}`);
  const search = options.search?.trim();
  if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.city, `%${search}%`), like(sql`CAST(${serviceOrders.orderNumber} AS CHAR)`, `%${search}%`))!);
  const where = and(...conditions);
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  const [items, totalRows] = await Promise.all([
    query.where(where).orderBy(desc(serviceOrders.orderDate), desc(serviceOrders.createdAt), desc(serviceOrders.id)).limit(pageSize).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(where),
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

export async function getOfflineSnapshot(accountId: number, options: { page?: number; pageSize?: number } = {}) {
  const tenant = requireAccountId(accountId);
  const page = Math.max(1, Math.trunc(options.page || 1));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(options.pageSize || 50)));
  const [clientsPage, extinguishersPage, ordersPage, alertsPage] = await Promise.all([
    getClientsPage(tenant, { page, pageSize }),
    getExtinguishersPage(tenant, { page, pageSize }),
    getServiceOrdersPage(tenant, { page, pageSize }),
    getExpiringExtinguishersPage(30, tenant, { page, pageSize, filter: "all" }),
  ]);
  return {
    page,
    pageSize,
    clients: clientsPage.items,
    extinguishers: extinguishersPage.items.map((row: any) => row.extinguisher),
    orders: ordersPage.items,
    alerts: alertsPage.items.map((row: any) => ({ ...row.extinguisher, ...row })),
    totals: { clients: clientsPage.total, extinguishers: extinguishersPage.total, orders: ordersPage.total, alerts: alertsPage.total },
    hasMore: { clients: page < clientsPage.totalPages, extinguishers: page < extinguishersPage.totalPages, orders: page < ordersPage.totalPages, alerts: page < alertsPage.totalPages },
  };
}

export async function getExpiringExtinguishersPage(daysAhead: number, accountId: number, options: { page?: number; pageSize?: number; filter?: "all" | "near" | "expired"; search?: string; city?: string } = {}) {
  const tenant = requireAccountId(accountId); const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.filter === "expired") conditions.push(sql`${extinguishers.expirationDate} < CURRENT_DATE()`);
  if (options.filter === "near") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`);
  if (options.filter === "all") conditions.push(sql`${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`);
  const search = options.search?.trim(); if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.city, `%${search}%`), like(extinguishers.serialNumber, `%${search}%`))!);
  const where = and(...conditions);
  const query = db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, and(eq(extinguishers.clientId, clients.id), eq(extinguishers.accountId, clients.accountId)));
  const [rows, totalRows] = await Promise.all([query.where(where).orderBy(extinguishers.expirationDate, desc(extinguishers.id)).limit(pageSize).offset(offset), db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(where)]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const items = rows.map((item) => { const expiration = new Date(item.extinguisher.expirationDate); expiration.setHours(0, 0, 0, 0); const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / 86400000); const alertStatus = diffDays < 0 ? "expired" : diffDays <= 15 ? "urgent" : "warning"; const alertMessage = diffDays < 0 ? `VENCIDO há ${Math.abs(diffDays)} dia(s)!` : diffDays === 0 ? "VENCE HOJE!" : diffDays <= 15 ? `Vence em ${diffDays} dia(s) (Urgente)` : `Vence em ${diffDays} dia(s) (Alerta prévio)`; return { ...item, diffDays, alertStatus, alertMessage, isNearExpiration: true }; });
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

/* Ordens de Serviço */
export async function getNextOrderNumber(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return 1001;
  const result = await db.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant));
  return result[0]?.maxNum ? Number(result[0].maxNum) + 1 : 1001;
}

async function allocateOrderNumber(tx: any, tenant: number) {
  const maxRows = await tx.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant));
  const currentMax = Math.max(1000, Number(maxRows[0]?.maxNum || 1000));
  await tx.insert(systemSettings).values({ accountId: tenant, settingKey: "order_sequence", settingValue: String(currentMax) }).onDuplicateKeyUpdate({
    set: { updatedAt: new Date() },
  });
  await tx.update(systemSettings).set({
    settingValue: sql`CAST(GREATEST(CAST(${systemSettings.settingValue} AS UNSIGNED), ${currentMax}) + 1 AS CHAR)`,
  }).where(and(eq(systemSettings.accountId, tenant), eq(systemSettings.settingKey, "order_sequence")));
  const rows = await tx.select({ value: systemSettings.settingValue }).from(systemSettings).where(and(eq(systemSettings.accountId, tenant), eq(systemSettings.settingKey, "order_sequence"))).limit(1);
  const nextNumber = Number(rows[0]?.value);
  if (!Number.isInteger(nextNumber) || nextNumber < 1001) throw new Error("Não foi possível reservar o número da OS.");
  return nextNumber;
}

function isDuplicateKeyError(error: unknown) {
  return Number((error as any)?.code) === 1062 || String((error as any)?.message || "").includes("Duplicate entry");
}

export async function createServiceOrder(order: InsertServiceOrder, items: Omit<InsertServiceOrderItem, "serviceOrderId">[], accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (order.accountId !== tenant || !(await getClientById(order.clientId, tenant))) throw new Error("Cliente sem permissão");
  const requestedNumber = order.orderNumber && Number.isInteger(order.orderNumber) ? order.orderNumber : undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const orderNumber = requestedNumber ?? await allocateOrderNumber(tx, tenant);
        const result = await tx.insert(serviceOrders).values({ ...order, accountId: tenant, orderNumber });
        const orderId = Number(result[0].insertId);
        if (items.length) await tx.insert(serviceOrderItems).values(items.map(item => ({ ...item, serviceOrderId: orderId })));
        return { id: orderId, orderNumber };
      });
    } catch (error) {
      if (requestedNumber !== undefined || !isDuplicateKeyError(error) || attempt === 3) throw error;
      console.warn(`[Database] OS number conflict; retrying allocation (${attempt}/3).`);
    }
  }
  throw new Error("Não foi possível criar a OS.");
}

export async function getServiceOrderById(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return null;
  const orderResult = await db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant))).limit(1);
  if (!orderResult[0]) return null;
  const items = await db.select().from(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
  return { ...orderResult[0].order, client: orderResult[0].client, items };
}

export async function getServiceOrders(clientId: number | undefined, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (clientId) conditions.push(eq(serviceOrders.clientId, clientId));
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  // O histórico deve seguir a data do atendimento informada na OS, não a data
  // técnica em que o registro foi criado ou posteriormente editado.
  return await query.where(and(...conditions)).orderBy(desc(serviceOrders.orderDate), desc(serviceOrders.createdAt));
}

export async function getServiceOrderHistory(clientId: number, accountId: number) {
  const orders = await getServiceOrders(clientId, accountId);
  const db = await getDb();
  if (!db) return [];
  const ids = orders.map(({ order }) => order.id);
  const items = ids.length ? await db.select().from(serviceOrderItems).where(inArray(serviceOrderItems.serviceOrderId, ids)) : [];
  return orders.map((entry) => ({ ...entry, items: items.filter((item) => item.serviceOrderId === entry.order.id) }));
}

export async function updateServiceOrder(id: number, order: Partial<InsertServiceOrder>, items: Omit<InsertServiceOrderItem, "serviceOrderId">[], accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await getServiceOrderById(id, tenant);
  if (!existing) throw new Error("Ordem não encontrada ou sem permissão");
  if (order.clientId && !(await getClientById(order.clientId, tenant))) throw new Error("Cliente sem permissão");
  const { accountId: ignoredAccountId, orderNumber: ignoredOrderNumber, ...safeOrder } = order;
  void ignoredAccountId; void ignoredOrderNumber;
  await db.transaction(async (tx) => {
    await tx.update(serviceOrders).set(safeOrder).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant)));
    await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
    if (items.length) await tx.insert(serviceOrderItems).values(items.map(item => ({ ...item, serviceOrderId: id })));
  });
}

export async function deleteServiceOrder(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const order = await getServiceOrderById(id, tenant);
  if (!order) throw new Error("Ordem não encontrada ou sem permissão");
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "order", originalId: id, label: `OS #${order.orderNumber}`, snapshot: JSON.stringify({ order, items: order.items }), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
    await tx.delete(serviceOrders).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant)));
  });
}

export async function listTrash(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  await db.delete(trashItems).where(and(eq(trashItems.accountId, tenant), sql`${trashItems.expiresAt} <= NOW()`));
  return await db.select().from(trashItems).where(and(eq(trashItems.accountId, tenant), sql`${trashItems.expiresAt} > NOW()`)).orderBy(desc(trashItems.deletedAt));
}

export async function cleanupExpiredData() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [trashResult, memberResult, platformResult] = await Promise.all([
    db.delete(trashItems).where(sql`${trashItems.expiresAt} <= NOW()`),
    db.delete(memberSessions).where(sql`${memberSessions.expiresAt} <= NOW()`),
    db.delete(platformSessions).where(sql`${platformSessions.expiresAt} <= NOW()`),
  ]);
  return {
    trash: Number(trashResult[0]?.affectedRows || 0),
    memberSessions: Number(memberResult[0]?.affectedRows || 0),
    platformSessions: Number(platformResult[0]?.affectedRows || 0),
  };
}

function parseTrashSnapshot(snapshot: string): any {
  try {
    return JSON.parse(snapshot);
  } catch {
    throw new Error("O item da lixeira está corrompido e não pode ser restaurado.");
  }
}

function restoreDateFields<T extends Record<string, any>>(value: T): T {
  const restored: Record<string, any> = { ...value };
  for (const key of ["createdAt", "updatedAt"] as const) {
    if (restored[key] && !(restored[key] instanceof Date)) restored[key] = new Date(restored[key]);
  }
  return restored as T;
}

export async function restoreTrashItem(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const item = (await db.select().from(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant))).limit(1))[0];
  if (!item) throw new Error("Item não encontrado na lixeira ou sem permissão.");
  if (new Date(item.expiresAt).getTime() <= Date.now()) {
    await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
    throw new Error("O prazo de restauração deste item expirou.");
  }

  const snapshot = parseTrashSnapshot(item.snapshot);
  await db.transaction(async (tx) => {
    if (item.itemType === "client") {
      const clientData = snapshot.client || snapshot;
      const orders = snapshot.orders || [];
      const items = snapshot.items || [];
      const savedExtinguishers = snapshot.extinguishers || [];
      const existingClient = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, item.originalId)).limit(1);
      if (existingClient[0]) throw new Error("Já existe um cliente com o mesmo identificador. Exclua o conflito antes de restaurar.");
      await tx.insert(clients).values({ ...restoreDateFields(clientData), id: item.originalId, accountId: tenant } as any);
      for (const extinguisher of savedExtinguishers) {
        await tx.insert(extinguishers).values({ ...restoreDateFields(extinguisher), accountId: tenant, clientId: item.originalId } as any);
      }
      for (const savedOrder of orders) {
        const { client: _client, items: _nestedItems, ...orderData } = savedOrder;
        void _client; void _nestedItems;
        await tx.insert(serviceOrders).values({ ...restoreDateFields(orderData), accountId: tenant, clientId: item.originalId } as any);
        const orderItems = items.filter((entry: any) => entry.serviceOrderId === savedOrder.id);
        if (orderItems.length) await tx.insert(serviceOrderItems).values(orderItems.map((entry: any) => ({ ...restoreDateFields(entry), serviceOrderId: savedOrder.id })) as any);
      }
    } else if (item.itemType === "order") {
      const savedOrder = snapshot.order || snapshot;
      const { client: _client, items: nestedItems, ...orderData } = savedOrder;
      void _client;
      const orderItems = snapshot.items || nestedItems || [];
      const client = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, orderData.clientId), eq(clients.accountId, tenant))).limit(1);
      if (!client[0]) throw new Error("O cliente vinculado à OS não existe mais; restaure o cliente antes.");
      await tx.insert(serviceOrders).values({ ...restoreDateFields(orderData), id: item.originalId, accountId: tenant } as any);
      if (orderItems.length) await tx.insert(serviceOrderItems).values(orderItems.map((entry: any) => ({ ...restoreDateFields(entry), serviceOrderId: item.originalId })) as any);
    } else if (item.itemType === "extinguisher") {
      const clientId = snapshot.clientId;
      const client = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.accountId, tenant))).limit(1);
      if (!client[0]) throw new Error("O cliente vinculado ao extintor não existe mais; restaure o cliente antes.");
      await tx.insert(extinguishers).values({ ...restoreDateFields(snapshot), id: item.originalId, accountId: tenant } as any);
    } else {
      throw new Error("Tipo de item da lixeira não reconhecido.");
    }
    await tx.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  });
}

export async function permanentlyDeleteTrashItem(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  if (!result[0]?.affectedRows) throw new Error("Item não encontrado na lixeira ou sem permissão.");
}

/* Configuração por empresa */
export async function getSetting(key: string, accountId: number, defaultValue = "30") {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return defaultValue;
  const result = await db.select().from(systemSettings).where(and(eq(systemSettings.settingKey, key), eq(systemSettings.accountId, tenant))).limit(1);
  return result[0]?.settingValue ?? defaultValue;
}

export async function setSetting(key: string, value: string, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.insert(systemSettings).values({ accountId: tenant, settingKey: key, settingValue: value }).onDuplicateKeyUpdate({ set: { settingValue: value } });
}

export async function getDashboardStats(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return { totalClients: 0, totalCities: 0, totalExtinguishers: 0, nearExpirationCount: 0, expiredCount: 0, totalOrders: 0, alertDaysConfig: 30 };
  const daysAhead = parseInt(await getSetting("alert_days_ahead", tenant, "30"), 10) || 30;
  const allClients = await getClients(undefined, tenant);
  const cityCount = new Set(allClients.map(client => client.city)).size;
  const [extinguisherTotalRows, expiredRows, nearRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(eq(extinguishers.accountId, tenant)),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(and(eq(extinguishers.accountId, tenant), sql`${extinguishers.expirationDate} < CURRENT_DATE()`)),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(and(eq(extinguishers.accountId, tenant), sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)),
  ]);
  const totalExtinguishers = Number(extinguisherTotalRows[0]?.total || 0);
  const expiredCount = Number(expiredRows[0]?.total || 0);
  const nearExpirationCount = Number(nearRows[0]?.total || 0);
  const orders = await getServiceOrders(undefined, tenant);
  return { totalClients: allClients.length, totalCities: cityCount, totalExtinguishers, nearExpirationCount, expiredCount, totalOrders: orders.length, alertDaysConfig: daysAhead };
}
