import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useOfflineSnapshot } from "@/offline/hooks";
import { offlineDb, markOfflineMutationFailed } from "@/offline/localDb";
import { RefreshCw, Wifi, WifiOff, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const isPlatformAdmin = user?.role === "platform_admin";
  const tenantKey = user
    ? isPlatformAdmin
      ? `platform:${user.id}`
      : (user as any).companyId
        ? String((user as any).companyId)
        : user.id < 0
          ? String(Math.abs(user.id))
          : String(user.id)
    : null;

  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ ok: number; failed: number } | null>(null);

  const offlineSnapshotQuery = trpc.offline.snapshot.useQuery(
    { page: 1, pageSize: 50 },
    { enabled: Boolean(tenantKey && !isPlatformAdmin) },
  );
  const alertDaysQuery = trpc.settings.getAlertDays.useQuery(undefined, {
    enabled: Boolean(tenantKey && !isPlatformAdmin),
  });

  const offline = useOfflineSnapshot({
    tenantKey,
    clients: offlineSnapshotQuery.data?.clients as any,
    extinguishers: offlineSnapshotQuery.data?.extinguishers as any,
    orders: offlineSnapshotQuery.data?.orders as any,
    alerts: offlineSnapshotQuery.data?.alerts as any,
    alertDays: alertDaysQuery.data,
  });

  const offlineMutations = useLiveQuery(
    () =>
      tenantKey
        ? offlineDb.mutations.where("tenantKey").equals(tenantKey).toArray()
        : Promise.resolve([] as any[]),
    [tenantKey],
    [] as any[],
  );
  const pendingOfflineCount = offlineMutations.filter(
    (m: any) => (m.state || "pending") === "pending",
  ).length;
  const failedOfflineCount = offlineMutations.filter((m: any) => m.state === "failed").length;

  const utils = trpc.useUtils();
  const createClientMutation = trpc.clients.create.useMutation();
  const createExtinguisherMutation = trpc.extinguishers.create.useMutation();
  const createOrderMutation = trpc.orders.create.useMutation();
  const updateClientMutation = trpc.clients.update.useMutation();
  const updateExtinguisherMutation = trpc.extinguishers.update.useMutation();
  const updateOrderMutation = trpc.orders.update.useMutation();
  const deleteClientMutation = trpc.clients.delete.useMutation();
  const deleteExtinguisherMutation = trpc.extinguishers.delete.useMutation();
  const deleteOrderMutation = trpc.orders.delete.useMutation();

  useEffect(() => {
    if (!offline.isOnline || !tenantKey) return;
    let cancelled = false;
    let running = false;

    const runSync = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        const queued = (
          await offlineDb.mutations.where("tenantKey").equals(tenantKey).sortBy("createdAt")
        ).filter((mutation) => (mutation.state || "pending") === "pending");
        if (!queued.length) {
          setIsSyncingOffline(false);
          return;
        }
        setIsSyncingOffline(true);
        let ok = 0;
        let failed = 0;
        const idMap = new Map<number, number>();
        for (const mutation of queued) {
          if (cancelled) return;
          try {
            const raw = mutation.payload || {};
            const payload = { ...raw };
            delete payload.localId;
            delete payload.tenantKey;
            if (payload.clientId && idMap.has(Number(payload.clientId))) {
              payload.clientId = idMap.get(Number(payload.clientId));
            }
            if (payload.items) {
              payload.items = payload.items.map((item: any) => ({
                ...item,
                extinguisherId: idMap.get(item.extinguisherId) || item.extinguisherId,
              }));
            }
            if (mutation.action === "create") {
              const result =
                mutation.entity === "client"
                  ? await createClientMutation.mutateAsync(payload)
                  : mutation.entity === "extinguisher"
                    ? await createExtinguisherMutation.mutateAsync(payload)
                    : await createOrderMutation.mutateAsync(payload);
              if (raw.localId && result?.id) idMap.set(Number(raw.localId), result.id);
            } else if (mutation.action === "update") {
              const resolvedId = idMap.get(Number(payload.id)) || Number(payload.id);
              payload.id = resolvedId;
              if (mutation.entity === "client") await updateClientMutation.mutateAsync(payload);
              if (mutation.entity === "extinguisher")
                await updateExtinguisherMutation.mutateAsync(payload);
              if (mutation.entity === "order") await updateOrderMutation.mutateAsync(payload);
            } else {
              const resolvedId = idMap.get(Number(payload.id)) || Number(payload.id);
              if (resolvedId > 0) {
                if (mutation.entity === "client")
                  await deleteClientMutation.mutateAsync({ id: resolvedId });
                if (mutation.entity === "extinguisher")
                  await deleteExtinguisherMutation.mutateAsync({ id: resolvedId });
                if (mutation.entity === "order")
                  await deleteOrderMutation.mutateAsync({ id: resolvedId });
              }
            }
            if (mutation.id) await offlineDb.mutations.delete(mutation.id);
            ok += 1;
            setLastSyncResult({ ok, failed });
          } catch (error) {
            failed += 1;
            if (mutation.id) {
              await markOfflineMutationFailed(
                mutation.id,
                tenantKey,
                error instanceof Error ? error.message : "Falha desconhecida",
              );
            }
            setLastSyncResult({ ok, failed });
          }
        }
        if (!cancelled) {
          setLastSyncResult({ ok, failed });
          setIsSyncingOffline(false);
          if (ok) {
            await Promise.all([
              utils.clients.invalidate(),
              utils.extinguishers.invalidate(),
              utils.orders.invalidate(),
              utils.dashboard.stats.invalidate(),
            ]);
            toast.success(`${ok} operacao(oes) offline sincronizada(s).`);
          }
          if (failed && !ok) {
            toast.error(`${failed} operacao(oes) falharam. Veja o status da sincronizacao.`);
          } else if (failed) {
            toast.warning(`${ok} ok, ${failed} com falha.`);
          }
        }
      } finally {
        running = false;
      }
    };

    void runSync();
    const interval = window.setInterval(() => {
      if (!cancelled && offline.isOnline) void runSync();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [offline.isOnline, tenantKey, pendingOfflineCount]);

  const clients = offline.clients || [];
  const extinguishers = offline.extinguishers || [];
  const orders = offline.orders || [];

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Extinfy - Painel</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/sync-status")}>
              Sincronizacao
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/backup")}>
              Backup
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sair
            </Button>
          </div>
        </div>

        <Card
          className={
            !offline.isOnline
              ? "border-amber-300 bg-amber-50"
              : isSyncingOffline
                ? "border-sky-300 bg-sky-50"
                : pendingOfflineCount || failedOfflineCount
                  ? "border-sky-300 bg-sky-50"
                  : "border-emerald-300 bg-emerald-50"
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {!offline.isOnline ? (
                <WifiOff className="h-5 w-5" />
              ) : isSyncingOffline ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : pendingOfflineCount || failedOfflineCount ? (
                <CloudOff className="h-5 w-5" />
              ) : (
                <Wifi className="h-5 w-5" />
              )}
              {isSyncingOffline
                ? "Sincronizando operacoes pendentes..."
                : !offline.isOnline
                  ? "Modo offline - dados locais"
                  : pendingOfflineCount
                    ? `${pendingOfflineCount} operacao(oes) aguardando envio`
                    : "Tudo sincronizado com o servidor"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Pendentes: <strong>{pendingOfflineCount}</strong>
              {" · "}
              Falhas: <strong>{failedOfflineCount}</strong>
              {lastSyncResult
                ? ` · Ultima: ${lastSyncResult.ok} ok` +
                  (lastSyncResult.failed ? `, ${lastSyncResult.failed} falha(s)` : "")
                : ""}
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => navigate("/sync-status")}
            >
              Ver sincronizacao
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-slate-500">Clientes (cache)</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-black">{clients.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-slate-500">Extintores (cache)</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-black">{extinguishers.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-slate-500">OS (cache)</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-black">{orders.length}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Restauracao do painel completo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              Versao temporaria com modo offline e sincronizacao (contadores reais). O painel
              completo com listagem de clientes, OS e extintores sera restaurado em seguida.
            </p>
            <p>
              Abra o app <strong>online uma vez</strong> para gravar o snapshot local; depois teste
              offline. Os numeros de Pendentes/Falhas devem atualizar conforme a sincronizacao
              conclui.
            </p>
            <p className="text-xs text-slate-400">
              Usuario: {user?.name || (user as any)?.email || "-"} · tenant: {tenantKey || "-"} ·{" "}
              {offline.isOnline ? "online" : "offline"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
