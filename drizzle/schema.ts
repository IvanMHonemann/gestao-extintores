import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, boolean } from "drizzle-orm/mysql-core";

/**
 * Usuários do sistema
 */
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

/**
 * Tabela de Clientes
 * Separados por cidade, com endereço, CNPJ, telefone, responsável, CPF e data de nascimento
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }).notNull(), // EMPRESA
  cnpj: varchar("cnpj", { length: 30 }),                         // CNPJ
  address: text("address"),                                       // ENDEREÇO
  city: varchar("city", { length: 120 }).notNull(),               // CIDADE (critério de agrupamento)
  cep: varchar("cep", { length: 20 }),                           // CEP
  phone: varchar("phone", { length: 50 }),                       // FONE
  contactName: varchar("contactName", { length: 255 }),           // NOME DO PROPRIETARIO OU RESPONSAVEL
  cpf: varchar("cpf", { length: 30 }),                           // CPF
  birthDate: varchar("birthDate", { length: 20 }),               // DATA DE NASCIMENTO
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Tabela de Extintores cadastrados no cliente
 * Acompanha quantidade, modelo, data de vencimento e localização/número de série
 */
export const extinguishers = mysqlTable("extinguishers", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  typeModel: varchar("typeModel", { length: 100 }).notNull(),     // Ex: AP 10L, PQS 4kg, PQS 6kg, CO2 6kg, ABC 4kg
  capacity: varchar("capacity", { length: 50 }),                  // Ex: 4kg, 6kg, 10L
  serialNumber: varchar("serialNumber", { length: 100 }),         // Número do cilindro / selo Inmetro
  locationInBuilding: varchar("locationInBuilding", { length: 200 }), // Ex: Recepção, Cozinha, Corredor 1º andar
  expirationDate: date("expirationDate").notNull(),               // Data de Vencimento
  lastInspectionDate: date("lastInspectionDate"),                 // Data da última revisão/recarga
  status: mysqlEnum("status", ["ok", "warning", "expired"]).default("ok").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Extinguisher = typeof extinguishers.$inferSelect;
export type InsertExtinguisher = typeof extinguishers.$inferInsert;

/**
 * Ordens de Serviço
 * Reproduz fielmente a ficha da Efraim Extintores
 */
export const serviceOrders = mysqlTable("service_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: int("orderNumber").notNull(),                      // Número da OS sequencial
  orderDate: date("orderDate").notNull(),                         // DATA: __/__/____
  clientId: int("clientId").notNull(),

  // DADOS ESPECÍFICOS DA FICHA
  replacedAndDelivered: varchar("replacedAndDelivered", { length: 10 }).default("SIM"), // TROCADO E ENTREGUE: ( ) SIM ( ) NÃO
  leftReserve: varchar("leftReserve", { length: 10 }).default("NÃO"),                   // DEIXOU RESERVA: ( ) SIM ( ) NÃO
  reserveDetails: varchar("reserveDetails", { length: 255 }),                            // QUAIS:
  extinguisherExpiration: varchar("extinguisherExpiration", { length: 100 }),            // VENCIMENTO DO EXTINTOR:
  licenseExpiration: varchar("licenseExpiration", { length: 100 }),                      // VENCIMENTO DO ALVARÁ:

  // FORMA DE PAGAMENTO
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00").notNull(), // VALOR TOTAL: R$
  paymentMethod: varchar("paymentMethod", { length: 50 }).default("A VISTA"),            // A VISTA / PARCELADO / BOLETO
  installmentsCount: int("installmentsCount").default(1),                                // NÚMEROS DE PARCELAS
  installmentDates: varchar("installmentDates", { length: 255 }),                        // DATAS:

  // ASSINATURAS E RESPONSÁVEIS
  responsibleName: varchar("responsibleName", { length: 255 }),
  responsibleCpf: varchar("responsibleCpf", { length: 30 }),
  responsibleBirthDate: varchar("responsibleBirthDate", { length: 20 }),

  observations: text("observations"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

/**
 * Itens / Serviços Prestados na Ordem de Serviço
 * (Tabela central da ficha: DESCRIÇÃO | QTD. | VALOR UNID | VALOR TOTAL)
 */
export const serviceOrderItems = mysqlTable("service_order_items", {
  id: int("id").autoincrement().primaryKey(),
  serviceOrderId: int("serviceOrderId").notNull(),
  description: varchar("description", { length: 255 }).notNull(), // DESCRIÇÃO
  quantity: int("quantity").notNull().default(1),                 // QTD.
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0.00").notNull(), // VALOR UNID
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0.00").notNull(), // VALOR TOTAL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type InsertServiceOrderItem = typeof serviceOrderItems.$inferInsert;

/**
 * Configurações do Sistema
 * Ex: Dias de antecedência padrão para alerta de vencimento (ex: 30 dias, 60 dias)
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
