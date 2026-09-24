import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

const LOCAL_SESSION_KEY = "gestao-extintores-auth-user";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function readCachedUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw || raw === "null") return null;
    const user = JSON.parse(raw);
    if (!user || typeof user.id !== "number" || typeof user.role !== "string") return null;
    if (!["platform_admin", "company_admin", "operator", "technician"].includes(user.role)) return null;
    return user;
  } catch {
    return null;
  }
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [cachedUser, setCachedUser] = useState(readCachedUser);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      setCachedUser(readCachedUser());
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !isOffline,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(meQuery.data));
      setCachedUser(meQuery.data);
    }
    if (!isOffline && !meQuery.isLoading && !meQuery.data) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setCachedUser(null);
    }
  }, [isOffline, meQuery.data, meQuery.isLoading]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.setData(undefined, null),
  });

  const logout = useCallback(async () => {
    try {
      if (!isOffline) await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (!(error instanceof TRPCClientError) || error.data?.code !== "UNAUTHORIZED") throw error;
    } finally {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setCachedUser(null);
      utils.auth.me.setData(undefined, null);
      if (!isOffline) await utils.auth.me.invalidate();
    }
  }, [isOffline, logoutMutation, utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? (isOffline ? cachedUser : null);
    // A sessão própria em cache é suficiente para abrir a aplicação enquanto
    // a confirmação online ocorre em segundo plano. Isso evita tela vazia ou
    // spinner prolongado em previews móveis e mantém o acesso offline-first.
    const authReady = isOffline || Boolean(cachedUser) || meQuery.isFetched;
    return {
      user,
      // Mesmo com usuário em cache, não mostre LoginPage enquanto a sessão
      // própria online ainda está sendo confirmada. Isso evita a piscada no
      // primeiro carregamento e ao atualizar a página.
      loading: !authReady || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [cachedUser, isOffline, logoutMutation.error, logoutMutation.isPending, meQuery.data, meQuery.error, meQuery.isFetched]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || isOffline || state.loading || state.user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    window.location.href = redirectPath || "/login";
  }, [redirectOnUnauthenticated, isOffline, redirectPath, state.loading, state.user]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
