import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <Theme appearance="dark" accentColor="purple" grayColor="slate" radius="small" scaling="90%">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<StrategyFlow />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/executions" element={<ExecutionHistory />} />
            <Route path="/execution/:id" element={<ExecutionDetails />} />
            <Route path="/credentials" element={<Credentials />} />
            <Route path="/agent" element={<AgentConfig />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Theme>
);

export default App;