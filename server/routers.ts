import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Estatísticas gerais
  dashboard: router({
    stats: publicProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),

  // Gestão de Configurações
  settings: router({
    getAlertDays: publicProcedure.query(async () => {
      const val = await db.getSetting("alert_days_ahead", "30");
      return parseInt(val, 10) || 30;
    }),
    setAlertDays: publicProcedure
      .input(z.object({ days: z.number().min(1).max(365) }))
      .mutation(async ({ input }) => {
        await db.setSetting("alert_days_ahead", input.days.toString());
        return { success: true, days: input.days };
      }),
  }),

  // Gestão de Clientes
  clients: router({
    list: publicProcedure
      .input(z.object({ city: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getClients(input?.city);
      }),
    cities: publicProcedure.query(async () => {
      return await db.getDistinctCities();
    }),
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const client = await db.getClientById(input.id);
        const clientExtinguishers = await db.getExtinguishersByClient(input.id);
        const orders = await db.getServiceOrders(input.id);
        return {
          client,
          extinguishers: clientExtinguishers,
          orders,
        };
      }),
    create: publicProcedure
      .input(
        z.object({
          companyName: z.string().min(1, "Nome da empresa é obrigatório"),
          cnpj: z.string().optional(),
          address: z.string().optional(),
          city: z.string().min(1, "Cidade é obrigatória"),
          cep: z.string().optional(),
          phone: z.string().optional(),
          contactName: z.string().optional(),
          cpf: z.string().optional(),
          birthDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createClient({
          companyName: input.companyName,
          cnpj: input.cnpj ?? null,
          address: input.address ?? null,
          city: input.city,
          cep: input.cep ?? null,
          phone: input.phone ?? null,
          contactName: input.contactName ?? null,
          cpf: input.cpf ?? null,
          birthDate: input.birthDate ?? null,
          notes: input.notes ?? null,
        });
        return { id };
      }),
    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          companyName: z.string().min(1),
          cnpj: z.string().optional(),
          address: z.string().optional(),
          city: z.string().min(1),
          cep: z.string().optional(),
          phone: z.string().optional(),
          contactName: z.string().optional(),
          cpf: z.string().optional(),
          birthDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateClient(id, data);
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteClient(input.id);
        return { success: true };
      }),
  }),

  // Gestão de Extintores
  extinguishers: router({
    listByClient: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getExtinguishersByClient(input.clientId);
      }),
    alerts: publicProcedure
      .input(z.object({ daysAhead: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const days = input?.daysAhead || parseInt(await db.getSetting("alert_days_ahead", "30"), 10) || 30;
        return await db.getExpiringExtinguishers(days);
      }),
    create: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          typeModel: z.string().min(1, "Modelo é obrigatório"),
          capacity: z.string().optional(),
          serialNumber: z.string().optional(),
          locationInBuilding: z.string().optional(),
          expirationDate: z.string(), // YYYY-MM-DD
          lastInspectionDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createExtinguisher({
          clientId: input.clientId,
          typeModel: input.typeModel,
          capacity: input.capacity ?? null,
          serialNumber: input.serialNumber ?? null,
          locationInBuilding: input.locationInBuilding ?? null,
          expirationDate: input.expirationDate as any,
          lastInspectionDate: (input.lastInspectionDate ? input.lastInspectionDate : null) as any,
          notes: input.notes ?? null,
        });
        return { id };
      }),
    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          typeModel: z.string().min(1),
          capacity: z.string().optional(),
          serialNumber: z.string().optional(),
          locationInBuilding: z.string().optional(),
          expirationDate: z.string(),
          lastInspectionDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateExtinguisher(id, {
          ...data,
          expirationDate: data.expirationDate as any,
          lastInspectionDate: (data.lastInspectionDate || null) as any,
        });
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExtinguisher(input.id);
        return { success: true };
      }),
  }),

  // Gestão de Ordens de Serviço
  orders: router({
    list: publicProcedure
      .input(z.object({ clientId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getServiceOrders(input?.clientId);
      }),
    nextNumber: publicProcedure.query(async () => {
      return await db.getNextOrderNumber();
    }),
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getServiceOrderById(input.id);
      }),
    create: publicProcedure
      .input(
        z.object({
          orderNumber: z.number().optional(),
          orderDate: z.string(), // YYYY-MM-DD
          clientId: z.number(),
          replacedAndDelivered: z.string().default("SIM"),
          leftReserve: z.string().default("NÃO"),
          reserveDetails: z.string().optional(),
          extinguisherExpiration: z.string().optional(),
          licenseExpiration: z.string().optional(),
          totalAmount: z.string().default("0.00"),
          paymentMethod: z.string().default("A VISTA"),
          installmentsCount: z.number().default(1),
          installmentDates: z.string().optional(),
          responsibleName: z.string().optional(),
          responsibleCpf: z.string().optional(),
          responsibleBirthDate: z.string().optional(),
          observations: z.string().optional(),
          items: z.array(
            z.object({
              description: z.string().min(1),
              quantity: z.number().min(1),
              unitPrice: z.string(),
              totalPrice: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const { items, ...orderData } = input;
        const result = await db.createServiceOrder(orderData as any, items as any);
        return result;
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteServiceOrder(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
