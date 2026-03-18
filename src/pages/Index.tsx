import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { AddTransactionDialog } from "@/components/dashboard/AddTransactionDialog";
import { IbkrDailyWidget } from "@/components/dashboard/IbkrDailyWidget";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { DripTracker } from "@/components/dashboard/DripTracker";
import { CurrencyToggle } from "@/components/dashboard/CurrencyToggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Euro,
  TrendingUp,
  PieChart,
  Wallet,
  LayoutDashboard,
  Percent,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  usePortfolios,
  usePositions,
  useDividendsYTD,
} from "@/hooks/usePortfolioData";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePrivateInvestments, usePrivateInvestmentMetrics } from "@/hooks/usePrivateInvestments";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

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
      const { data } = await supabase
        .from("fx_rates")
        .select("rate")
        .eq("from_currency", "USD")
        .eq("to_currency", "EUR")
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.rate ? 1 / data.rate : 1;
    },
  });
}

const Index = () => {
  const { currency } = useDisplayCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      // Get the user's IBKR connection
      const { data: connections, error: connErr } = await supabase
        .from("ibkr_connections")
        .select("id")
        .limit(1);
      if (connErr) throw connErr;
      if (!connections || connections.length === 0) {
        toast.error("Geen IBKR-verbinding gevonden. Configureer er een in Instellingen.");
        return;
      }
      const { error } = await supabase.functions.invoke("ibkr-sync", {
        body: { connectionId: connections[0].id },
      });
      if (error) throw error;
      toast.success("Sync gestart! Data wordt bijgewerkt.");
      queryClient.invalidateQueries({ queryKey: ["last-sync-date"] });
      queryClient.invalidateQueries({ queryKey: ["ibkr-daily"] });
    } catch (err: any) {
      toast.error(`Sync mislukt: ${err.message ?? "onbekende fout"}`);
    } finally {
      setSyncing(false);
    }
  };
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

  // Private investments
  const { data: privateInvestments } = usePrivateInvestments();
  const privateMetrics = usePrivateInvestmentMetrics(privateInvestments ?? undefined);

  // Private cashflows YTD (actual received)
  const { data: privateCashflowsYTD } = useQuery({
    queryKey: ["private-cashflows-ytd", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("private_investment_cashflows")
        .select("amount")
        .gte("cashflow_date", startOfYear);
      if (error) throw error;
      return (data ?? []).reduce((sum, d) => sum + d.amount, 0);
    },
  });

  // Forward annual dividends (public) from fundamental_data dividend_yield
  const securityIds = useMemo(
    () => [...new Set((positions ?? []).map((p) => p.security_id))],
    [positions]
  );
  const { data: fundamentalYields } = useQuery({
    queryKey: ["fundamental-yields", securityIds],
    enabled: securityIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fundamental_data")
        .select("security_id, dividend_yield, data_date")
        .in("security_id", securityIds)
        .order("data_date", { ascending: false });
      if (error) throw error;
      // Latest yield per security
      const map = new Map<string, number>();
      for (const fd of data ?? []) {
        if (!map.has(fd.security_id) && fd.dividend_yield != null) {
          map.set(fd.security_id, fd.dividend_yield);
        }
      }
      return map;
    },
  });

  // Compute annual dividend per share for YoC calculation
  // YoC = (annual div per share / avg cost) * 100
  // dividend_yield is stored as decimal (e.g., 0.052 = 5.2%)
  // annual div per share = yield_decimal * market_price
  const dividendPerShareMap = useMemo(() => {
    if (!positions || !fundamentalYields) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const pos of positions) {
      const yieldDecimal = fundamentalYields.get(pos.security_id);
      if (yieldDecimal != null && pos.market_price != null) {
        map.set(pos.security_id, yieldDecimal * pos.market_price);
      }
    }
    return map;
  }, [positions, fundamentalYields]);

  const isLoading = loadingPortfolios || loadingPositions;
  const hasPositions = (positions?.length ?? 0) > 0 || (privateInvestments?.length ?? 0) > 0;

  // Check sync staleness
  const { data: lastSyncDate } = useQuery({
    queryKey: ["last-sync-date", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_account_summary")
        .select("date")
        .order("date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.date ?? null;
    },
  });

  const syncStaleHours = useMemo(() => {
    if (!lastSyncDate) return null;
    const lastDate = new Date(lastSyncDate + "T06:00:00Z");
    const diffMs = Date.now() - lastDate.getTime();
    return diffMs / (1000 * 60 * 60);
  }, [lastSyncDate]);

  // Calculate KPIs — Portfolio = publiek + privaat
  const publicValue = useMemo(
    () =>
      (positions ?? []).reduce(
        (sum, p) => sum + (p.market_value ?? p.total_cost_basis),
        0
      ),
    [positions]
  );

  const publicPnl = useMemo(
    () =>
      (positions ?? []).reduce((sum, p) => sum + (p.unrealized_pnl ?? 0), 0),
    [positions]
  );

  const publicCost = useMemo(
    () => (positions ?? []).reduce((sum, p) => sum + p.total_cost_basis, 0),
    [positions]
  );

  // Private netto maandelijkse cashflow
  const privateMonthlyCosts = useMemo(() => {
    const items = privateInvestments ?? [];
    const totalLoanCosts = items.reduce((s, i) => s + (i.has_loan ? (i.loan_monthly_payment ?? 0) : 0), 0);
    const totalMonthlyCosts = items.reduce((s, i) => s + (i.monthly_costs ?? 0), 0);
    return totalLoanCosts + totalMonthlyCosts;
  }, [privateInvestments]);

  // Totalen: publiek + privaat (privaat = equity, dus waarde minus leningen)
  const totalValue = publicValue + privateMetrics.totalEquity;
  const totalPnl = publicPnl + privateMetrics.unrealizedPnl;
  const totalCost = publicCost + privateMetrics.totalInvested;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // ─── KPI 1: Maandelijkse cashflow YTD ───
  const now = new Date();
  const monthsElapsed = Math.max(1, now.getMonth() + (now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
  const totalCashflowYTD = (dividendsYTD ?? 0) + (privateCashflowsYTD ?? 0);
  const monthlyCashflowYTD = totalCashflowYTD / monthsElapsed;

  // ─── KPI 2: Forward yield (%) ───
  const publicForwardAnnualDividends = useMemo(() => {
    if (!positions || !fundamentalYields) return 0;
    return positions.reduce((sum, p) => {
      const yieldDecimal = fundamentalYields.get(p.security_id) ?? 0;
      const mv = p.market_value ?? p.total_cost_basis;
      return sum + yieldDecimal * mv;
    }, 0);
  }, [positions, fundamentalYields]);

  const privateNetAnnualCashflow = privateMetrics.totalAnnualCashflow - (privateMonthlyCosts * 12);
  const forwardAnnualCashflow = publicForwardAnnualDividends + privateNetAnnualCashflow;
  const forwardYieldPct = totalValue > 0 ? (forwardAnnualCashflow / totalValue) * 100 : 0;

  // ─── KPI: Weighted average Yield on Cost ───
  const weightedYoC = useMemo(() => {
    if (!positions || !dividendPerShareMap) return 0;
    let totalCostBasis = 0;
    let totalAnnualDiv = 0;
    for (const p of positions) {
      const divPerShare = dividendPerShareMap.get(p.security_id);
      if (divPerShare != null && p.avg_cost_basis > 0) {
        const annualDivForPosition = divPerShare * p.quantity;
        totalAnnualDiv += annualDivForPosition;
        totalCostBasis += p.total_cost_basis;
      }
    }
    return totalCostBasis > 0 ? (totalAnnualDiv / totalCostBasis) * 100 : 0;
  }, [positions, dividendPerShareMap]);

  const positionCount = (positions?.length ?? 0) + (privateInvestments?.length ?? 0);

  return (
    <AppLayout title="Portfolio" subtitle="Overzicht van al je strategieën samen" actions={<CurrencyToggle />}>
      {/* Sync staleness warning */}
      {syncStaleHours !== null && syncStaleHours > 24 && (
        <Alert variant="destructive" className="mb-4 border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-500/30 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2 text-sm">
            <span>
              Laatste IBKR-sync is {Math.floor(syncStaleHours / 24)} dag{Math.floor(syncStaleHours / 24) !== 1 ? "en" : ""} geleden ({lastSyncDate}). Controleer je verbinding in Instellingen.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-600/50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-900/40"
              onClick={handleManualSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Nu synchroniseren"}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 mb-6">
        {isLoading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
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
              subtitle={`Publiek: ${fmt(publicValue)} · Privaat: ${fmt(privateMetrics.totalEquity)}`}
              icon={currency === "EUR" ? Euro : DollarSign}
              href="/portfolio-breakdown"
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
              href="/portfolio-breakdown"
            />
            <KpiCard
              label="Maandelijkse cashflow YTD"
              value={fmt(monthlyCashflowYTD)}
              subtitle={`Totaal ontvangen YTD: ${fmt(totalCashflowYTD)}`}
              icon={Wallet}
              href="/dividend-calendar"
            />
            <KpiCard
              label="Forward yield (jaar)"
              value={`${forwardYieldPct.toFixed(2)}%`}
              subtitle={`Verwacht: ${fmt(forwardAnnualCashflow)}/jaar`}
              icon={Percent}
              href="/strategies"
            />
            <KpiCard
              label="Yield on Cost"
              value={`${weightedYoC.toFixed(2)}%`}
              subtitle="Gewogen gem. over alle posities"
              icon={TrendingUp}
              href="/strategies"
            />
            <KpiCard
              label="Posities"
              value={String(positionCount)}
              subtitle={`${positions?.length ?? 0} publiek · ${privateInvestments?.length ?? 0} privaat`}
              icon={PieChart}
              href="/portfolio-breakdown"
            />
          </>
        )}
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Holdings — 2/3 width */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Posities</CardTitle>
            <AddTransactionDialog />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : hasPositions ? (
              <HoldingsTable positions={positions ?? []} dividendPerShareMap={dividendPerShareMap} />
            ) : (
              <EmptyState
                icon={LayoutDashboard}
                title="Geen posities"
                description="Voeg een transactie toe of synchroniseer via IBKR om te beginnen."
                action={
                  <AddTransactionDialog>
                    <Button variant="outline" size="sm">
                      Transactie toevoegen
                    </Button>
                  </AddTransactionDialog>
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
            ) : (positions?.length ?? 0) > 0 ? (
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

      {/* DRIP Compound Growth Tracker */}
      <Card className="mt-6 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span>💰</span> DRIP Tracker — Compound Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DripTracker />
        </CardContent>
      </Card>

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
