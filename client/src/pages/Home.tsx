import React, { useState, useMemo } from "react";
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
  ShieldCheck,
  ChevronRight,
  Users,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ServiceOrderDocument } from "@/components/ServiceOrderDocument";
import { toast } from "sonner";

export default function Home() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"dashboard" | "clients" | "extinguishers" | "orders" | "alerts">("dashboard");
  const [selectedCity, setSelectedCity] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Visualização e Impressão de OS
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null);

  // Modais de Criação
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isExtinguisherModalOpen, setIsExtinguisherModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Seleções para sub-ações
  const [selectedClientIdForExtinguisher, setSelectedClientIdForExtinguisher] = useState<number | null>(null);

  // Queries
  const statsQuery = trpc.dashboard.stats.useQuery();
  const citiesQuery = trpc.clients.cities.useQuery();
  const clientsQuery = trpc.clients.list.useQuery({ 
    city: selectedCity === "TODAS" ? undefined : selectedCity 
  });
  const alertsQuery = trpc.extinguishers.alerts.useQuery();
  const ordersQuery = trpc.orders.list.useQuery();
  const alertDaysQuery = trpc.settings.getAlertDays.useQuery();
  const orderDetailsQuery = trpc.orders.byId.useQuery(
    { id: viewingOrderId! },
    { enabled: !!viewingOrderId }
  );

  // Mutations
  const utils = trpc.useUtils();

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      setIsClientModalOpen(false);
      utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteClientMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente excluído!");
      utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
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
    onError: (err) => toast.error(err.message),
  });

  const deleteExtinguisherMutation = trpc.extinguishers.delete.useMutation({
    onSuccess: () => {
      toast.success("Extintor removido!");
      utils.extinguishers.invalidate();
      utils.dashboard.stats.invalidate();
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
    onError: (err) => toast.error(err.message),
  });

  const deleteOrderMutation = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("Ordem de serviço excluída!");
      utils.orders.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });

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

  // Se estiver visualizando a OS para impressão
  if (viewingOrderId && orderDetailsQuery.data) {
    return (
      <ServiceOrderDocument
        order={orderDetailsQuery.data}
        client={orderDetailsQuery.data.client}
        items={orderDetailsQuery.data.items}
        onBack={() => setViewingOrderId(null)}
      />
    );
  }

  // Filtragem dos clientes
  const filteredClients = (clientsQuery.data || []).filter(c => {
    const matchSearch = searchQuery === "" || 
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.cnpj && c.cnpj.includes(searchQuery)) ||
      (c.contactName && c.contactName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* CABEÇALHO PRINCIPAL */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:h-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
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
            {user?.role === "admin" && (
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
            {/* Botão Configurar Dias de Alerta — somente administrador */}
            {user?.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                className="text-slate-200 border-slate-700 hover:bg-slate-800 gap-1.5"
                onClick={() => {
                  setConfigDays(alertDaysQuery.data || 30);
                  setIsSettingsModalOpen(true);
                }}
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="hidden md:inline">Antecedência Alertas:</span>
                <span className="font-bold text-amber-400">{alertDaysQuery.data || 30} dias</span>
              </Button>
            )}

            {/* Criar Ordem de Serviço Rápida */}
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5 shadow"
              onClick={() => {
                if (clientsQuery.data && clientsQuery.data.length > 0) {
                  setOrderForm(prev => ({ ...prev, clientId: clientsQuery.data[0].id }));
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

      {/* SUB-MENU DE NAVEGAÇÃO */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2 py-2.5">
          <div className="flex gap-1 sm:gap-4 overflow-x-auto pb-1 -mx-1 px-1">
            <Button
              variant={activeTab === "dashboard" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("dashboard")}
              className={`gap-2 ${activeTab === "dashboard" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              <Building2 className="w-4 h-4" />
              <span className="sm:hidden">Início</span>
              <span className="hidden sm:inline">Visão Geral</span>
            </Button>

            <Button
              variant={activeTab === "clients" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("clients")}
              className={`gap-2 ${activeTab === "clients" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              <MapPin className="w-4 h-4" />
              <span className="sm:hidden">Cidades</span>
              <span className="hidden sm:inline">Clientes por Cidade</span>
            </Button>

            <Button
              variant={activeTab === "alerts" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("alerts")}
              className={`gap-2 relative ${activeTab === "alerts" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              <BellRing className="w-4 h-4 text-amber-500" />
              <span className="sm:hidden">Alertas</span>
              <span className="hidden sm:inline">Alertas de Vencimento</span>
              {(statsQuery.data?.nearExpirationCount || 0) + (statsQuery.data?.expiredCount || 0) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-600 text-white font-bold rounded-full">
                  {(statsQuery.data?.nearExpirationCount || 0) + (statsQuery.data?.expiredCount || 0)}
                </span>
              )}
            </Button>

            <Button
              variant={activeTab === "orders" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("orders")}
              className={`gap-2 ${activeTab === "orders" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              <FileText className="w-4 h-4" />
              <span className="sm:hidden">OS</span>
              <span className="hidden sm:inline">Ordens de Serviço</span>
            </Button>
          </div>

          {/* Seletor de Cidade Global */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Filtrar Cidade:</span>
            <Select value={selectedCity} onValueChange={(val) => setSelectedCity(val)}>
              <SelectTrigger className="w-full lg:w-[160px] h-8 text-xs bg-slate-50">
                <SelectValue placeholder="Todas as cidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as Cidades</SelectItem>
                {(citiesQuery.data || []).map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* ========================================================
            ABA: DASHBOARD GERAL
        ======================================================== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card className="border-l-4 border-l-blue-600 shadow-sm min-w-0">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Clientes
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-slate-900">
                    {statsQuery.data?.totalClients || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Em {statsQuery.data?.totalCities || 0} cidades
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-emerald-600 shadow-sm min-w-0">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Extintores Ativos
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-emerald-700">
                    {statsQuery.data?.totalExtinguishers || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Cadastrados na base
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/40 min-w-0">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Perto da Validade
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-amber-700">
                    {statsQuery.data?.nearExpirationCount || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-amber-800 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Vencem em até {alertDaysQuery.data || 30} dias
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-600 shadow-sm bg-red-50/40 min-w-0">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-red-800">
                    Extintores Vencidos
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-red-700">
                    {statsQuery.data?.expiredCount || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-red-800 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Necessitam recarga imediata
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-600 shadow-sm min-w-0">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ordens Geradas
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black text-purple-700">
                    {statsQuery.data?.totalOrders || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Prontas para impressão
                </CardContent>
              </Card>
            </div>

            {/* SEÇÃO DE ALERTAS CRÍTICOS (Banner de Aviso com Antecedência) */}
            {((statsQuery.data?.nearExpirationCount || 0) > 0 || (statsQuery.data?.expiredCount || 0) > 0) && (
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
                        Existem extintores que venceram ou estão a menos de <strong>{alertDaysQuery.data || 30} dias</strong> do vencimento. 
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
                  Visualização detalhada dos extintores instalados por empresa e cidade
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
                    Alertas de Vencimento de Extintores
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extintores organizados por urgência. Antecedência configurada para: <strong>{alertDaysQuery.data || 30} dias</strong>
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Ajustar Dias de Antecedência
                </Button>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {(alertsQuery.data || []).map((item, idx) => {
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

                {(alertsQuery.data || []).length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    Parabéns! Todos os extintores estão dentro da validade e sem alertas pendentes.
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
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Ordens de Serviço Emitidas
                </h2>
                <p className="text-xs text-slate-500">
                  Documentos prontos para impressão e PDF no formato profissional da empresa
                </p>
              </div>

              <Button
                className="bg-red-600 hover:bg-red-700 text-white gap-2 font-semibold shadow"
                onClick={() => {
                  if (clientsQuery.data && clientsQuery.data.length > 0) {
                    setOrderForm(prev => ({ ...prev, clientId: clientsQuery.data[0].id }));
                  }
                  setIsOrderModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Nova Ordem de Serviço
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
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
                  {(ordersQuery.data || []).map(({ order, client }) => (
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

                  {(ordersQuery.data || []).length === 0 && (
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
            <div>
              <label className="font-bold block mb-1">Empresa / Razão Social *</label>
              <Input
                placeholder="Ex: Mercado Central Ltda"
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
                createClientMutation.mutate(clientForm);
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
                  {(clientsQuery.data || []).map((c) => (
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
                <label className="font-bold block mb-1">Cliente *</label>
                <Select
                  value={orderForm.clientId ? String(orderForm.clientId) : ""}
                  onValueChange={(val) => {
                    const cId = Number(val);
                    const selected = (clientsQuery.data || []).find(c => c.id === cId);
                    setOrderForm({
                      ...orderForm,
                      clientId: cId,
                      responsibleName: selected?.contactName || "",
                      responsibleCpf: selected?.cpf || "",
                      responsibleBirthDate: selected?.birthDate || "",
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientsQuery.data || []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.companyName} ({c.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="p-2 space-y-2">
                {orderForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="Descrição do serviço / extintor"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      className="flex-1 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                      className="w-16 text-center text-xs"
                    />
                    <Input
                      placeholder="Valor Unit (R$)"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                      className="w-24 text-right text-xs"
                    />
                    <div className="w-24 text-right font-mono font-bold text-slate-900 pr-2">
                      R$ {item.totalPrice}
                    </div>
                    {orderForm.items.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
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
                    onValueChange={(val) => setOrderForm({ ...orderForm, paymentMethod: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A VISTA">À VISTA</SelectItem>
                      <SelectItem value="PARCELADO">PARCELADO</SelectItem>
                      <SelectItem value="BOLETO">BOLETO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
  );
}

/* ========================================================
   COMPONENTE DO CLIENTE COM LISTAGEM DOS EXTINTORES
======================================================== */
function ClientDetailCard({
  client,
  onAddExtinguisher,
  onCreateOrder,
  onDelete,
}: {
  client: any;
  onAddExtinguisher: () => void;
  onCreateOrder: () => void;
  onDelete: () => void;
}) {
  const extinguishersQuery = trpc.extinguishers.listByClient.useQuery({ clientId: client.id });

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
          <span>Extintores no Estabelecimento ({extinguishersQuery.data?.length || 0})</span>
        </div>

        {extinguishersQuery.data && extinguishersQuery.data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {extinguishersQuery.data.map((ext) => {
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
            Nenhum extintor cadastrado para este cliente ainda. Clique em "+ Extintor" para adicionar.
          </div>
        )}
      </div>
    </div>
  );
}
