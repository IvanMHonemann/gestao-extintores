import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, boolean } from "drizzle-orm/mysql-core";

/** Usuários administrativos do provedor de identidade */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Empresas/usuários comerciais criados pelo administrador */
export const memberAccounts = mysqlTable("member_accounts", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MemberAccount = typeof memberAccounts.$inferSelect;
export type InsertMemberAccount = typeof memberAccounts.$inferInsert;

/** Sessões próprias dos usuários comerciais */
export const memberSessions = mysqlTable("member_sessions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MemberSession = typeof memberSessions.$inferSelect;
export type InsertMemberSession = typeof memberSessions.$inferInsert;

/** Clientes pertencem à área do administrador (null) ou a um usuário comercial */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 30 }),
  address: text("address"),
  city: varchar("city", { length: 120 }).notNull(),
  cep: varchar("cep", { length: 20 }),
  phone: varchar("phone", { length: 50 }),
  contactName: varchar("contactName", { length: 255 }),
  cpf: varchar("cpf", { length: 30 }),
  birthDate: varchar("birthDate", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const extinguishers = mysqlTable("extinguishers", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  typeModel: varchar("typeModel", { length: 100 }).notNull(),
  capacity: varchar("capacity", { length: 50 }),
  serialNumber: varchar("serialNumber", { length: 100 }),
  locationInBuilding: varchar("locationInBuilding", { length: 200 }),
  expirationDate: date("expirationDate").notNull(),
  lastInspectionDate: date("lastInspectionDate"),
  status: mysqlEnum("status", ["ok", "warning", "expired"]).default("ok").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Extinguisher = typeof extinguishers.$inferSelect;
export type InsertExtinguisher = typeof extinguishers.$inferInsert;

export const serviceOrders = mysqlTable("service_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: int("orderNumber").notNull(),
  orderDate: date("orderDate").notNull(),
  clientId: int("clientId").notNull(),
  replacedAndDelivered: varchar("replacedAndDelivered", { length: 10 }).default("SIM"),
  leftReserve: varchar("leftReserve", { length: 10 }).default("NÃO"),
  reserveDetails: varchar("reserveDetails", { length: 255 }),
  extinguisherExpiration: varchar("extinguisherExpiration", { length: 100 }),
  licenseExpiration: varchar("licenseExpiration", { length: 100 }),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }).default("A VISTA"),
  installmentsCount: int("installmentsCount").default(1),
  installmentDates: varchar("installmentDates", { length: 255 }),
  responsibleName: varchar("responsibleName", { length: 255 }),
  responsibleCpf: varchar("responsibleCpf", { length: 30 }),
  responsibleBirthDate: varchar("responsibleBirthDate", { length: 20 }),
  observations: text("observations"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

export const serviceOrderItems = mysqlTable("service_order_items", {
  id: int("id").autoincrement().primaryKey(),
  serviceOrderId: int("serviceOrderId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type InsertServiceOrderItem = typeof serviceOrderItems.$inferInsert;

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
