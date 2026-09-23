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
import { ENV } from './_core/env';

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

function accountCondition(accountId?: number) {
  return accountId ? eq(clients.accountId, accountId) : undefined;
}

/* Clientes */
export async function getClients(cityFilter?: string, accountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (cityFilter && cityFilter !== "TODAS") conditions.push(eq(clients.city, cityFilter));
  if (accountId) conditions.push(eq(clients.accountId, accountId));
  const query = db.select().from(clients);
  return conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(clients.createdAt))
    : await query.orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number, accountId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = [eq(clients.id, id)];
  if (accountId) conditions.push(eq(clients.accountId, accountId));
  const result = await db.select().from(clients).where(and(...conditions)).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(clients).values(data);
  return Number(result[0].insertId);
}

export async function updateClient(id: number, data: Partial<InsertClient>, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, accountId);
  if (!client) throw new Error("Cliente não encontrado ou sem permissão");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

export async function deleteClient(id: number, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, accountId);
  if (!client) throw new Error("Cliente não encontrado ou sem permissão");
  await db.delete(extinguishers).where(eq(extinguishers.clientId, id));
  await db.delete(clients).where(eq(clients.id, id));
}

export async function getDistinctCities(accountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.selectDistinct({ city: clients.city }).from(clients);
  const result = accountId
    ? await query.where(eq(clients.accountId, accountId)).orderBy(clients.city)
    : await query.orderBy(clients.city);
  return result.map(row => row.city).filter(Boolean);
}

/* Extintores */
export async function getExtinguishersByClient(clientId: number, accountId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (accountId && !(await getClientById(clientId, accountId))) return [];
  return await db.select().from(extinguishers)
    .where(eq(extinguishers.clientId, clientId))
    .orderBy(extinguishers.expirationDate);
}

export async function createExtinguisher(data: InsertExtinguisher, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (accountId && !(await getClientById(data.clientId, accountId))) throw new Error("Cliente sem permissão");
  const result = await db.insert(extinguishers).values(data);
  return Number(result[0].insertId);
}

export async function updateExtinguisher(id: number, data: Partial<InsertExtinguisher>, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(eq(extinguishers.id, id)).limit(1);
  if (!existing[0] || (accountId && !(await getClientById(existing[0].clientId, accountId)))) throw new Error("Extintor sem permissão");
  await db.update(extinguishers).set(data).where(eq(extinguishers.id, id));
}

export async function deleteExtinguisher(id: number, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(eq(extinguishers.id, id)).limit(1);
  if (!existing[0] || (accountId && !(await getClientById(existing[0].clientId, accountId)))) throw new Error("Extintor sem permissão");
  await db.delete(extinguishers).where(eq(extinguishers.id, id));
}

export async function getExpiringExtinguishers(daysAhead = 30, accountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const base = db.select({ extinguisher: extinguishers, client: clients })
    .from(extinguishers)
    .innerJoin(clients, eq(extinguishers.clientId, clients.id));
  const result = accountId
    ? await base.where(eq(clients.accountId, accountId)).orderBy(extinguishers.expirationDate)
    : await base.orderBy(extinguishers.expirationDate);

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
export async function getNextOrderNumber(accountId?: number) {
  const db = await getDb();
  if (!db) return 1001;
  if (accountId) {
    const result = await db.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` })
      .from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(clients.accountId, accountId));
    return result[0]?.maxNum ? Number(result[0].maxNum) + 1 : 1001;
  }
  const result = await db.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders);
  return result[0]?.maxNum ? Number(result[0].maxNum) + 1 : 1001;
}

export async function createServiceOrder(order: InsertServiceOrder, items: Omit<InsertServiceOrderItem, "serviceOrderId">[], accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (accountId && !(await getClientById(order.clientId, accountId))) throw new Error("Cliente sem permissão");
  const orderNumber = order.orderNumber || await getNextOrderNumber(accountId);
  const result = await db.insert(serviceOrders).values({ ...order, orderNumber });
  const orderId = Number(result[0].insertId);
  if (items.length) await db.insert(serviceOrderItems).values(items.map(item => ({ ...item, serviceOrderId: orderId })));
  return { id: orderId, orderNumber };
}

export async function getServiceOrderById(id: number, accountId?: number) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(serviceOrders.id, id)];
  if (accountId) conditions.push(eq(clients.accountId, accountId));
  const orderResult = await db.select({ order: serviceOrders, client: clients })
    .from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id))
    .where(and(...conditions)).limit(1);
  if (!orderResult[0]) return null;
  const items = await db.select().from(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
  return { ...orderResult[0].order, client: orderResult[0].client, items };
}

export async function getServiceOrders(clientId?: number, accountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (clientId) conditions.push(eq(serviceOrders.clientId, clientId));
  if (accountId) conditions.push(eq(clients.accountId, accountId));
  const query = db.select({ order: serviceOrders, client: clients })
    .from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  return conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(serviceOrders.createdAt))
    : await query.orderBy(desc(serviceOrders.createdAt));
}

export async function deleteServiceOrder(id: number, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const order = await getServiceOrderById(id, accountId);
  if (!order) throw new Error("Ordem não encontrada ou sem permissão");
  await db.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
  await db.delete(serviceOrders).where(eq(serviceOrders.id, id));
}

/* Configuração global */
export async function getSetting(key: string, defaultValue = "30") {
  const db = await getDb();
  if (!db) return defaultValue;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
  return result[0]?.settingValue ?? defaultValue;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.insert(systemSettings).values({ settingKey: key, settingValue: value }).onDuplicateKeyUpdate({ set: { settingValue: value } });
}

export async function getDashboardStats(accountId?: number) {
  const db = await getDb();
  if (!db) return { totalClients: 0, totalCities: 0, totalExtinguishers: 0, nearExpirationCount: 0, expiredCount: 0, totalOrders: 0, alertDaysConfig: 30 };
  const daysAhead = parseInt(await getSetting("alert_days_ahead", "30"), 10) || 30;
  const allClients = await getClients(undefined, accountId);
  const cityCount = new Set(allClients.map(client => client.city)).size;
  const extinguisherResult = accountId
    ? await db.select({ extinguisher: extinguishers }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(eq(clients.accountId, accountId))
    : await db.select({ extinguisher: extinguishers }).from(extinguishers);
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
  const orders = await getServiceOrders(undefined, accountId);
  return { totalClients: allClients.length, totalCities: cityCount, totalExtinguishers: extinguisherResult.length, nearExpirationCount, expiredCount, totalOrders: orders.length, alertDaysConfig: daysAhead };
}
