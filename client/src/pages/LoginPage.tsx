import { FormEvent, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type LoginMode = "login" | "recover";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const trpcUtils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => { await trpcUtils.auth.me.invalidate(); window.location.href = "/"; },
    onError: (error) => toast.error(error.message),
  });
  const recoverMutation = trpc.auth.recoverPassword.useMutation({
    onSuccess: (data) => { toast.success(`Senha redefinida. Novo código de recuperação: ${data.recoveryCode}`, { duration: 15000 }); setPassword(""); setRecoveryCode(""); setNewPassword(""); setMode("login"); },
    onError: (error) => toast.error(error.message),
  });

  const handleLogin = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); loginMutation.mutate({ email, password }); };
  const handleRecovery = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); recoverMutation.mutate({ email, recoveryCode, newPassword }); };
  const isPending = loginMutation.isPending || recoverMutation.isPending;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 sm:flex sm:items-center sm:justify-center">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div><div className="mb-8 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 shadow-lg"><Flame className="h-6 w-6" /></div><div><p className="font-black tracking-tight">CONTROLE DE EXTINTORES</p><p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Gestão & ordens de serviço</p></div></div><h1 className="max-w-md text-4xl font-black leading-tight">Uma área segura para cada empresa.</h1><p className="mt-5 max-w-md text-slate-300">Cada usuário comercial acessa somente seus próprios clientes, extintores, alertas e ordens de serviço.</p></div>
          <div className="flex items-center gap-3 text-sm text-slate-300"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Dados separados por área de membros</div>
        </section>
        <section className="p-6 sm:p-10"><div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white"><Flame className="h-6 w-6" /></div><div><p className="font-black text-slate-950">CONTROLE DE EXTINTORES</p><p className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Área de membros</p></div></div></div>
          <div className="mx-auto max-w-md"><div className="mb-7"><p className="mb-2 text-sm font-semibold text-red-600">Área de membros</p><h2 className="text-3xl font-black tracking-tight text-slate-950">{mode === "login" ? "Entrar no sistema" : "Recuperar senha"}</h2><p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Use o e-mail e a senha fornecidos pelo administrador." : "Informe o código de recuperação e crie uma nova senha."}</p></div>
            {mode === "login" ? <form onSubmit={handleLogin} className="space-y-5"><div className="space-y-2"><Label htmlFor="login-email">E-mail</Label><Input id="login-email" type="email" autoComplete="email" placeholder="empresa@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="login-password">Senha</Label><Input id="login-password" type="password" autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required /></div><Button type="submit" className="h-11 w-full bg-red-600 font-bold hover:bg-red-700" disabled={isPending}>{loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Entrar</Button><Button type="button" variant="link" className="h-auto w-full text-sm text-slate-600" onClick={() => setMode("recover")}>Esqueci minha senha</Button></form> : <form onSubmit={handleRecovery} className="space-y-5"><div className="space-y-2"><Label htmlFor="recover-email">E-mail de acesso</Label><Input id="recover-email" type="email" autoComplete="email" placeholder="empresa@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="recovery-code">Código de recuperação</Label><Input id="recovery-code" type="password" placeholder="Digite o código recebido" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} required /><p className="text-xs text-slate-500">O administrador deve guardar este código em local seguro.</p></div><div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div><Button type="submit" className="h-11 w-full bg-red-600 font-bold hover:bg-red-700" disabled={isPending}>{recoverMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Redefinir senha</Button><Button type="button" variant="link" className="h-auto w-full text-sm text-slate-600" onClick={() => setMode("login")}>Voltar para o login</Button></form>}
            <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs leading-relaxed text-slate-500"><ShieldCheck className="mx-auto mb-2 h-5 w-5 text-emerald-600" />O administrador também entra por este login próprio. Senhas nunca são exibidas; em caso de necessidade, use a redefinição segura.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
