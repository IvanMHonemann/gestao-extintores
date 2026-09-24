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
      window.setTimeout(() => window.location.replace("/"), 700);
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
  clients?: LocalRecord[];
  extinguishers?: LocalRecord[];
  orders?: LocalOrderRow[];
  alerts?: LocalRecord[];
  alertDays?: number;
}) {
  const isOnline = useOnlineStatus();
  const localClients = useLiveQuery(() => offlineDb.clients.toArray(), [], [] as LocalRecord[]);
  const localExtinguishers = useLiveQuery(() => offlineDb.extinguishers.toArray(), [], [] as LocalRecord[]);
  const localOrders = useLiveQuery(() => offlineDb.orders.toArray(), [], [] as LocalOrderRow[]);
  const localAlerts = useLiveQuery(() => offlineDb.alerts.toArray(), [], [] as LocalRecord[]);
  const localAlertDays = useLiveQuery(() => offlineDb.settings.get("alertDays"), [], undefined);

  useEffect(() => {
    if (!isOnline) return;
    if (remote.clients || remote.extinguishers || remote.orders || remote.alerts) {
      void saveOnlineSnapshot(remote);
    }
  }, [isOnline, remote.clients, remote.extinguishers, remote.orders, remote.alerts, remote.alertDays]);

  return useMemo(() => ({
    isOnline,
    clients: isOnline && remote.clients ? remote.clients : localClients,
    extinguishers: isOnline && remote.extinguishers ? remote.extinguishers : localExtinguishers,
    orders: isOnline && remote.orders ? remote.orders : localOrders,
    alerts: isOnline && remote.alerts ? remote.alerts : localAlerts,
    alertDays: isOnline && remote.alertDays ? remote.alertDays : (localAlertDays?.value || remote.alertDays || 30),
  }), [isOnline, remote.clients, remote.extinguishers, remote.orders, remote.alerts, remote.alertDays, localClients, localExtinguishers, localOrders, localAlerts, localAlertDays]);
}
