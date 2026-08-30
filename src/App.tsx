import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import DayEndSettlement from "./pages/DayEndSettlement.tsx";
import ReceivablesDashboard from "./pages/ReceivablesDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import LoginGate from "./components/auth/LoginGate.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LoginGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/day-end" element={<DayEndSettlement />} />
            <Route path="/receivables" element={<ReceivablesDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LoginGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
