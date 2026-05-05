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
import TerminalGip from "./pages/TerminalGip";
import TerminalDes from "./pages/TerminalDes";
import TerminalFa from "./pages/TerminalFa";
import TerminalDvd from "./pages/TerminalDvd";
import TerminalN from "./pages/TerminalN";
import TerminalRv from "./pages/TerminalRv";
import TerminalWatch from "./pages/TerminalWatch";
import TerminalMost from "./pages/TerminalMost";
import TerminalTop from "./pages/TerminalTop";
import TerminalEqs from "./pages/TerminalEqs";
import AiChat from "./pages/AiChat";
import Agents from "./pages/Agents";
import Boss from "./pages/Boss";
import Backtest from "./pages/Backtest";
import Tools from "./pages/Tools";
import Execution from "./pages/Execution";
import Improvement from "./pages/Improvement";
import SymbolPalette from "./features/terminal/SymbolPalette";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppNavBar } from "./components/AppNavBar";
import { useAuthStore } from "./stores/authStore";
import { useOnboardingStore } from "./stores/onboardingStore";
import { useAppBootstrap } from "./hooks/useAppBootstrap";

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

  // Reconcile any data the user has configured but not yet fetched this
  // session (Avanza sync, etc.). Runs in the background, never blocks UI.
  useAppBootstrap();

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
        <Route path="/terminal/gip" element={<TerminalGip />} />
        <Route path="/terminal/gip/:ticker" element={<TerminalGip />} />
        <Route path="/terminal/des" element={<TerminalDes />} />
        <Route path="/terminal/des/:ticker" element={<TerminalDes />} />
        <Route path="/terminal/fa" element={<TerminalFa />} />
        <Route path="/terminal/fa/:ticker" element={<TerminalFa />} />
        <Route path="/terminal/dvd" element={<TerminalDvd />} />
        <Route path="/terminal/dvd/:ticker" element={<TerminalDvd />} />
        <Route path="/terminal/n" element={<TerminalN />} />
        <Route path="/terminal/n/:ticker" element={<TerminalN />} />
        <Route path="/terminal/rv" element={<TerminalRv />} />
        <Route path="/terminal/rv/:ticker" element={<TerminalRv />} />
        <Route path="/terminal/watch" element={<TerminalWatch />} />
        <Route path="/terminal/most" element={<TerminalMost />} />
        <Route path="/terminal/top" element={<TerminalTop />} />
        <Route path="/terminal/eqs" element={<TerminalEqs />} />
        <Route path="/ai-chat" element={<AiChat />} />
        <Route path="/agent" element={<AgentConfig />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:id" element={<Agents />} />
        <Route path="/boss" element={<Boss />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/execution" element={<Execution />} />
        <Route path="/improvement" element={<Improvement />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/portfolio" element={<Portfolio />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Always-mounted overlays that need router context (cmd+k symbol palette).
const GlobalOverlays = () => <SymbolPalette />;

const App = () => (
  <Theme appearance="dark" accentColor="purple" grayColor="slate" radius="small" scaling="90%">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
          <GlobalOverlays />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Theme>
);

export default App;