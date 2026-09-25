import React, { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { 
  Building2, 
  Flame, 
  FileText, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  Eye, 
  Trash2, 
  Edit, 
  MapPin, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Settings,
  BellRing,
  Download,
  HardDrive,
  ShieldCheck,
  ChevronRight,
  Users,
  LogOut,
  Menu,
  X,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ServiceOrderDocument } from "@/components/ServiceOrderDocument";
import { toast } from "sonner";
import { useOfflineSnapshot, useOnlineStatus } from "@/offline/hooks";
import { offlineDb, queueOfflineMutation } from "@/offline/localDb";

export default function Home() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const tenantKey = user && user.id < 0 ? String(Math.abs(user.id)) : null;
  const isCompanyAdmin = user?.role === "company_admin";
  const canManageUsers = isCompanyAdmin || user?.role === "platform_admin";
  const [activeTab, setActiveTab] = useState<"dashboard" | "clients" | "extinguishers" | "orders" | "alerts">("dashboard");
  const [selectedCity, setSelectedCity] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [extinguisherFilter, setExtinguisherFilter] = useState<"all" | "active">("all");
  const [alertFilter, setAlertFilter] = useState<"all" | "near" | "expired">("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Visualização e Impressão de OS
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null);

  // Modais de Criação
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isExtinguisherModalOpen, setIsExtinguisherModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [returnToOrderAfterClient, setReturnToOrderAfterClient] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  // Seleções para sub-ações
  const [selectedClientIdForExtinguisher, setSelectedClientIdForExtinguisher] = useState<number | null>(null);

  // Queries
  const statsQuery = trpc.dashboard.stats.useQuery(undefined, { enabled: Boolean(tenantKey) });
  const citiesQuery = trpc.clients.cities.useQuery(undefined, { enabled: Boolean(tenantKey) });
  const clientsQuery = trpc.clients.list.useQuery(undefined, { enabled: Boolean(tenantKey) });
  const alertsQuery = trpc.extinguishers.alerts.useQuery(undefined, { enabled: Boolean(tenantKey) });
  const ordersQuery = trpc.orders.list.useQuery(undefined, { enabled: Boolean(tenantKey) });
  const alertDaysQuery = trpc.settings.getAlertDays.useQuery(undefined, { enabled: Boolean(tenantKey) });
  const companiesQuery = trpc.platform.companies.list.useQuery(undefined, { enabled: user?.role === "platform_admin" });
  const remoteExtinguishers = useMemo(() => (alertsQuery.data || []).map((item: any) => item.extinguisher).filter(Boolean), [alertsQuery.data]);
  const orderDetailsQuery = trpc.orders.byId.useQuery(
    { id: viewingOrderId! },
    { enabled: Boolean(tenantKey && viewingOrderId) }
  );

  const offline = useOfflineSnapshot({
    tenantKey,
    clients: clientsQuery.data as any,
    extinguishers: remoteExtinguishers as any,
    orders: ordersQuery.data as any,
    alerts: alertsQuery.data as any,
    alertDays: alertDaysQuery.data,
  });
  const allClients = useMemo(() => offline.clients || [], [offline.clients]);
  const effectiveClients = useMemo(() => allClients.filter((client: any) => selectedCity === "TODAS" || client.city === selectedCity), [allClients, selectedCity]);
  const effectiveCities = useMemo(() => Array.from(new Set(allClients.map((client: any) => client.city).filter(Boolean))).sort(), [allClients]);
  const effectiveAlerts = offline.alerts || [];
  const effectiveOrders = offline.orders || [];
  const effectiveStats = useMemo(() => offline.isOnline && statsQuery.data ? statsQuery.data : {
    totalClients: effectiveClients.length,
    totalCities: effectiveCities.length,
    totalExtinguishers: offline.extinguishers?.length || 0,
    nearExpirationCount: effectiveAlerts.filter((item: any) => item.alertStatus === "warning" || item.alertStatus === "urgent").length,
    expiredCount: effectiveAlerts.filter((item: any) => item.alertStatus === "expired").length,
    totalOrders: effectiveOrders.length,
  }, [offline.isOnline, statsQuery.data, effectiveClients.length, effectiveCities.length, offline.extinguishers?.length, effectiveAlerts, effectiveOrders.length]);
  const offlineOrderDetails = useMemo(() => {
    const row = (offline.orders || []).find((item: any) => item.order?.id === viewingOrderId);
    return row ? { ...row.order, client: row.client, items: row.order.items || [] } : undefined;
  }, [offline.orders, viewingOrderId]);

  // Mutations
  const utils = trpc.useUtils();

  useEffect(() => {
    if (selectedCompanyId === null && companiesQuery.data?.length) {
      setSelectedCompanyId(companiesQuery.data.find((company) => company.active)?.id ?? companiesQuery.data[0].id);
    }
  }, [companiesQuery.data, selectedCompanyId]);

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: async (result) => {
      toast.success("Cliente cadastrado com sucesso!");
      setIsClientModalOpen(false);
      const savedClient = {
        ...clientForm,
        id: result.id,
        accountId: Number(tenantKey),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      utils.clients.list.setData(undefined, (current) => [savedClient as any, ...((current || []) as any[]).filter((client) => client.id !== result.id)]);
      await utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
      if (returnToOrderAfterClient) {
        setOrderForm(prev => ({ ...prev, clientId: result.id, responsibleName: clientForm.contactName, responsibleCpf: clientForm.cpf, responsibleBirthDate: clientForm.birthDate }));
        setReturnToOrderAfterClient(false);
        setIsOrderModalOpen(true);
      }
    },
    onError: async (err, input) => {
      if (!offline.isOnline) { const localId = await saveOfflineClient(input); await queueOfflineMutation({ tenantKey: tenantKey!, entity: "client", action: "create", payload: { ...input, localId } }); toast.success("Cliente salvo no dispositivo (offline)."); setIsClientModalOpen(false); return; }
      toast.error(err.message);
    },
  });

  const platformCreateClientMutation = trpc.platform.data.createClient.useMutation({
    onSuccess: async () => {
      toast.success("Cliente cadastrado com sucesso!");
      setIsClientModalOpen(false);
      await utils.platform.data.clients.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteClientMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente excluído!");
      utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: async (err, input) => {
      if (!offline.isOnline) {
        if (!tenantKey) return;
        const clientRows = (await offlineDb.clients.where("tenantKey").equals(tenantKey).filter((row) => row.id === input.id).toArray()).map((row) => row.id);
        await offlineDb.clients.bulkDelete(clientRows);
        const ext = await offlineDb.extinguishers.where("tenantKey").equals(tenantKey).filter((row) => row.clientId === input.id).toArray();
        await offlineDb.extinguishers.bulkDelete(ext.map((item) => item.id));
        const orders = await offlineDb.orders.where("tenantKey").equals(tenantKey).filter((item) => item.order?.clientId === input.id).toArray();
        await offlineDb.orders.bulkDelete(orders.map((item) => item.order.id));
        await queueOfflineMutation({ tenantKey, entity: "client", action: "delete", payload: input });
        toast.success("Cliente removido do dispositivo.");
        return;
      }
      toast.error(err.message);
    },
  });

  const createExtinguisherMutation = trpc.extinguishers.create.useMutation({
    onSuccess: () => {
      toast.success("Extintor registrado com sucesso!");
      setIsExtinguisherModalOpen(false);
      utils.extinguishers.invalidate();
      utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: async (err, input) => {
      if (!offline.isOnline) { const localId = await saveOfflineExtinguisher(input); await queueOfflineMutation({ tenantKey: tenantKey!, entity: "extinguisher", action: "create", payload: { ...input, localId } }); toast.success("Extintor salvo no dispositivo (offline)."); setIsExtinguisherModalOpen(false); return; }
      toast.error(err.message);
    },
  });

  const deleteExtinguisherMutation = trpc.extinguishers.delete.useMutation({
    onSuccess: () => {
      toast.success("Extintor removido!");
      utils.extinguishers.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: async (err, input) => {
      if (!offline.isOnline) { if (!tenantKey) return; const ext = (await offlineDb.extinguishers.where("tenantKey").equals(tenantKey).filter((row) => row.id === input.id).toArray()).map((row) => row.id); const alerts = (await offlineDb.alerts.where("tenantKey").equals(tenantKey).filter((row) => row.id === input.id).toArray()).map((row) => row.id); await offlineDb.extinguishers.bulkDelete(ext); await offlineDb.alerts.bulkDelete(alerts); await queueOfflineMutation({ tenantKey, entity: "extinguisher", action: "delete", payload: input }); toast.success("Extintor removido do dispositivo."); return; }
      toast.error(err.message);
    },
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (res) => {
      toast.success("Ordem de serviço criada com sucesso!");
      setIsOrderModalOpen(false);
      utils.orders.invalidate();
      utils.dashboard.stats.invalidate();
      if (res?.id) {
        setViewingOrderId(res.id);
      }
    },
    onError: async (err, input) => {
      if (!offline.isOnline) {
        const id = offlineId();
        const client = allClients.find((item: any) => item.id === input.clientId);
        const order = { ...input, id, orderNumber: input.orderNumber || Math.abs(id), items: input.items, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (!tenantKey) return;
        const localClient = client ? { ...client, tenantKey } : { id: input.clientId, tenantKey, companyName: "Cliente offline", city: "Não informado" };
        await offlineDb.orders.put({ tenantKey, order: { ...order, tenantKey }, client: localClient });
        await queueOfflineMutation({ tenantKey, entity: "order", action: "create", payload: { ...input, localId: id } });
        toast.success("Ordem salva no dispositivo (offline).");
        setIsOrderModalOpen(false);
        setViewingOrderId(id);
        return;
      }
      toast.error(err.message);
    },
  });

  const deleteOrderMutation = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("Ordem de serviço excluída!");
      utils.orders.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: async (err, input) => {
      if (!offline.isOnline) { if (!tenantKey) return; const orders = (await offlineDb.orders.where("tenantKey").equals(tenantKey).filter((row) => row.order?.id === input.id).toArray()).map((row) => row.order.id); await offlineDb.orders.bulkDelete(orders); await queueOfflineMutation({ tenantKey, entity: "order", action: "delete", payload: input }); toast.success("Ordem removida do dispositivo."); return; }
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (!offline.isOnline) return;
    let cancelled = false;
    void (async () => {
      if (!tenantKey) return;
      const queued = await offlineDb.mutations.where("tenantKey").equals(tenantKey).sortBy("createdAt");
      const idMap = new Map<number, number>();
      for (const mutation of queued) {
        if (cancelled) return;
        try {
          const raw = mutation.payload || {};
          const payload = { ...raw };
          delete payload.localId;
          delete payload.tenantKey;
          if (payload.clientId && idMap.has(payload.clientId)) payload.clientId = idMap.get(payload.clientId);
          if (payload.items) payload.items = payload.items.map((item: any) => ({ ...item, extinguisherId: idMap.get(item.extinguisherId) || item.extinguisherId }));
          if (mutation.action === "create") {
            const result = mutation.entity === "client" ? await createClientMutation.mutateAsync(payload) : mutation.entity === "extinguisher" ? await createExtinguisherMutation.mutateAsync(payload) : await createOrderMutation.mutateAsync(payload);
            if (raw.localId && result?.id) idMap.set(raw.localId, result.id);
          } else {
            const resolvedId = idMap.get(Number(payload.id)) || Number(payload.id);
            if (resolvedId > 0) {
              if (mutation.entity === "client") await deleteClientMutation.mutateAsync({ id: resolvedId });
              if (mutation.entity === "extinguisher") await deleteExtinguisherMutation.mutateAsync({ id: resolvedId });
              if (mutation.entity === "order") await deleteOrderMutation.mutateAsync({ id: resolvedId });
            }
          }
          if (mutation.id) await offlineDb.mutations.delete(mutation.id);
        } catch (error) {
          if (mutation.id) await offlineDb.mutations.update(mutation.id, { state: "failed", lastError: error instanceof Error ? error.message : "Falha desconhecida" });
          toast.error("Não foi possível sincronizar os dados locais. Tentaremos novamente.");
          return;
        }
      }
      if (!cancelled && queued.length) {
        await Promise.all([utils.clients.invalidate(), utils.extinguishers.invalidate(), utils.orders.invalidate(), utils.dashboard.stats.invalidate()]);
        toast.success("Dados offline sincronizados com sucesso.");
      }
    })();
    return () => { cancelled = true; };
  }, [offline.isOnline, tenantKey]);

  const setAlertDaysMutation = trpc.settings.setAlertDays.useMutation({
    onSuccess: () => {
      toast.success("Configuração de alerta atualizada!");
      setIsSettingsModalOpen(false);
      utils.settings.invalidate();
      utils.extinguishers.alerts.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });

  // FORM STATES
  const [clientForm, setClientForm] = useState({
    companyName: "",
    cnpj: "",
    address: "",
    city: "Sapiranga",
    cep: "",
    phone: "",
    contactName: "",
    cpf: "",
    birthDate: "",
    notes: "",
  });

  const [extinguisherForm, setExtinguisherForm] = useState({
    clientId: 0,
    typeModel: "PQS ABC 4kg",
    capacity: "4kg",
    serialNumber: "",
    locationInBuilding: "Recepção",
    expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
    lastInspectionDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [orderForm, setOrderForm] = useState({
    clientId: 0,
    orderDate: new Date().toISOString().split("T")[0],
    replacedAndDelivered: "SIM",
    leftReserve: "NÃO",
    reserveDetails: "",
    extinguisherExpiration: "",
    licenseExpiration: "",
    paymentMethod: "A VISTA",
    installmentsCount: 1,
    installmentDates: "",
    responsibleName: "",
    responsibleCpf: "",
    responsibleBirthDate: "",
    observations: "",
    items: [
      { description: "Recarga de Extintor PQS 4kg ABC", quantity: 1, unitPrice: "45.00", totalPrice: "45.00" },
    ],
  });

  const [configDays, setConfigDays] = useState<number>(30);

  // Atualizar subtotal de itens da OS
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...orderForm.items];
    (updated[index] as any)[field] = value;
    if (field === "quantity" || field === "unitPrice") {
      const q = Number(updated[index].quantity) || 0;
      const u = Number(updated[index].unitPrice) || 0;
      updated[index].totalPrice = (q * u).toFixed(2);
    }
    setOrderForm({ ...orderForm, items: updated });
  };

  const addItemRow = () => {
    setOrderForm({
      ...orderForm,
      items: [
        ...orderForm.items,
        { description: "Recarga de Extintor", quantity: 1, unitPrice: "0.00", totalPrice: "0.00" },
      ],
    });
  };

  const removeItemRow = (idx: number) => {
    if (orderForm.items.length <= 1) return;
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, i) => i !== idx),
    });
  };

  const calculatedTotalOrder = useMemo(() => {
    return orderForm.items
      .reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0)
      .toFixed(2);
  }, [orderForm.items]);

  const openClients = (filter: "all" | "active" = "all") => {
    setExtinguisherFilter(filter);
    setActiveTab("clients");
  };
  const openAlerts = (filter: "all" | "near" | "expired" = "all") => {
    setAlertFilter(filter);
    setActiveTab("alerts");
  };

  // Se estiver visualizando a OS para impressão
  const selectedOrderDetails = orderDetailsQuery.data || offlineOrderDetails;
  if (viewingOrderId && selectedOrderDetails) {
    return (
      <ServiceOrderDocument
        order={selectedOrderDetails}
        client={selectedOrderDetails.client}
        items={selectedOrderDetails.items}
        onBack={() => setViewingOrderId(null)}
      />
    );
  }

  const offlineId = () => -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  const saveOfflineClient = async (input: Partial<typeof clientForm> & { companyName: string; city: string }) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const id = offlineId();
    await offlineDb.clients.put({ ...input, id, tenantKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return id;
  };
  const saveOfflineExtinguisher = async (input: Partial<typeof extinguisherForm> & { clientId: number; typeModel: string; expirationDate: string }) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const id = offlineId();
    const expiration = new Date(`${input.expirationDate}T12:00:00`);
    const days = Math.ceil((expiration.getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000);
    const status = days < 0 ? "expired" : days <= (offline.alertDays || 30) ? "warning" : "ok";
    await offlineDb.extinguishers.put({ ...input, id, tenantKey, status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await offlineDb.alerts.put({ ...input, id, tenantKey, clientId: input.clientId, expirationDate: input.expirationDate, alertStatus: status === "expired" ? "expired" : status === "warning" ? "warning" : "ok" });
    return id;
  };

  // Filtragem dos clientes
  const filteredClients = (effectiveClients || []).filter(c => {
    const matchSearch = searchQuery === "" || 
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.cnpj && c.cnpj.includes(searchQuery)) ||
      (c.contactName && c.contactName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch;
  });
  const visibleAlerts = (effectiveAlerts || []).filter((item) => {
    if (alertFilter === "all") return true;
    return alertFilter === "expired" ? item.alertStatus === "expired" : item.alertStatus === "urgent" || item.alertStatus === "warning";
  });
  const navigateToSection = (section: "dashboard" | "clients" | "orders" | "alerts") => {
    if (section === "clients") setExtinguisherFilter("all");
    if (section === "alerts") setAlertFilter("all");
    setActiveTab(section);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-900 flex flex-col">
      {/* CABEÇALHO PRINCIPAL */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:h-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
            <Button variant="default" size="sm" className="h-10 gap-1.5 border border-red-400 bg-red-600 px-3 text-white shadow-lg shadow-red-950/40 hover:bg-red-700 lg:hidden" onClick={() => setIsSidebarOpen(true)} aria-label="Abrir menu lateral"><Menu className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-wide">Menu</span></Button>
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-inner">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight leading-none text-white">
                CONTROLE DE EXTINTORES
              </div>
              <div className="text-[11px] font-semibold text-red-400 tracking-wider uppercase">
                Sistema de Gestão & Ordens de Serviço
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
            {canManageUsers && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-slate-700 text-slate-200 hover:bg-slate-800"
                onClick={() => navigate("/admin/usuarios")}
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Usuários</span>
              </Button>
            )}
            {/* Botão Configurar Dias de Alerta — somente administrador da empresa */}
            {isCompanyAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-slate-200 border-slate-700 hover:bg-slate-800 gap-1.5"
                onClick={() => {
                  setConfigDays(offline.alertDays || 30);
                  setIsSettingsModalOpen(true);
                }}
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="hidden md:inline">Antecedência Alertas:</span>
                <span className="font-bold text-amber-400">{offline.alertDays || 30} dias</span>
              </Button>
            )}

            {/* Criar Ordem de Serviço Rápida */}
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5 shadow"
              onClick={() => {
                setReturnToOrderAfterClient(false);
                if (effectiveClients && effectiveClients.length > 0) {
                  setOrderForm(prev => ({ ...prev, clientId: effectiveClients[0].id }));
                }
                setIsOrderModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Ordem de Serviço</span>
              <span className="sm:hidden">Nova OS</span>
            </Button>
            <Button variant="ghost" size="sm" className="px-2 text-slate-300 hover:bg-slate-800 hover:text-white" title="Sair" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`desktop-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 text-white shadow-2xl lg:top-16 ${isSidebarOpen ? "is-open" : ""}`}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Menu principal</p><p className="mt-1 text-sm text-slate-300">Gestão de Extintores</p></div>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Navegação</p>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "dashboard" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("dashboard")}><Building2 className="h-4 w-4" /> Visão Geral</Button>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "clients" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("clients")}><MapPin className="h-4 w-4" /> Clientes por Cidade</Button>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "alerts" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("alerts")}><BellRing className="h-4 w-4 text-amber-400" /> Alertas de Vencimento {(effectiveStats?.nearExpirationCount || 0) + (effectiveStats?.expiredCount || 0) > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold">{(effectiveStats?.nearExpirationCount || 0) + (effectiveStats?.expiredCount || 0)}</span>}</Button>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "orders" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("orders")}><FileText className="h-4 w-4" /> Ordens de Serviço</Button>
          <div className="my-4 border-t border-slate-800" />
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Ações rápidas</p>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setIsClientModalOpen(true); setIsSidebarOpen(false); }}><Plus className="h-4 w-4" /> Cadastrar Cliente</Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setReturnToOrderAfterClient(false); setIsOrderModalOpen(true); setIsSidebarOpen(false); }}><FileText className="h-4 w-4" /> Nova Ordem de Serviço</Button>
          {canManageUsers && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { navigate("/admin/usuarios"); setIsSidebarOpen(false); }}><Users className="h-4 w-4" /> Usuários</Button>}
          {isCompanyAdmin && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setConfigDays(offline.alertDays || 30); setIsSettingsModalOpen(true); setIsSidebarOpen(false); }}><Settings className="h-4 w-4" /> Antecedência: {offline.alertDays || 30} dias</Button>}
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { navigate("/backup"); setIsSidebarOpen(false); }}><HardDrive className="h-4 w-4" /> Backup e Restauração</Button>
        </div>
        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400">Cidade selecionada: <strong className="text-slate-200">{selectedCity === "TODAS" ? "Todas" : selectedCity}</strong></div>
          <Select value={selectedCity} onValueChange={(val) => setSelectedCity(val)}><SelectTrigger className="mb-3 w-full border-slate-700 bg-slate-900 text-xs text-slate-200"><SelectValue placeholder="Filtrar cidade" /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as Cidades</SelectItem>{(effectiveCities || []).map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent></Select>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => logout()}><LogOut className="h-4 w-4" /> Sair</Button>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="min-w-0 flex-1 lg:pl-72">
      <div className="hidden border-b border-slate-200 bg-white shadow-sm lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {activeTab !== "dashboard" && <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-slate-600" onClick={() => setActiveTab("dashboard")}><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span></Button>}
            <p className="truncate text-xs font-semibold text-slate-500">{activeTab === "dashboard" ? "Visão Geral" : activeTab === "clients" ? "Clientes por Cidade" : activeTab === "alerts" ? "Alertas de Vencimento" : "Ordens de Serviço"}</p>
          </div>
          <span className="text-xs text-slate-400">Use o menu lateral para acessar todas as funções</span>
        </div>
      </div>
      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        {activeTab !== "dashboard" && (
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 lg:hidden">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-300 bg-white font-semibold text-slate-700" onClick={() => setActiveTab("dashboard")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar para o painel
            </Button>
          </div>
        )}
        {/* ========================================================
            ABA: DASHBOARD GERAL
        ======================================================== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card role="button" tabIndex={0} title="Abrir clientes cadastrados" onClick={() => openClients()} onKeyDown={(event) => event.key === "Enter" && openClients()} className="cursor-pointer border-l-4 border-l-blue-600 shadow-sm min-w-0 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Clientes
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-slate-900">
                    {effectiveStats?.totalClients || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Em {effectiveStats?.totalCities || 0} cidades
                </CardContent>
              </Card>

              <Card role="button" tabIndex={0} title="Abrir extintores ativos" onClick={() => openClients("active")} onKeyDown={(event) => event.key === "Enter" && openClients("active")} className="cursor-pointer border-l-4 border-l-emerald-600 shadow-sm min-w-0 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Extintores Ativos
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-emerald-700">
                    {effectiveStats?.totalExtinguishers || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Cadastrados na base
                </CardContent>
              </Card>

              <Card role="button" tabIndex={0} title="Abrir extintores perto da validade" onClick={() => openAlerts("near")} onKeyDown={(event) => event.key === "Enter" && openAlerts("near")} className="cursor-pointer border-l-4 border-l-amber-500 shadow-sm bg-amber-50/40 min-w-0 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Perto da Validade
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-amber-700">
                    {effectiveStats?.nearExpirationCount || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-amber-800 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Vencem em até {offline.alertDays || 30} dias
                </CardContent>
              </Card>

              <Card role="button" tabIndex={0} title="Abrir extintores vencidos" onClick={() => openAlerts("expired")} onKeyDown={(event) => event.key === "Enter" && openAlerts("expired")} className="cursor-pointer border-l-4 border-l-red-600 shadow-sm bg-red-50/40 min-w-0 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-red-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-red-800">
                    Extintores Vencidos
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-red-700">
                    {effectiveStats?.expiredCount || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-red-800 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Necessitam recarga imediata
                </CardContent>
              </Card>

              <Card role="button" tabIndex={0} title="Abrir ordens de serviço" onClick={() => setActiveTab("orders")} onKeyDown={(event) => event.key === "Enter" && setActiveTab("orders")} className="cursor-pointer border-l-4 border-l-purple-600 shadow-sm min-w-0 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-purple-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ordens Geradas
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-purple-700">
                    {effectiveStats?.totalOrders || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Prontas para impressão
                </CardContent>
              </Card>
            </div>

            {/* SEÇÃO DE ALERTAS CRÍTICOS (Banner de Aviso com Antecedência) */}
            {((effectiveStats?.nearExpirationCount || 0) > 0 || (effectiveStats?.expiredCount || 0) > 0) && (
              <div className="bg-gradient-to-r from-amber-50 to-red-50 border-2 border-amber-300 rounded-xl p-3 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-amber-500 text-white rounded-lg shadow mt-0.5 shrink-0">
                      <BellRing className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        Atenção aos Prazos de Validade dos Extintores!
                      </h3>
                      <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                        Existem extintores que venceram ou estão a menos de <strong>{offline.alertDays || 30} dias</strong> do vencimento. 
                        Revise os clientes abaixo e agende a recarga/troca.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1 shrink-0"
                    onClick={() => setActiveTab("alerts")}
                  >
                    Ver Lista Completa
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* CLIENTES SEPARADOS POR CIDADE */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-red-600" />
                    Clientes Cadastrados por Região / Cidade
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecione um cliente para gerenciar seus extintores ou emitir uma nova Ordem de Serviço
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Buscar cliente, CNPJ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <Button
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 shrink-0"
                    onClick={() => setIsClientModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Novo Cliente
                  </Button>
                </div>
              </div>

              {/* LISTA DE CLIENTES AGRUPADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="border border-slate-200 hover:border-red-400 transition-all rounded-lg p-4 bg-white shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="bg-slate-100 text-slate-800 font-bold text-[10px] gap-1">
                          <MapPin className="w-3 h-3 text-red-600" />
                          {client.city}
                        </Badge>
                        <span className="text-[11px] font-mono text-slate-500">
                          {client.cnpj || "Sem CNPJ"}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base mt-2 line-clamp-1">
                        {client.companyName}
                      </h3>

                      <div className="text-xs text-slate-600 mt-2 space-y-1">
                        <div className="line-clamp-1">
                          📍 {client.address || "Endereço não informado"}
                        </div>
                        {client.phone && (
                          <div className="font-mono text-slate-700">
                            📞 {client.phone}
                          </div>
                        )}
                        {client.contactName && (
                          <div className="text-slate-700">
                            👤 Resp: <span className="font-semibold">{client.contactName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-slate-700 gap-1 h-8"
                        onClick={() => {
                          setSelectedClientIdForExtinguisher(client.id);
                          setExtinguisherForm(prev => ({ ...prev, clientId: client.id }));
                          setIsExtinguisherModalOpen(true);
                        }}
                      >
                        <Flame className="w-3.5 h-3.5 text-red-600" />
                        + Extintor
                      </Button>

                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs gap-1 h-8"
                        onClick={() => {
                          setReturnToOrderAfterClient(false);
                          setOrderForm(prev => ({
                            ...prev,
                            clientId: client.id,
                            responsibleName: client.contactName || "",
                            responsibleCpf: client.cpf || "",
                            responsibleBirthDate: client.birthDate || "",
                          }));
                          setIsOrderModalOpen(true);
                        }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Criar OS
                      </Button>
                    </div>
                  </div>
                ))}

                {filteredClients.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            ABA: CLIENTES POR CIDADE (Visão Detalhada com Extintores)
        ======================================================== */}
        {activeTab === "clients" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Gerenciamento de Clientes & Extintores
                </h2>
                  <p className="text-xs text-slate-500">
                    {extinguisherFilter === "active" ? "Mostrando os extintores ativos cadastrados por empresa e cidade" : "Visualização detalhada dos extintores instalados por empresa e cidade"}
                  </p>
              </div>

              <Button
                className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
                onClick={() => setIsClientModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Cadastrar Cliente
              </Button>
            </div>

            <div className="space-y-4">
              {filteredClients.map((client) => (
                <ClientDetailCard
                  key={client.id}
                  client={client}
                  extinguisherFilter={extinguisherFilter}
                  onAddExtinguisher={() => {
                    setSelectedClientIdForExtinguisher(client.id);
                    setExtinguisherForm(prev => ({ ...prev, clientId: client.id }));
                    setIsExtinguisherModalOpen(true);
                  }}
                  onCreateOrder={() => {
                    setOrderForm(prev => ({
                      ...prev,
                      clientId: client.id,
                      responsibleName: client.contactName || "",
                      responsibleCpf: client.cpf || "",
                      responsibleBirthDate: client.birthDate || "",
                    }));
                    setIsOrderModalOpen(true);
                  }}
                  onDelete={() => {
                    if (confirm(`Tem certeza que deseja excluir o cliente ${client.companyName}?`)) {
                      deleteClientMutation.mutate({ id: client.id });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            ABA: ALERTAS DE VENCIMENTO (Mensagens com Antecedência)
        ======================================================== */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-amber-500" />
                    Alertas de Vencimento de Extintores{alertFilter === "near" ? " — Próximos do vencimento" : alertFilter === "expired" ? " — Vencidos" : ""}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extintores organizados por urgência. Antecedência configurada para: <strong>{offline.alertDays || 30} dias</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2"><Button variant={alertFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setAlertFilter("all")} className="text-xs">Todos</Button><Button variant="outline" size="sm" onClick={() => setIsSettingsModalOpen(true)} className="gap-1.5 text-xs"><Settings className="w-3.5 h-3.5" /> Ajustar Dias de Antecedência</Button></div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {visibleAlerts.map((item, idx) => {
                  const isExpired = item.alertStatus === "expired";
                  const isUrgent = item.alertStatus === "urgent";

                  return (
                    <div
                      key={idx}
                      className={`py-3.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg transition-colors ${
                        isExpired
                          ? "bg-red-50/60"
                          : isUrgent
                          ? "bg-amber-50/60"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg text-white mt-0.5 ${
                            isExpired
                              ? "bg-red-600"
                              : isUrgent
                              ? "bg-amber-600"
                              : "bg-blue-600"
                          }`}
                        >
                          <Flame className="w-4 h-4" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {item.client.companyName}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-white">
                              {item.client.city}
                            </Badge>
                            {item.client.phone && (
                              <span className="text-xs text-slate-500 font-mono">
                                📞 {item.client.phone}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                              <strong>Modelo:</strong> {item.extinguisher.typeModel} ({item.extinguisher.capacity || "N/I"})
                            </span>
                            {item.extinguisher.locationInBuilding && (
                              <span>
                                <strong>Local:</strong> {item.extinguisher.locationInBuilding}
                              </span>
                            )}
                            {item.extinguisher.serialNumber && (
                              <span className="font-mono">
                                <strong>Selo/Nº:</strong> {item.extinguisher.serialNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                        <div className="text-right">
                          <div
                            className={`text-xs font-black uppercase ${
                              isExpired
                                ? "text-red-700"
                                : isUrgent
                                ? "text-amber-800"
                                : "text-slate-800"
                            }`}
                          >
                            {item.alertMessage}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Vencimento: {new Date(item.extinguisher.expirationDate).toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs gap-1 h-8"
                          onClick={() => {
                            setOrderForm(prev => ({
                              ...prev,
                              clientId: item.client.id,
                              responsibleName: item.client.contactName || "",
                              responsibleCpf: item.client.cpf || "",
                              responsibleBirthDate: item.client.birthDate || "",
                              extinguisherExpiration: new Date(item.extinguisher.expirationDate).toLocaleDateString("pt-BR"),
                              items: [
                                {
                                  description: `Recarga / Manutenção Extintor ${item.extinguisher.typeModel}`,
                                  quantity: 1,
                                  unitPrice: "45.00",
                                  totalPrice: "45.00",
                                },
                              ],
                            }));
                            setIsOrderModalOpen(true);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Gerar OS
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {visibleAlerts.length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    {alertFilter === "expired" ? "Nenhum extintor vencido encontrado." : alertFilter === "near" ? "Nenhum extintor próximo do vencimento encontrado." : "Parabéns! Todos os extintores estão dentro da validade e sem alertas pendentes."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            ABA: ORDENS DE SERVIÇO (Listagem e Impressão)
        ======================================================== */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="break-words text-xl font-bold text-slate-900">
                  Ordens de Serviço Emitidas
                </h2>
                <p className="text-xs text-slate-500">
                  Documentos prontos para impressão e PDF no formato profissional da empresa
                </p>
              </div>

              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 font-semibold shadow sm:w-auto"
                onClick={() => {
                  if (effectiveClients && effectiveClients.length > 0) {
                    setOrderForm(prev => ({ ...prev, clientId: effectiveClients[0].id }));
                  }
                  setIsOrderModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Nova Ordem de Serviço
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="divide-y divide-slate-100 md:hidden">
                {(effectiveOrders || []).map(({ order, client }) => (
                  <article key={order.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-slate-900">#{String(order.orderNumber).padStart(5, "0")}</p>
                        <p className="mt-1 break-words font-semibold text-slate-900">{client.companyName}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{client.city}</Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div><dt className="text-slate-400">Data</dt><dd className="font-medium text-slate-700">{new Date(order.orderDate).toLocaleDateString("pt-BR")}</dd></div>
                      <div><dt className="text-slate-400">Pagamento</dt><dd className="break-words font-medium text-slate-700">{order.paymentMethod}</dd></div>
                      <div><dt className="text-slate-400">Valor total</dt><dd className="font-mono font-bold text-slate-900">R$ {Number(order.totalAmount).toFixed(2)}</dd></div>
                    </dl>
                    <div className="flex flex-col gap-2 pt-1 min-[420px]:flex-row">
                      <Button variant="outline" size="sm" className="h-9 w-full gap-1 text-xs font-semibold text-slate-800 hover:text-red-700 min-[420px]:flex-1" onClick={() => setViewingOrderId(order.id)}><Printer className="h-3.5 w-3.5 text-red-600" /> Visualizar / Imprimir</Button>
                      <Button variant="ghost" size="sm" className="h-9 w-full text-slate-400 hover:text-red-600 min-[420px]:w-9" aria-label={`Excluir OS ${order.orderNumber}`} onClick={() => { if (confirm(`Excluir a OS #${order.orderNumber}?`)) deleteOrderMutation.mutate({ id: order.id }); }}><Trash2 className="h-3.5 w-3.5" /><span className="min-[420px]:sr-only">Excluir</span></Button>
                    </div>
                  </article>
                ))}
                {(effectiveOrders || []).length === 0 && <div className="p-8 text-center text-slate-400">Nenhuma ordem de serviço cadastrada ainda.</div>}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                    <th className="p-3">Nº OS</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Cliente / Empresa</th>
                    <th className="p-3">Cidade</th>
                    <th className="p-3">Forma Pagto</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(effectiveOrders || []).map(({ order, client }) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        #{String(order.orderNumber).padStart(5, '0')}
                      </td>
                      <td className="p-3 text-slate-600">
                        {new Date(order.orderDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {client.companyName}
                      </td>
                      <td className="p-3 text-slate-600">
                        <Badge variant="outline" className="text-[10px]">
                          {client.city}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {order.paymentMethod}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        R$ {Number(order.totalAmount).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 font-semibold text-slate-800 hover:text-red-700"
                            onClick={() => setViewingOrderId(order.id)}
                          >
                            <Printer className="w-3.5 h-3.5 text-red-600" />
                            Visualizar / Imprimir
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            onClick={() => {
                              if (confirm(`Excluir a OS #${order.orderNumber}?`)) {
                                deleteOrderMutation.mutate({ id: order.id });
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {(effectiveOrders || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Nenhuma ordem de serviço cadastrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL: CADASTRAR NOVO CLIENTE
      ======================================================== */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Cadastrar Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            {user?.role === "platform_admin" && (
              <div>
                <label className="font-bold block mb-1">Empresa do sistema / área de acesso *</label>
                <Select value={selectedCompanyId ? String(selectedCompanyId) : ""} onValueChange={(value) => setSelectedCompanyId(Number(value))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione a empresa do sistema" /></SelectTrigger>
                  <SelectContent>
                    {(companiesQuery.data ?? []).filter((company) => company.active).map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-slate-500">Define em qual área de membros este cliente será salvo. Não é o cliente atendido.</p>
                {!companiesQuery.data?.some((company) => company.active) && <p className="mt-1 text-red-600">Cadastre uma empresa antes de adicionar clientes.</p>}
              </div>
            )}
            <div>
              <label className="font-bold block mb-1">Nome do cliente / Razão Social *</label>
              <Input
                placeholder="Ex: Mercado Central Ltda (cliente)"
                value={clientForm.companyName}
                onChange={(e) => setClientForm({ ...clientForm, companyName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">Cidade *</label>
                <Input
                  placeholder="Ex: Sapiranga"
                  value={clientForm.city}
                  onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">CNPJ</label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={clientForm.cnpj}
                  onChange={(e) => setClientForm({ ...clientForm, cnpj: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Endereço Completo</label>
              <Input
                placeholder="Rua, Número, Bairro"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">CEP</label>
                <Input
                  placeholder="93821-000"
                  value={clientForm.cep}
                  onChange={(e) => setClientForm({ ...clientForm, cep: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Telefone / WhatsApp</label>
                <Input
                  placeholder="(51) 99999-9999"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Nome do Proprietário / Responsável</label>
              <Input
                placeholder="Nome completo"
                value={clientForm.contactName}
                onChange={(e) => setClientForm({ ...clientForm, contactName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">CPF do Responsável</label>
                <Input
                  placeholder="000.000.000-00"
                  value={clientForm.cpf}
                  onChange={(e) => setClientForm({ ...clientForm, cpf: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Data de Nascimento</label>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={clientForm.birthDate}
                  onChange={(e) => setClientForm({ ...clientForm, birthDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClientModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => {
                if (!clientForm.companyName || !clientForm.city) {
                  toast.error("Preencha o nome da empresa e a cidade!");
                  return;
                }
                if (user?.role === "platform_admin") {
                  if (!selectedCompanyId) {
                    toast.error("Selecione a empresa responsável pelo cliente.");
                    return;
                  }
                  platformCreateClientMutation.mutate({ ...clientForm, companyId: selectedCompanyId });
                } else {
                  createClientMutation.mutate(clientForm);
                }
              }}
            >
              Salvar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL: ADICIONAR EXTINTOR AO CLIENTE
      ======================================================== */}
      <Dialog open={isExtinguisherModalOpen} onOpenChange={setIsExtinguisherModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Cadastrar Extintor</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold block mb-1">Cliente Vinculado</label>
              <Select
                value={extinguisherForm.clientId ? String(extinguisherForm.clientId) : ""}
                onValueChange={(val) => setExtinguisherForm({ ...extinguisherForm, clientId: Number(val) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(effectiveClients || []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyName} ({c.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">Modelo do Extintor *</label>
                <Select
                  value={extinguisherForm.typeModel}
                  onValueChange={(val) => setExtinguisherForm({ ...extinguisherForm, typeModel: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PQS ABC 4kg">PQS ABC 4kg</SelectItem>
                    <SelectItem value="PQS ABC 6kg">PQS ABC 6kg</SelectItem>
                    <SelectItem value="PQS BC 4kg">PQS BC 4kg</SelectItem>
                    <SelectItem value="PQS BC 6kg">PQS BC 6kg</SelectItem>
                    <SelectItem value="AP 10L (Água)">AP 10L (Água)</SelectItem>
                    <SelectItem value="CO2 6kg">CO2 6kg</SelectItem>
                    <SelectItem value="CO2 4kg">CO2 4kg</SelectItem>
                    <SelectItem value="Carreta PQS 20kg">Carreta PQS 20kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold block mb-1">Capacidade</label>
                <Input
                  placeholder="Ex: 4kg, 6kg, 10L"
                  value={extinguisherForm.capacity}
                  onChange={(e) => setExtinguisherForm({ ...extinguisherForm, capacity: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">Data de Vencimento *</label>
                <Input
                  type="date"
                  value={extinguisherForm.expirationDate}
                  onChange={(e) => setExtinguisherForm({ ...extinguisherForm, expirationDate: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Data da Última Recarga</label>
                <Input
                  type="date"
                  value={extinguisherForm.lastInspectionDate}
                  onChange={(e) => setExtinguisherForm({ ...extinguisherForm, lastInspectionDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Localização no Imóvel</label>
              <Input
                placeholder="Ex: Entrada Principal, Cozinha, Corredor 2º Andar"
                value={extinguisherForm.locationInBuilding}
                onChange={(e) => setExtinguisherForm({ ...extinguisherForm, locationInBuilding: e.target.value })}
              />
            </div>

            <div>
              <label className="font-bold block mb-1">Nº Cilindro / Selo Inmetro</label>
              <Input
                placeholder="Ex: 006065/2023"
                value={extinguisherForm.serialNumber}
                onChange={(e) => setExtinguisherForm({ ...extinguisherForm, serialNumber: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtinguisherModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => {
                if (!extinguisherForm.clientId) {
                  toast.error("Selecione o cliente!");
                  return;
                }
                if (!extinguisherForm.expirationDate) {
                  toast.error("Informe a data de vencimento!");
                  return;
                }
                createExtinguisherMutation.mutate(extinguisherForm);
              }}
            >
              Salvar Extintor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL: CRIAR ORDEM DE SERVIÇO COMPLETA
      ======================================================== */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              Criar Ordem de Serviço
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* CABEÇALHO DA OS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2"><label className="font-bold">Cliente *</label><Button type="button" variant="link" className="h-auto p-0 text-[11px] font-bold text-red-600" onClick={() => { setReturnToOrderAfterClient(true); setIsOrderModalOpen(false); setIsClientModalOpen(true); }}><Plus className="mr-1 h-3 w-3" /> Cadastrar cliente</Button></div>
                <div className="flex flex-col gap-2 sm:flex-row"><Select
                  value={orderForm.clientId ? String(orderForm.clientId) : ""}
                  onValueChange={(val) => {
                    const cId = Number(val);
                    const selected = (effectiveClients || []).find(c => c.id === cId);
                    setOrderForm({
                      ...orderForm,
                      clientId: cId,
                      responsibleName: selected?.contactName || "",
                      responsibleCpf: selected?.cpf || "",
                      responsibleBirthDate: selected?.birthDate || "",
                    });
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione um cliente já cadastrado" /></SelectTrigger>
                  <SelectContent>{(effectiveClients || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName} ({c.city})</SelectItem>)}</SelectContent>
                </Select></div>
                {(!effectiveClients || effectiveClients.length === 0) && <p className="mt-1 text-[11px] text-amber-700">Nenhum cliente cadastrado. Clique em “Cadastrar cliente” para continuar.</p>}
              </div>

              <div>
                <label className="font-bold block mb-1">Data da OS *</label>
                <Input
                  type="date"
                  value={orderForm.orderDate}
                  onChange={(e) => setOrderForm({ ...orderForm, orderDate: e.target.value })}
                />
              </div>
            </div>

            {/* TABELA DE SERVIÇOS PRESTADOS */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <div className="bg-slate-200 font-bold px-3 py-1.5 flex justify-between items-center text-slate-800">
                <span>SERVIÇOS PRESTADOS (ITENS DA ORDEM)</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={addItemRow}>
                  <Plus className="w-3 h-3" /> Adicionar Linha
                </Button>
              </div>

              <div className="border-b border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                Preencha uma linha para cada serviço ou grupo de extintores. <strong>Quantidade</strong> é o número de unidades, <strong>valor unitário</strong> é o preço de cada unidade e o <strong>total</strong> é calculado automaticamente.
              </div>
              <div className="hidden grid-cols-[minmax(0,1fr)_70px_110px_110px_32px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                <span>Descrição do serviço / modelo</span><span className="text-center">Qtd.</span><span className="text-right">Valor unitário</span><span className="text-right">Total calculado</span><span />
              </div>
              <div className="space-y-3 p-3">
                {orderForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_70px_110px_110px_32px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
                    <label className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Descrição do serviço ou modelo do extintor</label>
                    <Input
                      placeholder="Ex.: Recarga de Extintor PQS ABC 4kg"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      className="text-xs"
                    />
                    <label className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Quantidade de unidades</label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Ex.: 1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                      className="text-xs sm:text-center"
                    />
                    <label className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Preço de cada unidade (R$)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex.: 45,00"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                      className="text-xs sm:text-right"
                    />
                    <div className="flex items-center justify-between rounded-md border border-dashed border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-900 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Total desta linha</span><span className="font-mono">R$ {item.totalPrice}</span>
                    </div>
                    {orderForm.items.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-full p-0 text-red-500 hover:text-red-700 sm:w-8"
                        onClick={() => removeItemRow(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CAMPOS ESPECÍFICOS DA FICHA ORIGINAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="font-bold block mb-1">Trocado e Entregue?</label>
                <Select
                  value={orderForm.replacedAndDelivered}
                  onValueChange={(val) => setOrderForm({ ...orderForm, replacedAndDelivered: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIM">SIM</SelectItem>
                    <SelectItem value="NÃO">NÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold block mb-1">Deixou Reserva?</label>
                <div className="flex gap-2">
                  <Select
                    value={orderForm.leftReserve}
                    onValueChange={(val) => setOrderForm({ ...orderForm, leftReserve: val })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIM">SIM</SelectItem>
                      <SelectItem value="NÃO">NÃO</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Quais modelos deixados?"
                    value={orderForm.reserveDetails}
                    onChange={(e) => setOrderForm({ ...orderForm, reserveDetails: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Vencimento do Extintor</label>
                <Input
                  placeholder="Ex: 09/2027"
                  value={orderForm.extinguisherExpiration}
                  onChange={(e) => setOrderForm({ ...orderForm, extinguisherExpiration: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Vencimento do Alvará</label>
                <Input
                  placeholder="Ex: 12/2026"
                  value={orderForm.licenseExpiration}
                  onChange={(e) => setOrderForm({ ...orderForm, licenseExpiration: e.target.value })}
                />
              </div>
            </div>

            {/* FORMA DE PAGAMENTO */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800">PAGAMENTO</span>
                <span className="text-base font-black text-slate-900 bg-amber-300 px-2 py-0.5 rounded">
                  Total: R$ {calculatedTotalOrder}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="font-bold block mb-1">Forma de Pagamento</label>
                  <Select
                    value={orderForm.paymentMethod}
                    onValueChange={(val) => setOrderForm({ ...orderForm, paymentMethod: val, ...(val === "A VISTA" || val === "PIX" ? { installmentsCount: 1, installmentDates: "" } : {}) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A VISTA">À VISTA</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="CREDITO">CRÉDITO</SelectItem>
                      <SelectItem value="PARCELADO">PARCELADO</SelectItem>
                      <SelectItem value="BOLETO">BOLETO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(["CREDITO", "PARCELADO", "BOLETO"] as string[]).includes(orderForm.paymentMethod) && <>
                  <div>
                    <label className="font-bold block mb-1">Nº Parcelas</label>
                    <Input
                      type="number"
                      min={1}
                      value={orderForm.installmentsCount}
                      onChange={(e) => setOrderForm({ ...orderForm, installmentsCount: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="font-bold block mb-1">Datas das Parcelas</label>
                    <Input
                      placeholder="Ex: 10/10, 10/11"
                      value={orderForm.installmentDates}
                      onChange={(e) => setOrderForm({ ...orderForm, installmentDates: e.target.value })}
                    />
                  </div>
                </>}
              </div>
            </div>

            {/* DADOS DO RESPONSÁVEL */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="font-bold block mb-1">Nome Responsável</label>
                <Input
                  value={orderForm.responsibleName}
                  onChange={(e) => setOrderForm({ ...orderForm, responsibleName: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">CPF Responsável</label>
                <Input
                  value={orderForm.responsibleCpf}
                  onChange={(e) => setOrderForm({ ...orderForm, responsibleCpf: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Data Nasc.</label>
                <Input
                  value={orderForm.responsibleBirthDate}
                  onChange={(e) => setOrderForm({ ...orderForm, responsibleBirthDate: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="mb-1 block font-bold">Observações da Ordem de Serviço</label>
              <Textarea
                rows={4}
                placeholder="Descreva informações adicionais, recomendações ou pendências desta OS."
                value={orderForm.observations}
                onChange={(e) => setOrderForm({ ...orderForm, observations: e.target.value })}
                className="min-h-[96px] resize-y bg-white"
              />
              <p className="mt-1 text-xs text-slate-500">Esse texto será exibido no documento e no PDF da ordem.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5"
              onClick={() => {
                if (!orderForm.clientId) {
                  toast.error("Selecione o cliente!");
                  return;
                }
                createOrderMutation.mutate({
                  ...orderForm,
                  totalAmount: calculatedTotalOrder,
                });
              }}
            >
              <Printer className="w-4 h-4" />
              Salvar & Visualizar Impressão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL: CONFIGURAR ANTECEDÊNCIA DOS ALERTAS
      ======================================================== */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-600" />
              Configurar Alerta de Validade
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs space-y-2">
            <p className="text-slate-600">
              Defina quantos dias de antecedência você deseja receber o alerta antes do extintor vencer:
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={configDays}
                onChange={(e) => setConfigDays(Number(e.target.value))}
                className="w-24 text-center font-bold text-sm"
              />
              <span className="font-bold text-slate-700">dias antes</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Exemplo: 30 dias significa que qualquer extintor que for vencer dentro de 1 mês será destacado em amarelo ou vermelho.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)}>
              Fechar
            </Button>
            <Button
              className="bg-slate-900 text-white"
              onClick={() => {
                setAlertDaysMutation.mutate({ days: configDays });
              }}
            >
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

/* ========================================================
   COMPONENTE DO CLIENTE COM LISTAGEM DOS EXTINTORES
======================================================== */
function ClientDetailCard({
  client,
  extinguisherFilter = "all",
  onAddExtinguisher,
  onCreateOrder,
  onDelete,
}: {
  client: any;
  extinguisherFilter?: "all" | "active";
  onAddExtinguisher: () => void;
  onCreateOrder: () => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const tenantKey = user && user.id < 0 ? String(Math.abs(user.id)) : null;
  const extinguishersQuery = trpc.extinguishers.listByClient.useQuery({ clientId: client.id }, { enabled: Boolean(tenantKey) });
  const isOnline = useOnlineStatus();
  const localExtinguishers = useLiveQuery(() => tenantKey ? offlineDb.extinguishers.where("tenantKey").equals(tenantKey).filter((row) => row.clientId === client.id).toArray() : Promise.resolve([] as any[]), [tenantKey, client.id], [] as any[]);
  const extinguisherRows = isOnline && extinguishersQuery.data ? extinguishersQuery.data : localExtinguishers;
  const visibleExtinguishers = (extinguisherRows || []).filter((ext) => {
    if (extinguisherFilter === "all") return true;
    const expiration = new Date(ext.expirationDate);
    expiration.setHours(0, 0, 0, 0);
    return expiration >= new Date(new Date().setHours(0, 0, 0, 0));
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900">
              {client.companyName}
            </h3>
            <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 font-bold text-[10px] gap-1">
              <MapPin className="w-3 h-3 text-red-600" />
              {client.city}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span><strong>CNPJ:</strong> {client.cnpj || "—"}</span>
            <span><strong>Endereço:</strong> {client.address || "—"}</span>
            <span><strong>Fone:</strong> {client.phone || "—"}</span>
            <span><strong>Responsável:</strong> {client.contactName || "—"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1"
            onClick={onAddExtinguisher}
          >
            <Flame className="w-3.5 h-3.5 text-red-600" />
            + Extintor
          </Button>

          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-8 gap-1"
            onClick={onCreateOrder}
          >
            <FileText className="w-3.5 h-3.5" />
            Gerar OS
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* EXTINTORES INSTALADOS */}
      <div>
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Extintores no Estabelecimento ({visibleExtinguishers.length})</span>
        </div>

        {visibleExtinguishers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {visibleExtinguishers.map((ext) => {
              const expDate = new Date(ext.expirationDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isExpired = expDate < today;
              const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isWarning = daysLeft >= 0 && daysLeft <= 30;

              return (
                <div
                  key={ext.id}
                  className={`p-2.5 rounded-lg border text-xs flex justify-between items-start ${
                    isExpired
                      ? "bg-red-50 border-red-200"
                      : isWarning
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {ext.typeModel} ({ext.capacity || "N/I"})
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">
                      📍 {ext.locationInBuilding || "Local não especificado"}
                    </div>
                    {ext.serialNumber && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        Selo: {ext.serialNumber}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-black text-[11px] ${
                        isExpired
                          ? "text-red-700"
                          : isWarning
                          ? "text-amber-800"
                          : "text-slate-700"
                      }`}
                    >
                      {isExpired ? "VENCIDO" : isWarning ? `Vence em ${daysLeft}d` : "Válido"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {expDate.toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400">
            {extinguisherFilter === "active" ? "Nenhum extintor ativo encontrado para este cliente." : 'Nenhum extintor cadastrado para este cliente ainda. Clique em "+ Extintor" para adicionar.'}
          </div>
        )}
      </div>
    </div>
  );
}
