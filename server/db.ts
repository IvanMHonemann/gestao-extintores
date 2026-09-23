import { and, desc, eq, sql, inArray, gte, lte, or } from "drizzle-orm";
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
  type InsertUser 
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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* ========================================================
   CLIENTES (com agregação por cidade e contagem de extintores)
======================================================== */

export async function getClients(cityFilter?: string) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(clients);
  if (cityFilter && cityFilter !== "TODAS") {
    return await query.where(eq(clients.city, cityFilter)).orderBy(desc(clients.createdAt));
  }
  return await query.orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const res = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return res[0];
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(clients).values(data);
  return result[0].insertId;
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  // Remove extintores e OS vinculados
  await db.delete(extinguishers).where(eq(extinguishers.clientId, id));
  await db.delete(clients).where(eq(clients.id, id));
}

export async function getDistinctCities() {
  const db = await getDb();
  if (!db) return [];
  const res = await db.selectDistinct({ city: clients.city }).from(clients).orderBy(clients.city);
  return res.map(r => r.city).filter(Boolean);
}

/* ========================================================
   EXTINTORES (com verificação de vencimento e alertas)
======================================================== */

export async function getExtinguishersByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(extinguishers).where(eq(extinguishers.clientId, clientId)).orderBy(extinguishers.expirationDate);
}

export async function createExtinguisher(data: InsertExtinguisher) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const res = await db.insert(extinguishers).values(data);
  return res[0].insertId;
}

export async function updateExtinguisher(id: number, data: Partial<InsertExtinguisher>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(extinguishers).set(data).where(eq(extinguishers.id, id));
}

export async function deleteExtinguisher(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(extinguishers).where(eq(extinguishers.id, id));
}

/**
 * Retorna extintores com status de alerta ou vencidos
 * @param daysAhead Dias de antecedência para considerar em alerta (ex: 30, 45, 60 dias)
 */
export async function getExpiringExtinguishers(daysAhead: number = 30) {
  const db = await getDb();
  if (!db) return [];

  // Obter todos os extintores com os dados do cliente
  const result = await db
    .select({
      extinguisher: extinguishers,
      client: clients,
    })
    .from(extinguishers)
    .innerJoin(clients, eq(extinguishers.clientId, clients.id))
    .orderBy(extinguishers.expirationDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date();
  targetDate.setDate(today.getDate() + daysAhead);
  targetDate.setHours(23, 59, 59, 999);

  return result.map(item => {
    const expDate = new Date(item.extinguisher.expirationDate);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let alertStatus: "expired" | "urgent" | "warning" | "ok" = "ok";
    let alertMessage = "";

    if (diffDays < 0) {
      alertStatus = "expired";
      alertMessage = `VENCIDO há ${Math.abs(diffDays)} dia(s)!`;
    } else if (diffDays === 0) {
      alertStatus = "urgent";
      alertMessage = `VENCE HOJE!`;
    } else if (diffDays <= 15) {
      alertStatus = "urgent";
      alertMessage = `Vence em ${diffDays} dia(s) (Urgente)`;
    } else if (diffDays <= daysAhead) {
      alertStatus = "warning";
      alertMessage = `Vence em ${diffDays} dia(s) (Alerta prévio)`;
    }

    return {
      ...item,
      diffDays,
      alertStatus,
      alertMessage,
      isNearExpiration: diffDays <= daysAhead,
    };
  });
}

/* ========================================================
   ORDENS DE SERVIÇO (com itens e numeração sequencial)
======================================================== */

export async function getNextOrderNumber(): Promise<number> {
  const db = await getDb();
  if (!db) return 1001;
  const res = await db.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders);
  const max = res[0]?.maxNum;
  return max ? Number(max) + 1 : 1001;
}

export async function createServiceOrder(
  order: any,
  items: Omit<InsertServiceOrderItem, "serviceOrderId">[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  const orderNum = order.orderNumber || (await getNextOrderNumber());
  const res = await db.insert(serviceOrders).values({
    ...order,
    orderNumber: orderNum,
  });
  const orderId = res[0].insertId;

  if (items && items.length > 0) {
    const itemsToInsert = items.map(item => ({
      ...item,
      serviceOrderId: orderId,
    }));
    await db.insert(serviceOrderItems).values(itemsToInsert);
  }

  return { id: orderId, orderNumber: orderNum };
}

export async function getServiceOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const orderRes = await db
    .select({
      order: serviceOrders,
      client: clients,
    })
    .from(serviceOrders)
    .innerJoin(clients, eq(serviceOrders.clientId, clients.id))
    .where(eq(serviceOrders.id, id))
    .limit(1);

  if (!orderRes.length) return null;

  const items = await db
    .select()
    .from(serviceOrderItems)
    .where(eq(serviceOrderItems.serviceOrderId, id));

  return {
    ...orderRes[0].order,
    client: orderRes[0].client,
    items,
  };
}

export async function getServiceOrders(clientId?: number) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      order: serviceOrders,
      client: clients,
    })
    .from(serviceOrders)
    .innerJoin(clients, eq(serviceOrders.clientId, clients.id));

  if (clientId) {
    return await query.where(eq(serviceOrders.clientId, clientId)).orderBy(desc(serviceOrders.createdAt));
  }
  return await query.orderBy(desc(serviceOrders.createdAt));
}

export async function deleteServiceOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
  await db.delete(serviceOrders).where(eq(serviceOrders.id, id));
}

/* ========================================================
   CONFIGURAÇÕES DO SISTEMA (ex: antecedência de alertas)
======================================================== */

export async function getSetting(key: string, defaultValue: string = "30"): Promise<string> {
  const db = await getDb();
  if (!db) return defaultValue;
  const res = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
  return res[0]?.settingValue ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.insert(systemSettings).values({
    settingKey: key,
    settingValue: value,
  }).onDuplicateKeyUpdate({
    set: { settingValue: value },
  });
}

/**
 * Resumo para o Dashboard
 */
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalClients: 0,
      totalCities: 0,
      totalExtinguishers: 0,
      nearExpirationCount: 0,
      expiredCount: 0,
      totalOrders: 0,
    };
  }

  const daysAheadStr = await getSetting("alert_days_ahead", "30");
  const daysAhead = parseInt(daysAheadStr, 10) || 30;

  const allClients = await db.select().from(clients);
  const citiesSet = new Set(allClients.map(c => c.city).filter(Boolean));

  const allExtinguishers = await db.select().from(extinguishers);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date();
  targetDate.setDate(today.getDate() + daysAhead);
  targetDate.setHours(23, 59, 59, 999);

  let nearExpirationCount = 0;
  let expiredCount = 0;

  for (const ext of allExtinguishers) {
    const exp = new Date(ext.expirationDate);
    exp.setHours(0, 0, 0, 0);
    if (exp < today) {
      expiredCount++;
    } else if (exp <= targetDate) {
      nearExpirationCount++;
    }
  }

  const allOrders = await db.select().from(serviceOrders);

  return {
    totalClients: allClients.length,
    totalCities: citiesSet.size,
    totalExtinguishers: allExtinguishers.length,
    nearExpirationCount,
    expiredCount,
    totalOrders: allOrders.length,
    alertDaysConfig: daysAhead,
  };
}
