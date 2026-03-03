import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Theme } from "@radix-ui/themes";
import StrategyFlow from "./pages/StrategyFlow";
import ExecutionDetails from "./pages/ExecutionDetails";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ExecutionHistory from "./pages/ExecutionHistory";
import Credentials from "./pages/Credentials";
import AgentConfig from "./pages/AgentConfig";
import Settings from "./pages/Settings";
import Portfolio from "./pages/Portfolio";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppNavBar } from "./components/AppNavBar";
import { useAuthStore } from "./stores/authStore";
import { useOnboardingStore } from "./stores/onboardingStore";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuthStore();
  const { hasCompletedOnboarding } = useOnboardingStore();

  return (
    <Routes>
      {/* Onboarding — shown after auth but before the main app */}
      <Route
        path="/onboarding"
        element={
          isAuthenticated && hasCompletedOnboarding
            ? <Navigate to="/dashboard" replace />
            : isAuthenticated
              ? <Onboarding />
              : <Navigate to="/login" replace />
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          isAuthenticated
            ? hasCompletedOnboarding
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/onboarding" replace />
            : <Login />
        }
      />

      {/* All protected routes — redirect to onboarding if not completed */}
      <Route element={<><AppNavBar /><ProtectedRoute /></>}>
        <Route path="/" element={<StrategyFlow />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/executions" element={<ExecutionHistory />} />
        <Route path="/execution/:id" element={<ExecutionDetails />} />
        <Route path="/credentials" element={<Credentials />} />
        <Route path="/agent" element={<AgentConfig />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/portfolio" element={<Portfolio />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <Theme appearance="dark" accentColor="purple" grayColor="slate" radius="small" scaling="90%">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProtectedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Theme>
);

export default App;