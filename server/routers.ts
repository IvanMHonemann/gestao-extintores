import { COOKIE_NAME, MEMBER_COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as memberAuth from "./memberAuth";

const emptyToNull = (value?: string) => value?.trim() || null;

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const account = await memberAuth.authenticateMember(input.email, input.password);
        if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        const session = await memberAuth.createMemberSession(account.id);
        ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookies = parseCookie(ctx.req.headers.cookie ?? "");
      await memberAuth.revokeMemberSession(cookies[MEMBER_COOKIE_NAME] ?? "");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      if (cookies[MEMBER_COOKIE_NAME]) {
        ctx.res.clearCookie(MEMBER_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      }
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /** Somente o administrador central pode criar e bloquear usuários comerciais. */
  accounts: router({
    list: adminProcedure.query(async () => memberAuth.listMemberAccounts()),
    create: adminProcedure
      .input(z.object({
        companyName: z.string().min(2, "Informe a empresa"),
        userName: z.string().min(2, "Informe o nome do usuário"),
        email: z.string().email("Informe um e-mail válido"),
        password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
      }))
      .mutation(async ({ input }) => {
        try {
          const id = await memberAuth.createMemberAccount(input);
          return { id };
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." });
          }
          throw error;
        }
      }),
    setActive: adminProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(async ({ input }) => {
        try {
          await memberAuth.setMemberActive(input.id, input.active);
        } catch (error: any) {
          if (error?.message === "A conta administrativa não pode ser bloqueada.") {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
        return { success: true } as const;
      }),
  }),

  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => db.getDashboardStats(ctx.accountId)),
  }),

  settings: router({
    getAlertDays: protectedProcedure.query(async () => parseInt(await db.getSetting("alert_days_ahead", "30"), 10) || 30),
    setAlertDays: adminProcedure
      .input(z.object({ days: z.number().min(1).max(365) }))
      .mutation(async ({ input }) => {
        await db.setSetting("alert_days_ahead", input.days.toString());
        return { success: true, days: input.days };
      }),
  }),

  clients: router({
    list: protectedProcedure
      .input(z.object({ city: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => db.getClients(input?.city, ctx.accountId)),
    cities: protectedProcedure.query(async ({ ctx }) => db.getDistinctCities(ctx.accountId)),
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id, ctx.accountId);
        if (!client) return { client: null, extinguishers: [], orders: [] };
        return {
          client,
          extinguishers: await db.getExtinguishersByClient(input.id, ctx.accountId),
          orders: await db.getServiceOrders(input.id, ctx.accountId),
        };
      }),
    create: protectedProcedure
      .input(z.object({
        companyName: z.string().min(1, "Nome da empresa é obrigatório"),
        cnpj: z.string().optional(), address: z.string().optional(), city: z.string().min(1, "Cidade é obrigatória"),
        cep: z.string().optional(), phone: z.string().optional(), contactName: z.string().optional(),
        cpf: z.string().optional(), birthDate: z.string().optional(), notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => ({ id: await db.createClient({ ...input, accountId: ctx.accountId ?? null, cnpj: emptyToNull(input.cnpj), address: emptyToNull(input.address), cep: emptyToNull(input.cep), phone: emptyToNull(input.phone), contactName: emptyToNull(input.contactName), cpf: emptyToNull(input.cpf), birthDate: emptyToNull(input.birthDate), notes: emptyToNull(input.notes) }) })),
    update: protectedProcedure
      .input(z.object({
        id: z.number(), companyName: z.string().min(1), cnpj: z.string().optional(), address: z.string().optional(), city: z.string().min(1),
        cep: z.string().optional(), phone: z.string().optional(), contactName: z.string().optional(), cpf: z.string().optional(), birthDate: z.string().optional(), notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateClient(id, { ...data, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }, ctx.accountId);
        return { success: true } as const;
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await db.deleteClient(input.id, ctx.accountId); return { success: true } as const; }),
  }),

  extinguishers: router({
    listByClient: protectedProcedure.input(z.object({ clientId: z.number() })).query(async ({ ctx, input }) => db.getExtinguishersByClient(input.clientId, ctx.accountId)),
    alerts: protectedProcedure.input(z.object({ daysAhead: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const days = input?.daysAhead || parseInt(await db.getSetting("alert_days_ahead", "30"), 10) || 30;
      return db.getExpiringExtinguishers(days, ctx.accountId);
    }),
    create: protectedProcedure.input(z.object({
      clientId: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => ({ id: await db.createExtinguisher({ ...input, expirationDate: input.expirationDate as any, lastInspectionDate: (input.lastInspectionDate || null) as any, capacity: emptyToNull(input.capacity), serialNumber: emptyToNull(input.serialNumber), locationInBuilding: emptyToNull(input.locationInBuilding), notes: emptyToNull(input.notes) }, ctx.accountId) })),
    update: protectedProcedure.input(z.object({ id: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => { const { id, ...data } = input; await db.updateExtinguisher(id, { ...data, expirationDate: data.expirationDate as any, lastInspectionDate: (data.lastInspectionDate || null) as any }, ctx.accountId); return { success: true } as const; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await db.deleteExtinguisher(input.id, ctx.accountId); return { success: true } as const; }),
  }),

  orders: router({
    list: protectedProcedure.input(z.object({ clientId: z.number().optional() }).optional()).query(async ({ ctx, input }) => db.getServiceOrders(input?.clientId, ctx.accountId)),
    nextNumber: protectedProcedure.query(async ({ ctx }) => db.getNextOrderNumber(ctx.accountId)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => db.getServiceOrderById(input.id, ctx.accountId)),
    create: protectedProcedure.input(z.object({
      orderNumber: z.number().optional(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string().default("SIM"), leftReserve: z.string().default("NÃO"), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string().default("0.00"), paymentMethod: z.string().default("A VISTA"), installmentsCount: z.number().default(1), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string() })),
    })).mutation(async ({ ctx, input }) => { const { items, ...orderData } = input; return db.createServiceOrder(orderData as any, items as any, ctx.accountId); }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await db.deleteServiceOrder(input.id, ctx.accountId); return { success: true } as const; }),
  }),
});

export type AppRouter = typeof appRouter;
