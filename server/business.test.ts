import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("Business Logic - Extintores e Ordens de Serviço", () => {
  it("deve carregar as estatísticas do painel com sucesso", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const stats = await caller.dashboard.stats();
    expect(stats).toBeDefined();
    expect(stats.totalClients).toBeGreaterThanOrEqual(1);
    expect(stats.totalExtinguishers).toBeGreaterThanOrEqual(1);
  });

  it("deve listar os clientes e filtrar corretamente por cidade", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const cities = await caller.clients.cities();
    expect(cities).toBeInstanceOf(Array);
    expect(cities.length).toBeGreaterThan(0);

    const sapirangaClients = await caller.clients.list({ city: "Sapiranga" });
    expect(sapirangaClients.length).toBeGreaterThan(0);
    expect(sapirangaClients[0].city).toBe("Sapiranga");
  });

  it("deve retornar alertas de vencimento com cálculo de dias e urgência", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const alerts = await caller.extinguishers.alerts({ daysAhead: 30 });
    expect(alerts).toBeInstanceOf(Array);
    expect(alerts.length).toBeGreaterThan(0);

    const firstAlert = alerts[0];
    expect(firstAlert).toHaveProperty("diffDays");
    expect(firstAlert).toHaveProperty("alertStatus");
    expect(firstAlert).toHaveProperty("alertMessage");
  });

  it("deve buscar uma ordem de serviço e seus itens correspondentes", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const orders = await caller.orders.list();
    expect(orders.length).toBeGreaterThan(0);

    const orderDetail = await caller.orders.byId({ id: orders[0].order.id });
    expect(orderDetail).toBeDefined();
    expect(orderDetail?.items).toBeInstanceOf(Array);
    expect(orderDetail?.items.length).toBeGreaterThanOrEqual(1);
    expect(orderDetail?.client).toBeDefined();
  });
});
