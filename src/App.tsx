import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CurrencyProvider } from "@/hooks/useDisplayCurrency";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Watchlist from "./pages/Watchlist";
import StockDetail from "./pages/StockDetail";
import Strategies from "./pages/Strategies";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Alerts from "./pages/Alerts";
import PortfolioBreakdown from "./pages/PortfolioBreakdown";
import TickerDeepDive from "./pages/TickerDeepDive";
import RebalancingAdvisor from "./pages/RebalancingAdvisor";
import DividendCalendar from "./pages/DividendCalendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
            <Route path="/stock/:id" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
            <Route path="/strategies" element={<ProtectedRoute><Strategies /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/portfolio-breakdown" element={<ProtectedRoute><PortfolioBreakdown /></ProtectedRoute>} />
            <Route path="/ticker-deep-dive" element={<ProtectedRoute><TickerDeepDive /></ProtectedRoute>} />
            <Route path="/rebalancing-advisor" element={<ProtectedRoute><RebalancingAdvisor /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
