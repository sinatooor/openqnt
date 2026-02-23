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
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./stores/authStore";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    return <>{children}</>;
}

const ProtectedRoutes = () => {
    const { isAuthenticated } = useAuthStore();
    
    return (
        <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/" element={<ProtectedRoute><StrategyFlow /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/executions" element={<ProtectedRoute><ExecutionHistory /></ProtectedRoute>} />
            <Route path="/execution/:id" element={<ProtectedRoute><ExecutionDetails /></ProtectedRoute>} />
            <Route path="/credentials" element={<ProtectedRoute><Credentials /></ProtectedRoute>} />
            <Route path="/agent" element={<ProtectedRoute><AgentConfig /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
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