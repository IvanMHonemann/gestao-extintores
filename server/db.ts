import { and, desc, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  clients,
  extinguishers,
  serviceOrders,
  serviceOrderItems,
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

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireAccountId(accountId: number | undefined): number {
  if (typeof accountId !== "number" || !Number.isInteger(accountId) || accountId <= 0) throw new Error("Tenant comercial obrigatório");
  return accountId;
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
    values.role = user.role ?? "admin";
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
  const tenantOrders = await db.select({ id: serviceOrders.id }).from(serviceOrders).where(and(eq(serviceOrders.clientId, id), eq(serviceOrders.accountId, tenant)));
  await db.transaction(async (tx) => {
    for (const order of tenantOrders) {
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

/* Extintores */
export async function getExtinguishersByClient(clientId: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  if (!(await getClientById(clientId, tenant))) return [];
  return await db.select().from(extinguishers)
    .where(and(eq(extinguishers.clientId, clientId), eq(extinguishers.accountId, tenant)))
    .orderBy(extinguishers.expirationDate);
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
  const existing = await db.select({ id: extinguishers.id }).from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  if (!existing[0]) throw new Error("Extintor sem permissão");
  await db.delete(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)));
}

export async function getExpiringExtinguishers(daysAhead: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ extinguisher: extinguishers, client: clients })
    .from(extinguishers)
    .innerJoin(clients, and(eq(extinguishers.clientId, clients.id), eq(extinguishers.accountId, clients.accountId)))
    .where(and(eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant)))
    .orderBy(extinguishers.expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return result.map(item => {
    const expDate = new Date(item.extinguisher.expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
    let alertStatus: "expired" | "urgent" | "warning" | "ok" = "ok";
    let alertMessage = "";
    if (diffDays < 0) {
      alertStatus = "expired";
      alertMessage = `VENCIDO há ${Math.abs(diffDays)} dia(s)!`;
    } else if (diffDays <= 15) {
      alertStatus = "urgent";
      alertMessage = diffDays === 0 ? "VENCE HOJE!" : `Vence em ${diffDays} dia(s) (Urgente)`;
    } else if (diffDays <= daysAhead) {
      alertStatus = "warning";
      alertMessage = `Vence em ${diffDays} dia(s) (Alerta prévio)`;
    }
    return { ...item, diffDays, alertStatus, alertMessage, isNearExpiration: diffDays <= daysAhead };
  });
}

/* Ordens de Serviço */
export async function getNextOrderNumber(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return 1001;
  const result = await db.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` })
    .from(serviceOrders).where(eq(serviceOrders.accountId, tenant));
  return result[0]?.maxNum ? Number(result[0].maxNum) + 1 : 1001;
}

export async function createServiceOrder(order: InsertServiceOrder, items: Omit<InsertServiceOrderItem, "serviceOrderId">[], accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (order.accountId !== tenant || !(await getClientById(order.clientId, tenant))) throw new Error("Cliente sem permissão");
  const orderNumber = order.orderNumber || await getNextOrderNumber(tenant);
  const result = await db.insert(serviceOrders).values({ ...order, accountId: tenant, orderNumber });
  const orderId = Number(result[0].insertId);
  if (items.length) await db.insert(serviceOrderItems).values(items.map(item => ({ ...item, serviceOrderId: orderId })));
  return { id: orderId, orderNumber };
}

export async function getServiceOrderById(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return null;
  const orderResult = await db.select({ order: serviceOrders, client: clients })
    .from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id))
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant))).limit(1);
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
  const query = db.select({ order: serviceOrders, client: clients })
    .from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  return await query.where(and(...conditions)).orderBy(desc(serviceOrders.createdAt));
}

export async function deleteServiceOrder(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const order = await getServiceOrderById(id, tenant);
  if (!order) throw new Error("Ordem não encontrada ou sem permissão");
  await db.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
  await db.delete(serviceOrders).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant)));
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
  const extinguisherResult = await db.select({ extinguisher: extinguishers })
    .from(extinguishers).where(eq(extinguishers.accountId, tenant));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let nearExpirationCount = 0;
  let expiredCount = 0;
  for (const row of extinguisherResult) {
    const expiration = new Date(row.extinguisher.expirationDate);
    expiration.setHours(0, 0, 0, 0);
    if (expiration < today) expiredCount++;
    else if (expiration.getTime() <= today.getTime() + daysAhead * 86400000) nearExpirationCount++;
  }
  const orders = await getServiceOrders(undefined, tenant);
  return { totalClients: allClients.length, totalCities: cityCount, totalExtinguishers: extinguisherResult.length, nearExpirationCount, expiredCount, totalOrders: orders.length, alertDaysConfig: daysAhead };
}
