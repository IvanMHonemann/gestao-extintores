import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, Check, Loader2, LogOut, UserPlus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminUsersPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const accountsQuery = trpc.accounts.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const utils = trpc.useUtils();
  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado. Ele já pode entrar com o e-mail e a senha definidos.");
      setCompanyName(""); setUserName(""); setEmail(""); setPassword("");
      utils.accounts.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const statusMutation = trpc.accounts.setActive.useMutation({
    onSuccess: () => { toast.success("Status do usuário atualizado."); utils.accounts.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  if (user?.role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><Card className="max-w-md"><CardContent className="p-6 text-center"><p className="font-bold text-slate-900">Acesso restrito ao administrador.</p><Button className="mt-4" onClick={() => navigate("/")}>Voltar ao painel</Button></CardContent></Card></div>;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate({ companyName, userName, email, password });
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600"><Users className="h-5 w-5" /></div><div><p className="font-black tracking-tight">Área administrativa</p><p className="text-xs text-slate-400">Usuários e áreas de membros</p></div></div>
          <Button variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Button variant="ghost" className="mb-2 -ml-3 gap-2" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /> Voltar ao painel</Button><h1 className="text-2xl font-black sm:text-3xl">Usuários comerciais</h1><p className="mt-1 text-sm text-slate-500">Cada cadastro recebe uma área isolada para seus próprios clientes e ordens.</p></div><Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><Check className="mr-1 h-3.5 w-3.5" /> Somente administrador</Badge></div>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-red-600" /> Criar nova área</CardTitle></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-4"><div className="space-y-2"><Label htmlFor="account-company">Empresa</Label><Input id="account-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Empresa ABC" required /></div><div className="space-y-2"><Label htmlFor="account-user">Nome do usuário</Label><Input id="account-user" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do responsável" required /></div><div className="space-y-2"><Label htmlFor="account-email">E-mail de acesso</Label><Input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" required /></div><div className="space-y-2"><Label htmlFor="account-password">Senha inicial</Label><Input id="account-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" required /><p className="text-xs text-slate-500">Compartilhe a senha de forma segura. A senha é armazenada protegida.</p></div><Button type="submit" className="w-full bg-red-600 font-bold hover:bg-red-700" disabled={createMutation.isPending}>{createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Criar usuário</Button></form></CardContent></Card>
          <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-red-600" /> Áreas cadastradas</CardTitle></CardHeader><CardContent>{accountsQuery.isLoading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários...</div> : accountsQuery.data?.length ? <div className="space-y-3">{accountsQuery.data.map((account) => <div key={account.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100"><UserRound className="h-5 w-5 text-slate-500" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-slate-900">{account.companyName}</p>{account.role === "admin" && <Badge className="bg-slate-900 text-[10px] text-white hover:bg-slate-900">Administrador</Badge>}</div><p className="truncate text-sm text-slate-600">{account.userName} · {account.email}</p><p className="text-xs text-slate-400">Criado em {new Date(account.createdAt).toLocaleDateString("pt-BR")}</p></div></div><Button size="sm" variant="outline" className={account.active ? "text-red-700" : "text-emerald-700"} disabled={statusMutation.isPending || account.role === "admin"} onClick={() => statusMutation.mutate({ id: account.id, active: !account.active })}>{account.role === "admin" ? "Acesso protegido" : account.active ? "Bloquear acesso" : "Reativar acesso"}</Button></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma área comercial criada ainda.</div>}</CardContent></Card>
        </div>
      </div>
    </main>
  );
}
