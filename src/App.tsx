import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Theme } from "@radix-ui/themes";
import ThemeProvider, { useTheme, type ResolvedTheme } from "./contexts/ThemeContext";
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
import {
  GlobalAiFab,
  GlobalAiBackdrop,
  GlobalAiPanel,
  CommandPalette,
  SelectionPill,
  ArtifactRail,
} from "./features/ai-chat";
import { GlobalVoiceFab } from "./features/voice/GlobalVoiceFab";
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
  <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
    <div className="text-center">
      <div
        className="w-12 h-12 mx-auto mb-5 rounded-full"
        style={{
          border: '3px solid hsl(var(--primary) / 0.15)',
          borderTopColor: 'hsl(var(--primary))',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p className="text-[13px] m-0">Loading…</p>
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
            ? <Navigate to="/" replace />
            : isAuthenticated
              ? <Onboarding />
              : <Navigate to="/login" replace />
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          <Navigate to="/" replace />
        }
      />

      {/* All protected routes — AppNavBar only renders after onboarding */}
      <Route element={<><AppNavBar /><ProtectedRoute /></>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/builder" element={<StrategyFlow />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
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

// Always-mounted overlays that need router context (cmd+k symbol palette,
// global AI chat panel + FAB). The AI surfaces only render once the user is
// authenticated and onboarded, so they don't show on /login or /onboarding.
const GlobalOverlays = () => {
  const { isAuthenticated } = useAuthStore();
  const { hasCompletedOnboarding } = useOnboardingStore();
  const showAi = isAuthenticated && hasCompletedOnboarding;

  return (
    <>
      <SymbolPalette />
      {showAi && (
        <>
          <GlobalAiBackdrop />
          <GlobalAiPanel />
          <ArtifactRail />
          <GlobalAiFab />
          <GlobalVoiceFab />
          <CommandPalette />
          <SelectionPill />
        </>
      )}
    </>
  );
};

/**
 * Maps our theme names to Radix UI Theme provider props so Radix-themed
 * components (popovers, dialogs, toasts) follow the active theme.
 */
const radixPropsFor = (
  resolved: ResolvedTheme,
): { appearance: 'light' | 'dark'; accentColor: 'purple' | 'orange' | 'yellow' | 'blue' } => {
  switch (resolved) {
    case 'light': return { appearance: 'light', accentColor: 'purple' };
    case 'hicontrast': return { appearance: 'dark', accentColor: 'yellow' };
    case 'bloomberg': return { appearance: 'dark', accentColor: 'orange' };
    case 'dark':
    default: return { appearance: 'dark', accentColor: 'purple' };
  }
};

const ThemedShell = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const radixProps = radixPropsFor(resolvedTheme);
  return (
    <Theme {...radixProps} grayColor="slate" radius="small" scaling="90%">
      {children}
    </Theme>
  );
};

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="ppm-ui-theme">
    <ThemedShell>
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
    </ThemedShell>
  </ThemeProvider>
);

export default App;