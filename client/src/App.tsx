import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PrintOrderPage from "./pages/PrintOrderPage";
import LoginPage from "./pages/LoginPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import BackupPage from "./pages/BackupPage";
import { PwaStatusBar } from "./components/PwaStatusBar";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-7 w-7 animate-spin text-red-500" /></div>; }

function CommercialProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role === "oauth_user" || user.role === "platform_admin" || !user.companyId) return <LoginPage />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role === "oauth_user") return <LoginPage />;
  return <>{children}</>;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role === "oauth_user") return <LoginPage />;
  return <Home />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/"><RootRoute /></Route>
      <Route path="/admin/usuarios"><AdminProtected><AdminUsersPage /></AdminProtected></Route>
      <Route path="/backup"><CommercialProtected><BackupPage /></CommercialProtected></Route>
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
