import { Download, Loader2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt, useOnlineStatus } from "@/offline/hooks";

export function PwaStatusBar() {
  const isOnline = useOnlineStatus();
  const { canInstall, install, isInstalling, installProgress } = useInstallPrompt();
  return (
    <div className={`fixed bottom-3 left-3 z-[70] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur print:hidden ${isOnline ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-red-200 bg-red-50/95 text-red-800"}`}>
      {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>{isOnline ? "Online" : "Offline — dados locais"}</span>
      {canInstall && !isInstalling && <Button size="sm" className="ml-1 h-8 gap-1 rounded-full bg-red-600 px-3 text-xs font-extrabold text-white shadow-md shadow-red-600/30 hover:bg-red-700" onClick={() => void install()}><Download className="h-3.5 w-3.5" /> Instalar aplicativo</Button>}
      {isInstalling && <div className="ml-1 min-w-[145px] space-y-1"><div className="flex items-center gap-1 text-[11px] font-bold"><Loader2 className="h-3 w-3 animate-spin" /> Instalando... {installProgress}%</div><div className="h-1.5 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-red-600 transition-all duration-300" style={{ width: `${installProgress}%` }} /></div></div>}
    </div>
  );
}
