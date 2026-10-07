import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PublicExtinguisherPage from "./pages/PublicExtinguisherPage";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PrintOrderPage from "./pages/PrintOrderPage";
import LandingPage from "./pages/LandingPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminAssinaturasPage from "./pages/AdminAssinaturasPage";
import PlansPage from "./pages/PlansPage";
import PublicPlansPage from "./pages/PublicPlansPage";
import SignupPage from "./pages/SignupPage";
import UpgradePlanPage from "./pages/UpgradePlanPage";
import MySubscriptionPage from "./pages/MySubscriptionPage";
import PaymentHistoryPage from "./pages/PaymentHistoryPage";
import BackupPage from "./pages/BackupPage";
import SyncStatusPage from "./pages/SyncStatusPage";
import AuditPage from "./pages/AuditPage";
import { PwaStatusBar } from "./components/PwaStatusBar";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function RedirectHome() { if (typeof window !== "undefined") window.location.replace("/"); return <LoadingScreen />; }

function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-7 w-7 animate-spin text-red-500" /></div>; }

function CommercialProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role === "platform_admin" || !user.companyId) return <RedirectHome />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <RedirectHome />;
  return <>{children}</>;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <LandingPage />;
  return <Home />;
}

function Router() {
  return (
    <Switch>
      {/* Rotas públicas de conversão (React). A landing marketing é HTML estático em /landing-site.html */}
      <Route path="/login"><RedirectHome /></Route>
      <Route path="/cadastro" component={SignupPage} />
      <Route path="/planos" component={PublicPlansPage} />
      {/* QR operacional da empresa (dados de gestão — distinto do selo Inmetro) */}
      <Route path="/e/:token" component={PublicExtinguisherPage} />
      {/* Raiz: visitante → landing estática; autenticado → painel modular (pages/home) */}
      <Route path="/"><RootRoute /></Route>
      <Route path="/admin/usuarios"><AdminProtected><AdminUsersPage /></AdminProtected></Route>
      <Route path="/admin/assinaturas"><AdminProtected><AdminAssinaturasPage /></AdminProtected></Route>
      <Route path="/conta/planos"><PlansPage /></Route>
      <Route path="/upgrade"><UpgradePlanPage /></Route>
      <Route path="/minha-assinatura"><MySubscriptionPage /></Route>
      <Route path="/pagamentos"><PaymentHistoryPage /></Route>
      <Route path="/backup"><CommercialProtected><BackupPage /></CommercialProtected></Route>
      <Route path="/auditoria"><CommercialProtected><AuditPage /></CommercialProtected></Route>
      <Route path="/sync-status"><CommercialProtected><SyncStatusPage /></CommercialProtected></Route>
      <Route path="/os/:id"><CommercialProtected><PrintOrderPage /></CommercialProtected></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PwaStatusBar />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
