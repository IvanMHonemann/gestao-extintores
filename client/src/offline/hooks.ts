import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { offlineDb, saveOnlineSnapshot, type LocalOrderRow, type LocalRecord } from "./localDb";

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
      // O evento é disparado pelo navegador após a instalação. Reabrimos a
      // rota inicial imediatamente; em navegadores que permitem foco de
      // janela, reutilizamos a janela do app em vez de deixar o usuário na
      // tela de instalação.
      window.setTimeout(() => {
        const appUrl = `${window.location.origin}/`;
        const appWindow = window.open(appUrl, "gestao-extintores-app");
        if (appWindow) {
          appWindow.focus();
          window.close();
        } else {
          window.location.replace(appUrl);
        }
      }, 250);
    };
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
  }, []);
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
  const localAlertDays = useLiveQuery(() => tenantKey ? offlineDb.settings.get(`${tenantKey}:alertDays`) : Promise.resolve(undefined), [tenantKey], undefined);

  useEffect(() => {
    if (!isOnline || !tenantKey) return;
    if (remote.clients || remote.extinguishers || remote.orders || remote.alerts) void saveOnlineSnapshot(remote as { tenantKey: string; clients?: LocalRecord[]; extinguishers?: LocalRecord[]; orders?: LocalOrderRow[]; alerts?: LocalRecord[]; alertDays?: number });
  }, [isOnline, tenantKey, remote.clients, remote.extinguishers, remote.orders, remote.alerts, remote.alertDays]);

  return useMemo(() => ({
    isOnline,
    clients: isOnline && remote.clients ? remote.clients : localClients,
    extinguishers: isOnline && remote.extinguishers ? remote.extinguishers : localExtinguishers,
    orders: isOnline && remote.orders ? remote.orders : localOrders,
    alerts: isOnline && remote.alerts ? remote.alerts : localAlerts,
    alertDays: isOnline && remote.alertDays !== undefined ? remote.alertDays : ((localAlertDays as any)?.value || remote.alertDays || 30),
  }), [isOnline, remote.clients, remote.extinguishers, remote.orders, remote.alerts, remote.alertDays, localClients, localExtinguishers, localOrders, localAlerts, localAlertDays]);
}
