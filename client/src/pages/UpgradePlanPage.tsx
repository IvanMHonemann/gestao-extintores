import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UpgradePlanPage() {
  const [, navigate] = useLocation();
  const plans = trpc.billing.plans.useQuery();
  const checkout = trpc.billing.mockCheckoutOpen.useMutation({ onSuccess: () => navigate("/minha-assinatura") });
  return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-5xl space-y-6"><Button variant="ghost" onClick={() => navigate("/")}>Voltar</Button><h1 className="text-3xl font-bold">Escolha seu plano</h1><div className="grid gap-4 md:grid-cols-3">{(plans.data ?? []).map((p: any) => <Card key={p.id} className="bg-slate-900 text-white"><CardHeader><CardTitle>{p.name}</CardTitle></CardHeader><CardContent className="space-y-4"><p>R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {p.billingCycle === "yearly" ? "ano" : "mês"}</p><Button className="w-full" onClick={() => checkout.mutate({ planId: p.id, outcome: "approved" })}>Selecionar plano</Button></CardContent></Card>)}</div></div></main>;
}
