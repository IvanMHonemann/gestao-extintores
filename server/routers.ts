import { MEMBER_COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, companyAdminProcedure, commercialProcedure, platformProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as memberAuth from "./memberAuth";

const emptyToNull = (value?: string) => value?.trim() || null;
const companyUserRole = z.enum(["company_admin", "operator", "technician"]);

const clientInput = z.object({
  companyName: z.string().min(1, "Nome da empresa é obrigatório"),
  cnpj: z.string().optional(), address: z.string().optional(), city: z.string().min(1, "Cidade é obrigatória"),
  cep: z.string().optional(), phone: z.string().optional(), contactName: z.string().optional(),
  cpf: z.string().optional(), birthDate: z.string().optional(), notes: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const principal = await memberAuth.authenticateMember(input.email, input.password);
        if (!principal) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        const session = await memberAuth.createSession(principal);
        ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, { ...getSessionCookieOptions(ctx.req, true), maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, kind: session.kind } as const;
      }),

    recoverPassword: publicProcedure
      .input(z.object({ email: z.string().email(), recoveryCode: z.string().min(1), newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") }))
      .mutation(async ({ input }) => {
        const recovered = await memberAuth.recoverPassword(input.email, input.recoveryCode, input.newPassword);
        if (!recovered) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou código de recuperação inválido." });
        return { success: true, recoveryCode: recovered.recoveryCode } as const;
      }),

    changePassword: publicProcedure
      .use(async opts => {
        if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
        return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
      })
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") }))
      .mutation(async ({ ctx, input }) => {
        const changed = ctx.user.role === "platform_admin"
          ? await memberAuth.changePlatformPassword(ctx.platformAdminId ?? ctx.user.id, input.currentPassword, input.newPassword)
          : await memberAuth.changeMemberPassword(ctx.memberAccountId ?? Math.abs(ctx.user.id), input.currentPassword, input.newPassword);
        if (!changed) throw new TRPCError({ code: "UNAUTHORIZED", message: "A senha atual está incorreta." });
        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookies = parseCookie(ctx.req.headers.cookie ?? "");
      await memberAuth.revokeSessions(cookies[MEMBER_COOKIE_NAME] ?? "");
      const memberCookieOptions = getSessionCookieOptions(ctx.req, true);
      if (cookies[MEMBER_COOKIE_NAME]) ctx.res.clearCookie(MEMBER_COOKIE_NAME, { ...memberCookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  offline: router({
    snapshot: commercialProcedure.input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().min(10).max(100).optional() }).optional()).query(({ ctx, input }) => db.getOfflineSnapshot(ctx.accountId, input)),
  }),

  platform: router({
    identity: platformProcedure.query(({ ctx }) => ({ id: ctx.platformAdminId ?? ctx.user.id, role: "platform_admin" as const, global: true })),
    companies: router({
      list: platformProcedure.query(() => db.listCompanies()),
      create: platformProcedure.input(z.object({ companyName: z.string().min(2), userName: z.string().min(2), email: z.string().email(), password: z.string().min(8) })).mutation(async ({ input }) => {
        try { return await memberAuth.createCompanyWithAdmin(input); }
        catch (error: any) { if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." }); throw error; }
      }),
      update: platformProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(2).optional(), active: z.boolean().optional() })).mutation(async ({ input }) => { await db.updateCompany(input.id, { name: input.name, active: input.active }); return { success: true } as const; }),
    }),
    dashboard: platformProcedure.input(z.object({ companyId: z.number().int().positive(), city: z.string().optional(), from: z.string().optional(), to: z.string().optional() })).query(({ input }) => db.getPlatformDashboardStats(input.companyId, input)),
    users: platformProcedure.query(() => memberAuth.listMemberAccounts()),
    data: router({
      clients: platformProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.getPlatformClients(input?.companyId)),
      clientsPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), city: z.string().optional(), search: z.string().optional() })).query(({ input }) => db.getClientsPage(input.companyId, input)),
      extinguishers: platformProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.getPlatformExtinguishers(input?.companyId)),
      extinguishersPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), filter: z.enum(["all", "active", "near", "expired"]).optional() })).query(({ input }) => db.getExtinguishersPage(input.companyId, input)),
      orders: platformProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.getPlatformOrders(input?.companyId)),
      ordersPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), city: z.string().optional(), from: z.string().optional(), to: z.string().optional() })).query(({ input }) => db.getServiceOrdersPage(input.companyId, input)),
      alertsPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), daysAhead: z.number().optional(), filter: z.enum(["all", "near", "expired"]).optional(), search: z.string().optional(), city: z.string().optional() })).query(async ({ input }) => { const days = input.daysAhead || parseInt(await db.getSetting("alert_days_ahead", input.companyId, "30"), 10) || 30; return db.getExpiringExtinguishersPage(days, input.companyId, input); }),
      history: platformProcedure.input(z.object({ companyId: z.number().int().positive(), clientId: z.number().int().positive() })).query(({ input }) => db.getServiceOrderHistory(input.clientId, input.companyId)),
      createClient: platformProcedure.input(clientInput.extend({ companyId: z.number().int().positive() })).mutation(async ({ input }) => {
        const { companyId, ...data } = input;
        const company = await db.getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para cadastrar o cliente." });
        return { id: await db.createClient({ ...data, accountId: companyId, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }) };
      }),
      createExtinguisher: platformProcedure.input(z.object({ companyId: z.number().int().positive(), clientId: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional() })).mutation(async ({ input }) => {
        const { companyId, ...data } = input;
        const company = await db.getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para cadastrar o extintor." });
        return { id: await db.createExtinguisher({ ...data, accountId: companyId, expirationDate: data.expirationDate as any, lastInspectionDate: (data.lastInspectionDate || null) as any, capacity: emptyToNull(data.capacity), serialNumber: emptyToNull(data.serialNumber), locationInBuilding: emptyToNull(data.locationInBuilding), notes: emptyToNull(data.notes) }, companyId) };
      }),
      createOrder: platformProcedure.input(z.object({ companyId: z.number().int().positive(), orderNumber: z.number().optional(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string().default("SIM"), leftReserve: z.string().default("NÃO"), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string().default("0.00"), paymentMethod: z.string().default("A VISTA"), installmentsCount: z.number().default(1), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string() })) })).mutation(async ({ input, ctx }) => {
        const { companyId, items, ...orderData } = input;
        const company = await db.getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para criar a ordem de serviço." });
        return db.createServiceOrder({ ...orderData, accountId: companyId, createdByName: ctx.user.name || ctx.user.email || "Administrador geral" } as any, items as any, companyId);
      }),
      deleteOrder: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.deleteServiceOrder(input.id, input.companyId); return { success: true } as const; }),
      deleteClient: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.deleteClient(input.id, input.companyId); return { success: true } as const; }),
      deleteExtinguisher: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.deleteExtinguisher(input.id, input.companyId); return { success: true } as const; }),
      updateClient: platformProcedure.input(clientInput.extend({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { const { companyId, id, ...data } = input; await db.updateClient(id, { ...data, accountId: companyId, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }, companyId); return { success: true } as const; }),
      updateOrder: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string(), leftReserve: z.string(), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string(), paymentMethod: z.string(), installmentsCount: z.number(), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string() })) })).mutation(async ({ input }) => { const { companyId, id, items, ...orderData } = input; await db.updateServiceOrder(id, { ...orderData, accountId: companyId } as any, items as any, companyId); return { success: true } as const; }),
      trash: router({
        list: platformProcedure.input(z.object({ companyId: z.number().int().positive() })).query(({ input }) => db.listTrash(input.companyId)),
        restore: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.restoreTrashItem(input.id, input.companyId); return { success: true } as const; }),
        permanentlyDelete: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.permanentlyDeleteTrashItem(input.id, input.companyId); return { success: true } as const; }),
      }),
    }),
  }),

  /** Compatibilidade do painel administrativo: somente platform_admin acessa estas operações globais. */
  accounts: router({
    list: platformProcedure.query(() => memberAuth.listMemberAccounts()),
    create: platformProcedure.input(z.object({ companyName: z.string().min(2), userName: z.string().min(2), email: z.string().email(), password: z.string().min(8) })).mutation(async ({ input }) => memberAuth.createCompanyWithAdmin(input)),
    setActive: platformProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input }) => { await memberAuth.setMemberActive(input.id, input.active); return { success: true } as const; }),
    resetPassword: platformProcedure.input(z.object({ id: z.number().int().positive(), newPassword: z.string().min(8) })).mutation(async ({ input }) => { await memberAuth.resetMemberPassword(input.id, input.newPassword); return { success: true } as const; }),
  }),

  companyUsers: router({
    list: companyAdminProcedure.query(({ ctx }) => memberAuth.listMemberAccounts(ctx.accountId)),
    create: companyAdminProcedure.input(z.object({ userName: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: companyUserRole })).mutation(async ({ ctx, input }) => {
      try { return await memberAuth.createCompanyUser({ ...input, companyId: ctx.accountId }); }
      catch (error: any) { if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." }); throw error; }
    }),
    update: companyAdminProcedure.input(z.object({ id: z.number().int().positive(), userName: z.string().min(2).optional(), email: z.string().email().optional(), role: companyUserRole.optional() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && input.role && input.role !== "company_admin") throw new TRPCError({ code: "BAD_REQUEST", message: "O administrador não pode remover o próprio nível administrativo." });
      await memberAuth.updateCompanyUser(input.id, ctx.accountId, { userName: input.userName, email: input.email, role: input.role });
      return { success: true } as const;
    }),
    setActive: companyAdminProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => { if (input.id === ctx.memberAccountId && !input.active) throw new TRPCError({ code: "BAD_REQUEST", message: "O administrador não pode desativar a própria sessão." }); await memberAuth.setMemberActive(input.id, input.active, ctx.accountId); return { success: true } as const; }),
    resetPassword: companyAdminProcedure.input(z.object({ id: z.number().int().positive(), newPassword: z.string().min(8) })).mutation(async ({ ctx, input }) => { const users = await memberAuth.listMemberAccounts(ctx.accountId); if (!users.some(account => account.id === input.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não pertence a esta empresa." }); await memberAuth.resetMemberPassword(input.id, input.newPassword); return { success: true } as const; }),
  }),

  dashboard: router({ stats: commercialProcedure.query(async ({ ctx }) => db.getDashboardStats(ctx.accountId)) }),

  settings: router({
    getAlertDays: commercialProcedure.query(async ({ ctx }) => parseInt(await db.getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30),
    setAlertDays: companyAdminProcedure.input(z.object({ days: z.number().min(1).max(365) })).mutation(async ({ ctx, input }) => { await db.setSetting("alert_days_ahead", input.days.toString(), ctx.accountId); return { success: true, days: input.days } as const; }),
  }),

  clients: router({
    list: commercialProcedure.input(z.object({ city: z.string().optional() }).optional()).query(async ({ ctx, input }) => db.getClients(input?.city, ctx.accountId)),
    page: commercialProcedure.input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), city: z.string().optional(), search: z.string().optional() }).optional()).query(({ ctx, input }) => db.getClientsPage(ctx.accountId, input)),
    cities: commercialProcedure.query(async ({ ctx }) => db.getDistinctCities(ctx.accountId)),
    byId: commercialProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => { const client = await db.getClientById(input.id, ctx.accountId); if (!client) return { client: null, extinguishers: [], orders: [] }; return { client, extinguishers: await db.getExtinguishersByClient(input.id, ctx.accountId), orders: await db.getServiceOrders(input.id, ctx.accountId) }; }),
    create: commercialProcedure.input(clientInput).mutation(async ({ ctx, input }) => ({ id: await db.createClient({ ...input, accountId: ctx.accountId, cnpj: emptyToNull(input.cnpj), address: emptyToNull(input.address), cep: emptyToNull(input.cep), phone: emptyToNull(input.phone), contactName: emptyToNull(input.contactName), cpf: emptyToNull(input.cpf), birthDate: emptyToNull(input.birthDate), notes: emptyToNull(input.notes) }) })),
    update: commercialProcedure.input(clientInput.extend({ id: z.number() })).mutation(async ({ ctx, input }) => { const { id, ...data } = input; await db.updateClient(id, { ...data, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }, ctx.accountId); return { success: true } as const; }),
    delete: companyAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await db.deleteClient(input.id, ctx.accountId); return { success: true } as const; }),
  }),

  extinguishers: router({
    list: commercialProcedure.query(({ ctx }) => db.getExtinguishers(ctx.accountId)),
    page: commercialProcedure.input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), filter: z.enum(["all", "active", "near", "expired"]).optional() }).optional()).query(({ ctx, input }) => db.getExtinguishersPage(ctx.accountId, input)),
    listByClient: commercialProcedure.input(z.object({ clientId: z.number() })).query(async ({ ctx, input }) => db.getExtinguishersByClient(input.clientId, ctx.accountId)),
    alerts: commercialProcedure.input(z.object({ daysAhead: z.number().optional() }).optional()).query(async ({ ctx, input }) => { const days = input?.daysAhead || parseInt(await db.getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30; return db.getExpiringExtinguishers(days, ctx.accountId); }),
    alertsPage: commercialProcedure.input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), daysAhead: z.number().optional(), filter: z.enum(["all", "near", "expired"]).optional(), search: z.string().optional(), city: z.string().optional() }).optional()).query(async ({ ctx, input }) => { const days = input?.daysAhead || parseInt(await db.getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30; return db.getExpiringExtinguishersPage(days, ctx.accountId, input); }),
    create: commercialProcedure.input(z.object({ clientId: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => ({ id: await db.createExtinguisher({ ...input, accountId: ctx.accountId, expirationDate: input.expirationDate as any, lastInspectionDate: (input.lastInspectionDate || null) as any, capacity: emptyToNull(input.capacity), serialNumber: emptyToNull(input.serialNumber), locationInBuilding: emptyToNull(input.locationInBuilding), notes: emptyToNull(input.notes) }, ctx.accountId) })),
    update: commercialProcedure.input(z.object({ id: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => { const { id, ...data } = input; await db.updateExtinguisher(id, { ...data, expirationDate: data.expirationDate as any, lastInspectionDate: (data.lastInspectionDate || null) as any }, ctx.accountId); return { success: true } as const; }),
    delete: companyAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await db.deleteExtinguisher(input.id, ctx.accountId); return { success: true } as const; }),
  }),

  orders: router({
    list: commercialProcedure.input(z.object({ clientId: z.number().optional() }).optional()).query(async ({ ctx, input }) => db.getServiceOrders(input?.clientId, ctx.accountId)),
    page: commercialProcedure.input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), city: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).optional()).query(({ ctx, input }) => db.getServiceOrdersPage(ctx.accountId, input)),
    history: commercialProcedure.input(z.object({ clientId: z.number() })).query(async ({ ctx, input }) => db.getServiceOrderHistory(input.clientId, ctx.accountId)),
    nextNumber: commercialProcedure.query(async ({ ctx }) => db.getNextOrderNumber(ctx.accountId)),
    byId: commercialProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => db.getServiceOrderById(input.id, ctx.accountId)),
    create: commercialProcedure.input(z.object({ orderNumber: z.number().optional(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string().default("SIM"), leftReserve: z.string().default("NÃO"), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string().default("0.00"), paymentMethod: z.string().default("A VISTA"), installmentsCount: z.number().default(1), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string() })) })).mutation(async ({ ctx, input }) => { const { items, ...orderData } = input; return db.createServiceOrder({ ...orderData, accountId: ctx.accountId, createdByName: ctx.user.name || ctx.user.email || "Usuário não identificado" } as any, items as any, ctx.accountId); }),
    update: commercialProcedure.input(z.object({ id: z.number(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string(), leftReserve: z.string(), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string(), paymentMethod: z.string(), installmentsCount: z.number(), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string() })) })).mutation(async ({ ctx, input }) => { const { id, items, ...orderData } = input; await db.updateServiceOrder(id, { ...orderData, accountId: ctx.accountId } as any, items as any, ctx.accountId); return { success: true } as const; }),
    delete: commercialProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await db.deleteServiceOrder(input.id, ctx.accountId); return { success: true } as const; }),
  }),

  trash: router({
    list: companyAdminProcedure.query(({ ctx }) => db.listTrash(ctx.accountId)),
    restore: companyAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await db.restoreTrashItem(input.id, ctx.accountId); return { success: true } as const; }),
    permanentlyDelete: companyAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await db.permanentlyDeleteTrashItem(input.id, ctx.accountId); return { success: true } as const; }),
  }),
});

export type AppRouter = typeof appRouter;
