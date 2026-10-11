import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { trpc } from "@/lib/trpc";

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const email = params.get("email") || "";
  const token = params.get("token") || "";
  const [message, setMessage] = useState("Confirmando seu e-mail...");
  const verify = trpc.auth.verifyEmail.useMutation();

  useEffect(() => {
    if (!email || !token) {
      setMessage("Link de confirmação incompleto.");
      return;
    }
    verify.mutate({ email, token }, {
      onSuccess: () => setMessage("E-mail confirmado. Agora você já pode entrar no Extinfy."),
      onError: (error) => setMessage(error.message),
    });
  }, [email, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center text-slate-900 shadow-2xl">
        <BrandLogo variant="dark" height={64} className="mx-auto mb-6 max-w-[260px]" />
        {verify.isPending ? <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-red-600" /> : <MailCheck className="mx-auto mb-4 h-10 w-10 text-emerald-600" />}
        <h1 className="text-xl font-bold">Confirmação de e-mail</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        <Button className="mt-6 w-full bg-red-600 hover:bg-red-500" onClick={() => navigate("/?login=1")}>Ir para o login</Button>
      </section>
    </main>
  );
}
