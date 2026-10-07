import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentHistoryPage() {
  const [, navigate] = useLocation();
  const query = trpc.billing.payments.useQuery();
  return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-4xl space-y-6"><Button variant="ghost" onClick={() => navigate("/")}>Voltar</Button><Card className="bg-slate-900 text-white"><CardHeader><CardTitle>Histórico de pagamentos</CardTitle></CardHeader><CardContent><div className="space-y-2">{(query.data ?? []).map((p: any) => <div key={p.id} className="rounded border border-slate-700 p-3">{p.status} — R$ {Number(p.amount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>)}{!query.isLoading && !(query.data ?? []).length ? <p className="text-slate-400">Nenhum pagamento registrado.</p> : null}</div></CardContent></Card></div></main>;
}
