import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { offlineDb, pruneOfflineMutations, saveOnlineSnapshot, type LocalOrderRow, type LocalRecord, type OfflineMutation } from "./localDb";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);
  return isOnline;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const launchStarted = useRef(false);

  const openInstalledApp = useCallback(() => {
    if (launchStarted.current) return;
    launchStarted.current = true;
    const appUrl = `${window.location.origin}/`;
    const appWindow = window.open(appUrl, "gestao-extintores-app");
    if (appWindow) {
      appWindow.focus();
      window.setTimeout(() => { if (!window.matchMedia("(display-mode: standalone)").matches) window.close(); }, 150);
    } else {
      // Alguns navegadores bloqueiam uma nova janela após o prompt; nesse
      // caso, navegar para a URL inicial ainda permite que o sistema abra o
      // PWA instalado conforme o suporte do dispositivo.
      window.location.replace(appUrl);
    }
  }, []);

  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    const installed = () => {
      setIsInstalling(false);
      setInstallProgress(100);
      setDeferredPrompt(null);
      window.setTimeout(openInstalledApp, 250);
    };
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
  }, [openInstalledApp]);
  const install = async () => {
    if (!deferredPrompt || isInstalling) return false;
    setIsInstalling(true);
    setInstallProgress(15);
    await new Promise((resolve) => setTimeout(resolve, 180));
    await deferredPrompt.prompt();
    setInstallProgress(55);
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallProgress(85);
      await new Promise((resolve) => setTimeout(resolve, 350));
      setInstallProgress(100);
      setDeferredPrompt(null);
      setIsInstalling(false);
      // appinstalled é o caminho principal; este fallback cobre WebViews e
      // navegadores que concluem a instalação sem emitir esse evento.
      window.setTimeout(openInstalledApp, 900);
      return true;
    }
    setInstallProgress(0);
    setIsInstalling(false);
    return false;
  };
  return { canInstall: Boolean(deferredPrompt), install, isInstalling, installProgress };
}

export function useOfflineSnapshot(remote: {
  tenantKey: string | null;
  clients?: LocalRecord[];
  extinguishers?: LocalRecord[];
  orders?: LocalOrderRow[];
  alerts?: LocalRecord[];
  alertDays?: number;
}) {
  const isOnline = useOnlineStatus();
  const tenantKey = remote.tenantKey;
  const localClients = useLiveQuery(() => tenantKey ? offlineDb.clients.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalRecord[]), [tenantKey], [] as LocalRecord[]);
  const localExtinguishers = useLiveQuery(() => tenantKey ? offlineDb.extinguishers.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalRecord[]), [tenantKey], [] as LocalRecord[]);
  const localOrders = useLiveQuery(() => tenantKey ? offlineDb.orders.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalOrderRow[]), [tenantKey], [] as LocalOrderRow[]);
  const localAlerts = useLiveQuery(() => tenantKey ? offlineDb.alerts.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalRecord[]), [tenantKey], [] as LocalRecord[]);
  const localMutations = useLiveQuery(() => tenantKey ? offlineDb.mutations.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as OfflineMutation[]), [tenantKey], [] as OfflineMutation[]);
  const localAlertDays = useLiveQuery(() => tenantKey ? offlineDb.settings.get(`${tenantKey}:alertDays`) : Promise.resolve(undefined), [tenantKey], undefined);

  useEffect(() => {
    if (!isOnline || !tenantKey) return;
    void pruneOfflineMutations(tenantKey);
    if (remote.clients || remote.extinguishers || remote.orders || remote.alerts) void saveOnlineSnapshot(remote as { tenantKey: string; clients?: LocalRecord[]; extinguishers?: LocalRecord[]; orders?: LocalOrderRow[]; alerts?: LocalRecord[]; alertDays?: number });
  }, [isOnline, tenantKey, remote.clients, remote.extinguishers, remote.orders, remote.alerts, remote.alertDays]);

  return useMemo(() => {
    const mergePending = (remoteRows: any[] | undefined, localRows: any[], entity: OfflineMutation["entity"], getId: (row: any) => number) => {
      const mutations = localMutations.filter((mutation) => mutation.entity === entity && (mutation.state || "pending") === "pending");
      const written = new Set(mutations.filter((mutation) => mutation.action !== "delete").map((mutation) => Number(mutation.payload?.localId ?? mutation.payload?.id)));
      const deleted = new Set(mutations.filter((mutation) => mutation.action === "delete").map((mutation) => Number(mutation.payload?.id)));
      const merged = (remoteRows || []).filter((row) => !deleted.has(Number(getId(row))) && !deleted.has(Number(row.clientId ?? row.order?.clientId)) && !written.has(Number(getId(row))));
      const remoteIds = new Set(merged.map(getId).map(Number));
      for (const row of localRows) {
        const id = Number(getId(row));
        if (written.has(id) && !remoteIds.has(id)) merged.push(row);
        if (id < 0 && !remoteIds.has(id)) merged.push(row);
      }
      return merged;
    };
    const clients = mergePending(remote.clients, localClients, "client", (row) => row.id);
    const extinguishers = mergePending(remote.extinguishers, localExtinguishers, "extinguisher", (row) => row.id);
    const orders = mergePending(remote.orders, localOrders, "order", (row) => row.order?.id ?? row.id);
    return {
    isOnline,
    clients: isOnline && remote.clients ? clients : localClients,
    extinguishers: isOnline && remote.extinguishers ? extinguishers : localExtinguishers,
    orders: isOnline && remote.orders ? orders : localOrders,
    alerts: isOnline && remote.alerts ? remote.alerts : localAlerts,
    alertDays: isOnline && remote.alertDays !== undefined ? remote.alertDays : ((localAlertDays as any)?.value || remote.alertDays || 30),
    };
  }, [isOnline, remote.clients, remote.extinguishers, remote.orders, remote.alerts, remote.alertDays, localClients, localExtinguishers, localOrders, localAlerts, localMutations, localAlertDays]);
}
