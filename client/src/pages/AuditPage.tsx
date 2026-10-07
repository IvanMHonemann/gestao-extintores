import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuditPage() {
  const [, navigate] = useLocation();
  const query = trpc.audit.list.useQuery({ page: 1, pageSize: 50 });
  const rows = query.data?.items ?? [];
  return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-6xl space-y-6"><Button variant="ghost" onClick={() => navigate("/")}>Voltar</Button><Card className="bg-slate-900 text-white"><CardHeader><CardTitle>Auditoria</CardTitle></CardHeader><CardContent className="space-y-3">{rows.map((row: any) => <div key={row.id} className="rounded border border-slate-700 p-3"><div className="font-medium">{row.description}</div><div className="text-xs text-slate-400">{row.module} · {row.action} · {new Date(row.createdAt).toLocaleString("pt-BR")}</div></div>)}{!query.isLoading && !rows.length ? <p className="text-slate-400">Nenhum evento de auditoria encontrado.</p> : null}</CardContent></Card></div></main>;
}
