import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, CreditCard, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const FEATURES = [
  { key: "featureDashboard", label: "Painel e indicadores" },
  { key: "featureClients", label: "Cadastro de clientes" },
  { key: "featureExtinguishers", label: "Cadastro de extintores" },
  { key: "featureServiceOrders", label: "Ordens de serviço" },
  { key: "featureAlerts", label: "Alertas de vencimento" },
  { key: "featureReports", label: "Relatórios e impressão" },
  { key: "featureUsers", label: "Gestão de usuários" },
  { key: "featureBackup", label: "Backup e restauração" },
  { key: "featureOfflinePwa", label: "Operação offline/PWA" },
] as const;

type FeatureKey = (typeof FEATURES)[number]["key"];

const emptyPlanForm = {
  name: "",
  description: "",
  price: "0,00",
  billingCycle: "monthly" as "monthly" | "yearly",
  maxUsers: "",
  maxClients: "",
  maxExtinguishers: "",
  unlimitedUsers: true,
  unlimitedClients: true,
  unlimitedExtinguishers: true,
  availableForNew: true,
  features: Object.fromEntries(FEATURES.map((f) => [f.key, false])) as Record<FeatureKey, boolean>,
};

const statusLabel: Record<string, string> = {
  active: "Ativa",
  test: "Teste",
  suspended: "Suspensa",
  expired: "Expirada",
};

function parsePrice(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function limitValue(unlimited: boolean, raw: string) {
  if (unlimited) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function AdminAssinaturasPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "platform_admin";
  const [tab, setTab] = useState<"plans" | "subs">("plans");
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [subForm, setSubForm] = useState({
    companyId: "",
    planId: "",
    status: "active" as "active" | "test" | "suspended" | "expired",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const plansQuery = trpc.platform.plans.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const subsQuery = trpc.platform.subscriptions.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const statsQuery = trpc.platform.subscriptions.stats.useQuery(undefined, { enabled: isPlatformAdmin });
  const companiesQuery = trpc.platform.companies.list.useQuery(undefined, { enabled: isPlatformAdmin });

  const createPlan = trpc.platform.plans.create.useMutation({
    onSuccess: () => {
      toast.success("Plano criado");
      setPlanForm(emptyPlanForm);
      utils.platform.plans.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const createSub = trpc.platform.subscriptions.create.useMutation({
    onSuccess: () => {
      toast.success("Assinatura criada");
      setSubForm({ companyId: "", planId: "", status: "active", startsAt: new Date().toISOString().slice(0, 10), endsAt: "", notes: "" });
      utils.platform.subscriptions.list.invalidate();
      utils.platform.subscriptions.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateSub = trpc.platform.subscriptions.update.useMutation({
    onSuccess: () => {
      toast.success("Assinatura atualizada");
      utils.platform.subscriptions.list.invalidate();
      utils.platform.subscriptions.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const availablePlans = useMemo(
    () => (plansQuery.data || []).filter((p) => p.active && p.availableForNew),
    [plansQuery.data],
  );

  if (!isPlatformAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <Card><CardContent className="p-8 text-center text-slate-600">Acesso restrito ao administrador da plataforma.</CardContent></Card>
      </main>
    );
  }

  function onCreatePlan(e: FormEvent) {
    e.preventDefault();
    createPlan.mutate({
      name: planForm.name.trim(),
      description: planForm.description.trim() || null,
      price: parsePrice(planForm.price),
      billingCycle: planForm.billingCycle,
      maxUsers: limitValue(planForm.unlimitedUsers, planForm.maxUsers),
      maxClients: limitValue(planForm.unlimitedClients, planForm.maxClients),
      maxExtinguishers: limitValue(planForm.unlimitedExtinguishers, planForm.maxExtinguishers),
      availableForNew: planForm.availableForNew,
      ...planForm.features,
    });
  }

  function onCreateSub(e: FormEvent) {
    e.preventDefault();
    if (!subForm.companyId || !subForm.planId) {
      toast.error("Selecione empresa e plano");
      return;
    }
    createSub.mutate({
      companyId: Number(subForm.companyId),
      planId: Number(subForm.planId),
      status: subForm.status,
      startsAt: subForm.startsAt,
      endsAt: subForm.endsAt || null,
      notes: subForm.notes.trim() || null,
    });
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Assinaturas</h1>
            <p className="text-sm text-slate-500">Planos, limites e assinaturas das empresas</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant={tab === "plans" ? "default" : "outline"} className={tab === "plans" ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => setTab("plans")}>
            Planos e recursos
          </Button>
          <Button variant={tab === "subs" ? "default" : "outline"} className={tab === "subs" ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => setTab("subs")}>
            Assinaturas das empresas
          </Button>
        </div>

        {tab === "plans" && (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Criar plano</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={onCreatePlan}>
                  <div>
                    <Label>Nome do plano</Label>
                    <Input placeholder="Ex.: Profissional" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input placeholder="Para empresas com equipe" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Preço (R$)</Label>
                      <Input value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cobrança</Label>
                      <Select value={planForm.billingCycle} onValueChange={(v: "monthly" | "yearly") => setPlanForm({ ...planForm, billingCycle: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-800">Limites do plano</p>
                    <div className="space-y-3">
                      {([
                        ["Usuários", "maxUsers", "unlimitedUsers"],
                        ["Clientes", "maxClients", "unlimitedClients"],
                        ["Extintores", "maxExtinguishers", "unlimitedExtinguishers"],
                      ] as const).map(([label, maxKey, unlKey]) => (
                        <div key={maxKey} className="rounded-lg border border-slate-200 p-3">
                          <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
                          <Input
                            placeholder="Quantidade"
                            disabled={planForm[unlKey]}
                            value={planForm[maxKey]}
                            onChange={(e) => setPlanForm({ ...planForm, [maxKey]: e.target.value })}
                          />
                          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                            <Checkbox
                              checked={planForm[unlKey]}
                              onCheckedChange={(c) => setPlanForm({ ...planForm, [unlKey]: Boolean(c) })}
                            />
                            Ilimitado
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Marque Ilimitado ou informe uma quantidade máxima. O banco salva ilimitado como NULL.</p>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-800">Funções liberadas</p>
                    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                      {FEATURES.map((f) => (
                        <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700">
                          <Checkbox
                            checked={planForm.features[f.key]}
                            onCheckedChange={(c) =>
                              setPlanForm({
                                ...planForm,
                                features: { ...planForm.features, [f.key]: Boolean(c) },
                              })
                            }
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                      checked={planForm.availableForNew}
                      onCheckedChange={(c) => setPlanForm({ ...planForm, availableForNew: Boolean(c) })}
                    />
                    Plano disponível para novas assinaturas
                  </label>

                  <Button type="submit" className="w-full bg-red-500 hover:bg-red-600" disabled={createPlan.isPending}>
                    {createPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="ml-2">Criar plano</span>
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Planos cadastrados</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {plansQuery.isLoading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>}
                {!plansQuery.isLoading && (plansQuery.data || []).length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum plano cadastrado.</div>
                )}
                {(plansQuery.data || []).map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{plan.name}</p>
                        <p className="text-sm text-slate-500">{plan.description || "Sem descrição"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">R$ {Number(plan.price).toFixed(2).replace(".", ",")}</p>
                        <p className="text-xs text-slate-500">{plan.billingCycle === "monthly" ? "Mensal" : "Anual"}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {plan.availableForNew ? <Badge className="bg-emerald-100 text-emerald-800">Disponível</Badge> : <Badge variant="secondary">Indisponível</Badge>}
                      {!plan.active && <Badge variant="destructive">Inativo</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "subs" && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Registradas</p><p className="text-2xl font-bold">{statsQuery.data?.registered ?? 0}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Ativas/teste</p><p className="text-2xl font-bold">{statsQuery.data?.activeOrTest ?? 0}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Suspensas</p><p className="text-2xl font-bold">{statsQuery.data?.suspended ?? 0}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Próximas do vencimento</p><p className="text-2xl font-bold">{statsQuery.data?.nearExpiry ?? 0}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Assinar uma empresa</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={onCreateSub}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Empresa</Label>
                      <Select value={subForm.companyId} onValueChange={(v) => setSubForm({ ...subForm, companyId: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {(companiesQuery.data || []).map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plano</Label>
                      <Select value={subForm.planId} onValueChange={(v) => setSubForm({ ...subForm, planId: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {availablePlans.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={subForm.status} onValueChange={(v: any) => setSubForm({ ...subForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativa</SelectItem>
                          <SelectItem value="test">Teste</SelectItem>
                          <SelectItem value="suspended">Suspensa</SelectItem>
                          <SelectItem value="expired">Expirada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Início</Label>
                      <Input type="date" value={subForm.startsAt} onChange={(e) => setSubForm({ ...subForm, startsAt: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Término (opcional)</Label>
                      <Input type="date" value={subForm.endsAt} onChange={(e) => setSubForm({ ...subForm, endsAt: e.target.value })} />
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Input value={subForm.notes} onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createSub.isPending}>
                    {createSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span className="ml-2">Nova assinatura</span>
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Assinaturas registradas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {subsQuery.isLoading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>}
                {!subsQuery.isLoading && (subsQuery.data || []).length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma assinatura registrada.</div>
                )}
                {(subsQuery.data || []).map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 flex items-center gap-2"><Building2 className="h-4 w-4" /> {s.companyName}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {s.planName} · R$ {Number(s.planPrice).toFixed(2).replace(".", ",")}/{s.billingCycle === "monthly" ? "mês" : "ano"}</p>
                        <p className="mt-1 text-xs text-slate-500">Início {String(s.startsAt).slice(0, 10)}{s.endsAt ? ` · Fim ${String(s.endsAt).slice(0, 10)}` : ""}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={s.status === "active" || s.status === "test" ? "bg-emerald-100 text-emerald-800" : s.status === "suspended" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}>
                          {statusLabel[s.status] || s.status}
                        </Badge>
                        <Select
                          value={s.status}
                          onValueChange={(v: any) => updateSub.mutate({ id: s.id, status: v })}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativa</SelectItem>
                            <SelectItem value="test">Teste</SelectItem>
                            <SelectItem value="suspended">Suspensa</SelectItem>
                            <SelectItem value="expired">Expirada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
