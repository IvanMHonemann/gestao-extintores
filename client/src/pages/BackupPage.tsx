import { useLiveQuery } from "dexie-react-hooks";
import { ChangeEvent, useRef, useState } from "react";
import { ArrowLeft, Download, HardDrive, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { exportOfflineBackup, importOfflineBackup, offlineDb } from "@/offline/localDb";

export default function BackupPage() {
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const lastBackup = useLiveQuery(() => offlineDb.meta.get("lastBackupExport"), [], undefined);
  const lastImport = useLiveQuery(() => offlineDb.meta.get("lastBackupImport"), [], undefined);

  const formatDate = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "Ainda não realizado";

  const handleExport = async () => {
    setBusy(true);
    try {
      const backup = await exportOfflineBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-extintores-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      await offlineDb.meta.put({ key: "lastBackupExport", value: new Date().toISOString() });
      toast.success("Backup exportado. Guarde o arquivo em um local seguro.");
    } catch { toast.error("Não foi possível exportar o backup."); }
    finally { setBusy(false); }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("A restauração substituirá os dados locais atuais. Deseja continuar?")) return;
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text());
      await importOfflineBackup(payload);
      toast.success("Backup restaurado com sucesso. Recarregue o painel para atualizar os dados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Arquivo de backup inválido."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /> Voltar ao painel</Button>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-900 text-white"><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-red-400" /> Backup e Restauração</CardTitle><CardDescription className="text-slate-300">Proteja seus dados locais antes de limpar o navegador ou trocar de aparelho.</CardDescription></CardHeader>
          <CardContent className="space-y-6 p-5 sm:p-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"><strong>Atenção:</strong> os dados offline ficam no armazenamento do navegador deste dispositivo. Exporte backups regularmente para não perder informações ao limpar os dados do aplicativo ou desinstalá-lo.</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><Download className="mb-3 h-5 w-5 text-red-600" /><h2 className="font-bold">Exportar backup</h2><p className="mt-1 text-sm text-slate-500">Salva clientes, extintores, ordens, alertas e configurações em um arquivo JSON.</p><Button className="mt-4 w-full bg-red-600 hover:bg-red-700" disabled={busy} onClick={() => void handleExport()}>Baixar backup</Button><p className="mt-3 text-xs text-slate-500">Último backup: {formatDate(lastBackup?.value)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><Upload className="mb-3 h-5 w-5 text-blue-600" /><h2 className="font-bold">Restaurar backup</h2><p className="mt-1 text-sm text-slate-500">Importa um arquivo JSON salvo anteriormente e substitui os dados locais atuais.</p><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} /><Button variant="outline" className="mt-4 w-full" disabled={busy} onClick={() => fileRef.current?.click()}>Selecionar arquivo</Button><p className="mt-3 text-xs text-slate-500">Última restauração: {formatDate(lastImport?.value)}</p></div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">A sincronização com o servidor online continuará disponível quando houver internet. O backup local é uma camada adicional de segurança e pode ser usado mesmo sem conexão.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
