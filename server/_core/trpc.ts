import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireTenant = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.accountId || !Number.isInteger(ctx.accountId) || ctx.accountId <= 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem empresa associada para acessar dados comerciais." });
  }
  return next({ ctx: { ...ctx, accountId: ctx.accountId } });
});

const requireAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);
export const commercialProcedure = t.procedure.use(requireUser).use(requireTenant);
export const adminProcedure = t.procedure.use(requireAdmin);
export const adminCommercialProcedure = t.procedure.use(requireUser).use(requireTenant).use(requireAdmin);
