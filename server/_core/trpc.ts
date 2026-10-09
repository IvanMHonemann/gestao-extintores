import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import type { AccessLevel } from "@shared/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { consumeRateLimit, RATE_RULES } from "../rateLimit";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const limited = await consumeRateLimit(`trpc:user:${opts.ctx.user.id}`, RATE_RULES.authenticated);
  if (!limited.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas requisições. Tente novamente em instantes.", cause: { retryAfter: limited.retryAfter } });
  return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
});

const requireCompanyUser = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem empresa associada para acessar dados comerciais." });
  }
  const companyRoles: AccessLevel[] = ["company_admin", "operator", "technician"];
  if (!companyRoles.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Perfil sem permissão comercial." });
  const { checkSubscriptionAccess } = await import("../subscriptionAccess");
  const access = await checkSubscriptionAccess(opts.ctx.accountId);
  if (!access.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: access.reason || "Assinatura irregular. Regularize o plano para continuar.",
      cause: { code: "SUBSCRIPTION_BLOCKED", status: access.status },
    });
  }
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});

const requireCompanyAdmin = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (user.role !== "company_admin" || !opts.ctx.accountId) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode executar esta operação." });
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});

const requirePlatformAdmin = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (user.role !== "platform_admin" || !opts.ctx.isPlatformAdmin) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  return opts.next({ ctx: { ...opts.ctx, user } });
});

export const protectedProcedure = t.procedure.use(requireUser);
const requireCompanyMemberNoBillingGate = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem empresa associada." });
  }
  const companyRoles: AccessLevel[] = ["company_admin", "operator", "technician"];
  if (!companyRoles.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Perfil sem permissão comercial." });
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});

export const commercialProcedure = t.procedure.use(requireCompanyUser);
export const companyBillingProcedure = t.procedure.use(requireCompanyMemberNoBillingGate);

export const companyAdminProcedure = t.procedure.use(requireCompanyAdmin);
export const adminCommercialProcedure = companyAdminProcedure;
export const platformProcedure = t.procedure.use(requirePlatformAdmin);
export const adminProcedure = platformProcedure;
