import { useState, useEffect } from "react";
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
import AgentConfig from "./pages/AgentConfig";
import Research from "./pages/Research";
import Settings from "./pages/Settings";
import Portfolio from "./pages/Portfolio";
import News from "./pages/News";
import Terminal from "./pages/Terminal";
import TerminalRmap from "./pages/TerminalRmap";
import TerminalBmap from "./pages/TerminalBmap";
import TerminalSplc from "./pages/TerminalSplc";
import TerminalHds from "./pages/TerminalHds";
import AiChat from "./pages/AiChat";
import Agents from "./pages/Agents";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppNavBar } from "./components/AppNavBar";
import { useAuthStore } from "./stores/authStore";
import { useOnboardingStore } from "./stores/onboardingStore";

const queryClient = new QueryClient();

/* -------------------------------------------------------------------------- */
/*  Boot splash — shown while Zustand hydrates persisted state from storage   */
/* -------------------------------------------------------------------------- */
const BootSplash = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0a0a0f',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 48,
          height: 48,
          margin: '0 auto 20px',
          border: '3px solid rgba(139,92,246,0.15)',
          borderTopColor: '#7c3aed',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Loading…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Routes                                                                     */
/* -------------------------------------------------------------------------- */
const AppRoutes = () => {
  const { isAuthenticated } = useAuthStore();
  const { hasCompletedOnboarding } = useOnboardingStore();

  /* Wait one tick so Zustand can hydrate from localStorage */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Both stores use zustand/persist — they hydrate synchronously on import,
    // but React may not have the values on the very first render.
    // A micro-task delay is enough to let the persisted state settle.
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!hydrated) return <BootSplash />;

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
          <Navigate to="/dashboard" replace />
        }
      />

      {/* All protected routes — AppNavBar only renders after onboarding */}
      <Route element={<><AppNavBar /><ProtectedRoute /></>}>
        <Route path="/" element={<StrategyFlow />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/executions" element={<ExecutionHistory />} />
        <Route path="/execution/:id" element={<ExecutionDetails />} />
        <Route path="/research" element={<Research />} />
        <Route path="/news" element={<News />} />
        <Route path="/terminal" element={<Terminal />} />
        <Route path="/terminal/rmap" element={<TerminalRmap />} />
        <Route path="/terminal/rmap/:ticker" element={<TerminalRmap />} />
        <Route path="/terminal/bmap" element={<TerminalBmap />} />
        <Route path="/terminal/splc" element={<TerminalSplc />} />
        <Route path="/terminal/splc/:ticker" element={<TerminalSplc />} />
        <Route path="/terminal/hds" element={<TerminalHds />} />
        <Route path="/terminal/hds/:ticker" element={<TerminalHds />} />
        <Route path="/ai-chat" element={<AiChat />} />
        <Route path="/agent" element={<AgentConfig />} />
        <Route path="/agents" element={<Agents />} />
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
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Theme>
);

export default App;