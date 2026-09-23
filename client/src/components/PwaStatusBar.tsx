import { Download, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt, useOnlineStatus } from "@/offline/hooks";

export function PwaStatusBar() {
  const isOnline = useOnlineStatus();
  const { canInstall, install } = useInstallPrompt();
  return (
    <div className={`fixed bottom-3 left-3 z-[70] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur print:hidden ${isOnline ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-red-200 bg-red-50/95 text-red-800"}`}>
      {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>{isOnline ? "Online" : "Offline — dados locais"}</span>
      {canInstall && <Button size="sm" variant="ghost" className="ml-1 h-6 gap-1 px-2 text-xs" onClick={() => void install()}><Download className="h-3 w-3" /> Instalar</Button>}
    </div>
  );
}
