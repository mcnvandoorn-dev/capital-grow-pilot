import { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, RefreshCw, Sprout, DollarSign, Wallet, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePositions, useDividendsYTD } from "@/hooks/usePortfolioData";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { CurrencyToggle } from "@/components/dashboard/CurrencyToggle";
import { cn } from "@/lib/utils";
import { useDividendIntelligence } from "@/hooks/useDividendIntelligence";
import { DividendIntelligencePanel } from "@/components/strategies/DividendIntelligencePanel";
import { usePrivateInvestments } from "@/hooks/usePrivateInvestments";
import { PrivateInvestmentsSection } from "@/components/strategies/PrivateInvestmentsSection";
import { usePrivateInvestmentMetrics } from "@/hooks/usePrivateInvestments";

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

function formatAmount(value: number, currency: "EUR" | "USD") {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

const Strategies = () => {
  const { user } = useAuth();
  const { currency } = useDisplayCurrency();
  const { data: eurToUsd } = useEurToUsd();
  const rate = currency === "EUR" ? 1 : (eurToUsd ?? 1);
  const fmt = (v: number) => formatAmount(v * rate, currency);

  const { data: portfolios } = useQuery({
    queryKey: ["portfolios-strategies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("id, name, strategy, base_currency")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const allPortfolioIds = useMemo(() => (portfolios ?? []).map((p) => p.id), [portfolios]);
  const { data: allPositions } = usePositions(allPortfolioIds);

  const byStrategy = useMemo(() => {
    const map: Record<string, typeof portfolios> = {
      BUY_AND_HOLD: [],
      DIVIDEND_GROWTH: [],
      WORKING_CAPITAL_GROWTH: [],
    };
    for (const p of portfolios ?? []) {
      (map[p.strategy] ??= []).push(p);
    }
    return map;
  }, [portfolios]);

  // Group positions by portfolio
  const positionsByPortfolio = useMemo(() => {
    const map = new Map<string, typeof allPositions>();
    for (const pos of allPositions ?? []) {
      const arr = map.get(pos.portfolio_id) ?? [];
      arr.push(pos);
      map.set(pos.portfolio_id, arr);
    }
    return map;
  }, [allPositions]);

  // Get portfolio IDs per strategy for dividends
  const strategyPortfolioIds = useMemo(() => ({
    BUY_AND_HOLD: (byStrategy.BUY_AND_HOLD ?? []).map((p) => p.id),
    DIVIDEND_GROWTH: (byStrategy.DIVIDEND_GROWTH ?? []).map((p) => p.id),
    WORKING_CAPITAL_GROWTH: (byStrategy.WORKING_CAPITAL_GROWTH ?? []).map((p) => p.id),
  }), [byStrategy]);

  const { data: divBuyHold } = useDividendsYTD(strategyPortfolioIds.BUY_AND_HOLD);
  const { data: divDividend } = useDividendsYTD(strategyPortfolioIds.DIVIDEND_GROWTH);
  const { data: divWcg } = useDividendsYTD(strategyPortfolioIds.WORKING_CAPITAL_GROWTH);
  const { data: privateInvestments } = usePrivateInvestments();

  // Forward annual income for all public portfolios (last 12 months annualized)
  const { data: allDividendIntel } = useDividendIntelligence(allPortfolioIds, allPositions ?? undefined);
  const publicForwardIncome = allDividendIntel?.totalAnnualIncome ?? 0;

  return (
    <AppLayout title="Strategieën" subtitle="Bekijk je portfolio's per strategie" actions={<CurrencyToggle />}>
      <Tabs defaultValue="buyhold" className="space-y-6">
        <TabsList>
          <TabsTrigger value="buyhold">Buy & Hold</TabsTrigger>
          <TabsTrigger value="dividend">Dividend Growth</TabsTrigger>
          <TabsTrigger value="wcg">Working Capital Growth</TabsTrigger>
          <TabsTrigger value="private">Private</TabsTrigger>
        </TabsList>

        <TabsContent value="buyhold">
          <StrategySection
            icon={TrendingUp}
            title="Buy & Hold"
            portfolios={byStrategy.BUY_AND_HOLD ?? []}
            positionsByPortfolio={positionsByPortfolio}
            dividendsYTD={divBuyHold ?? 0}
            fmt={fmt}
            emptyDescription="Geen portfolio's met de Buy & Hold strategie."
          />
        </TabsContent>

        <TabsContent value="dividend">
          <StrategySection
            icon={Sprout}
            title="Dividend Growth"
            portfolios={byStrategy.DIVIDEND_GROWTH ?? []}
            positionsByPortfolio={positionsByPortfolio}
            dividendsYTD={divDividend ?? 0}
            fmt={fmt}
            emptyDescription="Geen portfolio's met de Dividend Growth strategie."
          />
        </TabsContent>

        <TabsContent value="wcg">
          <StrategySection
            icon={RefreshCw}
            title="Working Capital Growth"
            portfolios={byStrategy.WORKING_CAPITAL_GROWTH ?? []}
            positionsByPortfolio={positionsByPortfolio}
            dividendsYTD={divWcg ?? 0}
            fmt={fmt}
            emptyDescription="Geen portfolio's met de Working Capital Growth strategie."
          />
        </TabsContent>
        <TabsContent value="private">
          <PrivateInvestmentsSection
            investments={privateInvestments ?? []}
            fmt={fmt}
            publicValue={allPositions?.reduce((s, p) => s + (p.market_value ?? p.total_cost_basis), 0) ?? 0}
            publicForwardIncome={publicForwardIncome}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

function StrategySection({
  icon: Icon,
  title,
  portfolios,
  positionsByPortfolio,
  dividendsYTD,
  fmt,
  emptyDescription,
}: {
  icon: any;
  title: string;
  portfolios: { id: string; name: string; strategy: string }[];
  positionsByPortfolio: Map<string, any[]>;
  dividendsYTD: number;
  fmt: (v: number) => string;
  emptyDescription: string;
}) {
  // Aggregate all positions across portfolios in this strategy
  const allPositions = useMemo(() => {
    const result: any[] = [];
    for (const p of portfolios) {
      const positions = positionsByPortfolio.get(p.id) ?? [];
      result.push(...positions);
    }
    return result;
  }, [portfolios, positionsByPortfolio]);

  // Dividend Intelligence
  const portfolioIds = useMemo(() => portfolios.map((p) => p.id), [portfolios]);
  const { data: dividendIntel } = useDividendIntelligence(portfolioIds, allPositions);

  const totalValue = useMemo(
    () => allPositions.reduce((sum, p) => sum + (p.market_value ?? p.total_cost_basis), 0),
    [allPositions]
  );
  const totalPnl = useMemo(
    () => allPositions.reduce((sum, p) => sum + (p.unrealized_pnl ?? 0), 0),
    [allPositions]
  );
  const totalCost = useMemo(
    () => allPositions.reduce((sum, p) => sum + p.total_cost_basis, 0),
    [allPositions]
  );
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  if (portfolios.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={`Geen ${title} portfolio's`}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" /> Totale waarde
            </div>
            <p className="text-xl font-semibold tabular-nums">{fmt(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> Ongerealiseerd P/L
            </div>
            <p className={cn("text-xl font-semibold tabular-nums", totalPnl >= 0 ? "text-positive" : "text-negative")}>
              {fmt(totalPnl)} <span className="text-sm font-normal">({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)</span>
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" /> Dividend YTD
            </div>
            <p className="text-xl font-semibold tabular-nums">{fmt(dividendsYTD)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              Posities
            </div>
            <p className="text-xl font-semibold">{allPositions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Allocation chart + Top holdings */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Verdeling</CardTitle>
          </CardHeader>
          <CardContent>
            {allPositions.length > 0 ? (
              <AllocationChart positions={allPositions} />
            ) : (
              <p className="text-sm text-muted-foreground">Geen posities.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Top posities</CardTitle>
          </CardHeader>
          <CardContent>
            {allPositions.length > 0 ? (
              <div className="space-y-2">
                {[...allPositions]
                  .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))
                  .slice(0, 10)
                  .map((pos) => (
                    <div key={pos.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium w-16">{pos.security.ticker}</span>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px]">{pos.security.name ?? "—"}</span>
                        <Badge variant="secondary" className="text-xs">{pos.security.asset_class}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-sm tabular-nums font-medium">{fmt(pos.market_value ?? pos.total_cost_basis)}</span>
                        <span className={cn("text-xs tabular-nums w-16", (pos.unrealized_pnl_pct ?? 0) >= 0 ? "text-positive" : "text-negative")}>
                          {pos.unrealized_pnl_pct !== null ? `${pos.unrealized_pnl_pct >= 0 ? "+" : ""}${pos.unrealized_pnl_pct.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Geen posities.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio cards */}
      {portfolios.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Portfolio's</h3>
          {portfolios.map((p) => {
            const pPositions = positionsByPortfolio.get(p.id) ?? [];
            const pValue = pPositions.reduce((s, pos) => s + (pos.market_value ?? pos.total_cost_basis), 0);
            return (
              <Card key={p.id} className="shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="outline" className="text-xs">{pPositions.length} posities</Badge>
                  </div>
                  <span className="font-medium tabular-nums text-sm">{fmt(pValue)}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Dividend Intelligence */}
      {dividendIntel && dividendIntel.securities.length > 0 && (
        <DividendIntelligencePanel data={dividendIntel} fmt={fmt} />
      )}



    </div>
  );
}

export default Strategies;
