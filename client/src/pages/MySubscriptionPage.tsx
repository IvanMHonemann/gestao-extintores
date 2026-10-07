import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MySubscriptionPage() {
  const [, navigate] = useLocation();
  const query = trpc.billing.mySubscription.useQuery();
  return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-2xl space-y-6"><Button variant="ghost" onClick={() => navigate("/")}>Voltar</Button><Card className="bg-slate-900 text-white"><CardHeader><CardTitle>Minha assinatura</CardTitle></CardHeader><CardContent><pre className="whitespace-pre-wrap text-sm text-slate-300">{query.isLoading ? "Carregando..." : JSON.stringify(query.data ?? { message: "Nenhuma assinatura encontrada." }, null, 2)}</pre></CardContent></Card></div></main>;
}
