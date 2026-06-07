import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CurrencyProvider } from "@/hooks/useDisplayCurrency";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageSeo } from "@/components/seo/PageSeo";
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
import { CompassLayout } from "./components/dividend-compass/CompassLayout";
import CompassHome from "./pages/compass/CompassHome";
import DividendAristocrats from "./pages/compass/DividendAristocrats";


const queryClient = new QueryClient();

const withSeo = (title: string, description: string, node: React.ReactNode) => (
  <>
    <PageSeo title={title} description={description} />
    {node}
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
          <Routes>
            <Route path="/auth" element={withSeo("Inloggen", "Log in op InvestView om je beleggingsportfolio te beheren.", <Auth />)} />

            {/* DividendCompass public content site */}
            <Route element={<CompassLayout />}>
              <Route path="/compass" element={withSeo("DividendCompass", "Clear, research-driven guides for long-term dividend investors.", <CompassHome />)} />
              <Route path="/dividend-aristocrats" element={withSeo("Dividend Aristocrats Guide", "A guide to companies with decades of consistent dividend growth.", <DividendAristocrats />)} />
            </Route>


            <Route path="/" element={<ProtectedRoute>{withSeo("Portfolio", "Overzicht van je beleggingsportfolio: holdings, performance en allocatie.", <Index />)}</ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute>{withSeo("Watchlist", "Volg tickers en marktdata in je persoonlijke watchlist.", <Watchlist />)}</ProtectedRoute>} />
            <Route path="/stock/:id" element={<ProtectedRoute>{withSeo("Aandeel detail", "Detailweergave van een aandeel met koers, fundamentals en dividenden.", <StockDetail />)}</ProtectedRoute>} />
            <Route path="/strategies" element={<ProtectedRoute>{withSeo("Strategieën", "Beheer beleggingsstrategieën zoals Buy & Hold, Dividend Growth en Working Capital Growth.", <Strategies />)}</ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute>{withSeo("Instellingen", "Beheer je account, integraties en voorkeuren in InvestView.", <Settings />)}</ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute>{withSeo("Meldingen", "Beheer prijs- en portfolio-alerts voor je beleggingen.", <Alerts />)}</ProtectedRoute>} />
            <Route path="/portfolio-breakdown" element={<ProtectedRoute>{withSeo("Portfolio Breakdown", "Look-through analyse van je portfolio, fondsen en ETF's per sector en regio.", <PortfolioBreakdown />)}</ProtectedRoute>} />
            <Route path="/ticker-deep-dive" element={<ProtectedRoute>{withSeo("Ticker Deep Dive", "Diepgaande fundamentele en kwalitatieve analyse per ticker.", <TickerDeepDive />)}</ProtectedRoute>} />
            <Route path="/rebalancing-advisor" element={<ProtectedRoute>{withSeo("Rebalancing Advisor", "Aanbevelingen voor het herbalanceren van je beleggingsportfolio.", <RebalancingAdvisor />)}</ProtectedRoute>} />
            <Route path="/dividend-calendar" element={<ProtectedRoute>{withSeo("Dividend Kalender", "Overzicht van komende dividenduitkeringen van je posities.", <DividendCalendar />)}</ProtectedRoute>} />
            <Route path="*" element={withSeo("Niet gevonden", "De gevraagde pagina bestaat niet.", <NotFound />)} />
          </Routes>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
