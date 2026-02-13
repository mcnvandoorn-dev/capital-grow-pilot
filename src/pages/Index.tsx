import { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { IbkrDailyWidget } from "@/components/dashboard/IbkrDailyWidget";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { CurrencyToggle } from "@/components/dashboard/CurrencyToggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  PieChart,
  Wallet,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  usePortfolios,
  usePositions,
  useDividendsYTD,
} from "@/hooks/usePortfolioData";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function formatAmount(value: number, currency: "EUR" | "USD") {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

// Hook to get EUR→USD conversion rate
function useEurToUsd() {
  return useQuery({
    queryKey: ["eur-to-usd-rate"],
    queryFn: async () => {
      // Get USD→EUR rate from fx_rates, invert it
      const { data } = await supabase
        .from("fx_rates")
        .select("rate")
        .eq("from_currency", "USD")
        .eq("to_currency", "EUR")
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      // If USD→EUR rate exists, EUR→USD = 1/rate
      return data?.rate ? 1 / data.rate : 1;
    },
  });
}

const Index = () => {
  const { currency } = useDisplayCurrency();
  const { data: eurToUsd } = useEurToUsd();
  const rate = currency === "EUR" ? 1 : (eurToUsd ?? 1);
  const fmt = (v: number) => formatAmount(v * rate, currency);

  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios();
  const portfolioIds = useMemo(
    () => (portfolios ?? []).map((p) => p.id),
    [portfolios]
  );

  const { data: positions, isLoading: loadingPositions } =
    usePositions(portfolioIds);
  const { data: dividendsYTD } = useDividendsYTD(portfolioIds);

  const isLoading = loadingPortfolios || loadingPositions;
  const hasPositions = (positions?.length ?? 0) > 0;

  // Calculate KPIs
  const totalValue = useMemo(
    () =>
      (positions ?? []).reduce(
        (sum, p) => sum + (p.market_value ?? p.total_cost_basis),
        0
      ),
    [positions]
  );

  const totalPnl = useMemo(
    () =>
      (positions ?? []).reduce((sum, p) => sum + (p.unrealized_pnl ?? 0), 0),
    [positions]
  );

  const totalCost = useMemo(
    () => (positions ?? []).reduce((sum, p) => sum + p.total_cost_basis, 0),
    [positions]
  );

  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <AppLayout title="Portfolio" subtitle="Overzicht van je beleggingen" actions={<CurrencyToggle />}>
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-7 w-28" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <KpiCard
              label="Totale waarde"
              value={fmt(totalValue)}
              icon={DollarSign}
            />
            <KpiCard
              label="Ongerealiseerd P/L"
              value={fmt(totalPnl)}
              change={`${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`}
              changeType={
                totalPnl > 0
                  ? "positive"
                  : totalPnl < 0
                  ? "negative"
                  : "neutral"
              }
              icon={TrendingUp}
            />
            <KpiCard
              label="Dividend YTD"
              value={fmt(dividendsYTD ?? 0)}
              icon={Wallet}
            />
            <KpiCard
              label="Posities"
              value={String(positions?.length ?? 0)}
              icon={PieChart}
            />
          </>
        )}
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Holdings — 2/3 width */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Posities</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : hasPositions ? (
              <HoldingsTable positions={positions!} />
            ) : (
              <EmptyState
                icon={LayoutDashboard}
                title="Geen posities"
                description="Voeg een transactie toe of promoveer een bedrijf vanuit je watchlist om te beginnen."
                action={
                  <Button variant="outline" size="sm">
                    Transactie toevoegen
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Allocation — 1/3 width */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Verdeling</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[180px] w-full rounded-lg" />
            ) : hasPositions ? (
              <AllocationChart positions={positions!} />
            ) : (
              <EmptyState
                icon={PieChart}
                title="Geen data"
                description="Allocatie wordt getoond zodra je posities hebt."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* IBKR Daily Widget */}
      <div className="mt-6">
        <IbkrDailyWidget />
      </div>

      {/* Performance chart */}
      <Card className="mt-6 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceChart />
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Index;
