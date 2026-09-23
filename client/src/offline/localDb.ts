import Dexie, { type Table } from "dexie";

export type LocalRecord = Record<string, any> & { id: number };
export type LocalOrderRow = { order: LocalRecord; client: LocalRecord };
export type OfflineMutation = { id?: number; entity: "client" | "extinguisher" | "order"; action: "create" | "delete"; payload: any; createdAt: string };

class ExtintoresOfflineDB extends Dexie {
  clients!: Table<LocalRecord, number>;
  extinguishers!: Table<LocalRecord, number>;
  orders!: Table<LocalOrderRow, number>;
  alerts!: Table<LocalRecord, number>;
  settings!: Table<{ key: string; value: any }, string>;
  meta!: Table<{ key: string; value: any }, string>;
  mutations!: Table<OfflineMutation, number>;

  constructor() {
    super("gestao-extintores-offline");
    this.version(1).stores({
      clients: "id, city, updatedAt",
      extinguishers: "id, clientId, expirationDate, status",
      orders: "&order.id, order.clientId, order.orderDate",
      alerts: "id, clientId, alertStatus, expirationDate",
      settings: "&key",
      meta: "&key",
      mutations: "++id, createdAt",
    });
  }
}

export const offlineDb = new ExtintoresOfflineDB();

export async function saveOnlineSnapshot(snapshot: {
  clients?: LocalRecord[];
  extinguishers?: LocalRecord[];
  orders?: LocalOrderRow[];
  alerts?: LocalRecord[];
  alertDays?: number;
}) {
  await offlineDb.transaction("rw", [offlineDb.clients, offlineDb.extinguishers, offlineDb.orders, offlineDb.alerts, offlineDb.settings, offlineDb.meta], async () => {
    if (snapshot.clients) await offlineDb.clients.bulkPut(snapshot.clients);
    if (snapshot.extinguishers) await offlineDb.extinguishers.bulkPut(snapshot.extinguishers);
    if (snapshot.orders) await offlineDb.orders.bulkPut(snapshot.orders);
    if (snapshot.alerts) await offlineDb.alerts.bulkPut(snapshot.alerts);
    if (snapshot.alertDays) await offlineDb.settings.put({ key: "alertDays", value: snapshot.alertDays });
    await offlineDb.meta.put({ key: "lastOnlineSync", value: new Date().toISOString() });
  });
}

export async function exportOfflineBackup() {
  return {
    format: "gestao-extintores-offline-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    clients: await offlineDb.clients.toArray(),
    extinguishers: await offlineDb.extinguishers.toArray(),
    orders: await offlineDb.orders.toArray(),
    alerts: await offlineDb.alerts.toArray(),
    settings: await offlineDb.settings.toArray(),
    mutations: await offlineDb.mutations.toArray(),
  };
}

export async function importOfflineBackup(payload: any) {
  if (!payload || payload.format !== "gestao-extintores-offline-backup") throw new Error("Arquivo de backup inválido.");
  await offlineDb.transaction("rw", [offlineDb.clients, offlineDb.extinguishers, offlineDb.orders, offlineDb.alerts, offlineDb.settings, offlineDb.meta], async () => {
    await offlineDb.clients.clear();
    await offlineDb.extinguishers.clear();
    await offlineDb.orders.clear();
    await offlineDb.alerts.clear();
    await offlineDb.settings.clear();
    await offlineDb.mutations.clear();
    if (Array.isArray(payload.clients)) await offlineDb.clients.bulkPut(payload.clients);
    if (Array.isArray(payload.extinguishers)) await offlineDb.extinguishers.bulkPut(payload.extinguishers);
    if (Array.isArray(payload.orders)) await offlineDb.orders.bulkPut(payload.orders);
    if (Array.isArray(payload.alerts)) await offlineDb.alerts.bulkPut(payload.alerts);
    if (Array.isArray(payload.settings)) await offlineDb.settings.bulkPut(payload.settings);
    if (Array.isArray(payload.mutations)) await offlineDb.mutations.bulkPut(payload.mutations);
    await offlineDb.meta.put({ key: "lastBackupImport", value: new Date().toISOString() });
  });
}

export async function clearOfflineData() {
  await Promise.all([offlineDb.clients.clear(), offlineDb.extinguishers.clear(), offlineDb.orders.clear(), offlineDb.alerts.clear(), offlineDb.settings.clear(), offlineDb.mutations.clear()]);
}

export async function queueOfflineMutation(mutation: Omit<OfflineMutation, "createdAt">) {
  await offlineDb.mutations.add({ ...mutation, createdAt: new Date().toISOString() });
}
