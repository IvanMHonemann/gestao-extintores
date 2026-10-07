import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CheckCircle2, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  offlineDb,
  discardOfflineMutation,
  retryOfflineMutation,
  type OfflineMutation,
} from "@/offline/localDb";
import { useOnlineStatus } from "@/offline/hooks";

function resolveTenantKey(user: any): string | null {
  if (!user) return null;
  if (user.role === "platform_admin") return `platform:${user.id}`;
  if (user.companyId) return String(user.companyId);
  if (user.id < 0) return String(Math.abs(user.id));
  return String(user.id);
}

export default function SyncStatusPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isOnline = useOnlineStatus();
  const tenantKey = resolveTenantKey(user);
  const mutations = useLiveQuery(
    () =>
      tenantKey
        ? offlineDb.mutations.where("tenantKey").equals(tenantKey).sortBy("createdAt")
        : Promise.resolve([] as OfflineMutation[]),
    [tenantKey],
    [] as OfflineMutation[],
  );
  const pending = mutations.filter((item) => (item.state || "pending") === "pending");
  const failed = mutations.filter((item) => item.state === "failed");

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
              Operação offline
            </p>
            <h1 className="text-3xl font-black">Status da sincronização</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-emerald-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-amber-600" />
              )}
              {isOnline ? "Conectado" : "Sem internet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-xs uppercase text-slate-500">Pendentes</p>
              <p className="mt-1 text-3xl font-black">{pending.length}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs uppercase text-amber-700">Com falha</p>
              <p className="mt-1 text-3xl font-black text-amber-900">{failed.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs uppercase text-emerald-700">Cache local</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">
                Páginas recentes preservadas
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operações que precisam de atenção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!failed.length && !pending.length && (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Tudo sincronizado.
              </div>
            )}
            {[...failed, ...pending].map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.state === "failed" ? "destructive" : "secondary"}>
                      {item.state === "failed" ? "Falhou" : "Pendente"}
                    </Badge>
                    <strong>
                      {item.action} {item.entity}
                    </strong>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Criada em {new Date(item.createdAt).toLocaleString("pt-BR")} · tentativas:{" "}
                    {item.attempts || 0}
                  </p>
                  {item.lastError && <p className="mt-1 text-sm text-red-700">{item.lastError}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!tenantKey}
                    onClick={() => item.id && tenantKey && void retryOfflineMutation(item.id, tenantKey)}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Reprocessar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    disabled={!tenantKey}
                    onClick={() =>
                      item.id && tenantKey && void discardOfflineMutation(item.id, tenantKey)
                    }
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Descartar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <p className="text-sm text-slate-500">
          Os contadores acima refletem o estado real do IndexedDB neste dispositivo. Quando online, a
          sincronização automática processa as pendentes e remove as concluídas da fila.
        </p>
      </div>
    </div>
  );
}
