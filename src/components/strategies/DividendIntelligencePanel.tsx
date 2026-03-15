import { useState } from "react";
import type { DividendIntelligence } from "@/hooks/useDividendIntelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Wallet, RefreshCw, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function formatEur(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

interface FundamentalRow {
  security_id: string;
  dividend_yield: number | null;
  dividend_cagr_5y: number | null;
  payout_ratio: number | null;
  pe_ratio: number | null;
}

function useFundamentals(securityIds: string[]) {
  return useQuery({
    queryKey: ["fundamentals", securityIds],
    queryFn: async () => {
      if (securityIds.length === 0) return new Map<string, FundamentalRow>();
      const { data } = await supabase
        .from("fundamental_data")
        .select("security_id, dividend_yield, dividend_cagr_5y, payout_ratio, pe_ratio")
        .in("security_id", securityIds)
        .order("data_date", { ascending: false });

      // Keep only latest per security
      const map = new Map<string, FundamentalRow>();
      for (const row of data ?? []) {
        if (!map.has(row.security_id)) map.set(row.security_id, row);
      }
      return map;
    },
    enabled: securityIds.length > 0,
  });
}

interface Props {
  data: DividendIntelligence;
  fmt: (v: number) => string;
}

export function DividendIntelligencePanel({ data, fmt }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const secIds = data.securities.map((s) => s.securityId);
  const { data: fundamentals } = useFundamentals(secIds);

  if (data.securities.length === 0) return null;

  const handleRefreshFundamentals = async () => {
    setRefreshing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("fetch-fundamentals");
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      toast.success(`Fundamentele data bijgewerkt voor ${result?.updated ?? 0} securities`);
      queryClient.invalidateQueries({ queryKey: ["fundamentals"] });
    } catch (e: any) {
      toast.error(e.message ?? "Fout bij ophalen fundamentele data");
    } finally {
      setRefreshing(false);
    }
  };

  const projectionData = [
    {
      year: new Date().getFullYear(),
      base: data.totalAnnualIncome,
      optimistic: data.totalAnnualIncome,
      conservative: data.totalAnnualIncome,
    },
    ...data.projectedIncome5y,
  ];

  const hasFundamentals = fundamentals && fundamentals.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Dividend Intelligence
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshFundamentals}
          disabled={refreshing}
          className="gap-2"
        >
          <Database className="h-3.5 w-3.5" />
          {refreshing ? "Ophalen..." : "Fundamentele data ophalen"}
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">
              Bruto jaarlijks dividend
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {fmt(data.totalAnnualGross)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">
              Bronbelasting
            </p>
            <p className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {data.totalAnnualTax > 0 ? `-${fmt(data.totalAnnualTax)}` : "—"}
            </p>
            {data.totalAnnualGross > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {((data.totalAnnualTax / data.totalAnnualGross) * 100).toFixed(1)}% effectief tarief
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">
              Netto jaarlijks inkomen
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {fmt(data.totalAnnualIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">Gewogen yield</p>
            <p className="text-xl font-semibold tabular-nums">
              {data.weightedYield != null
                ? `${data.weightedYield.toFixed(2)}%`
                : "—"}
            </p>
            <p
              className={cn(
                "text-xs tabular-nums mt-0.5",
                (data.avgGrowthPct ?? 0) >= 0
                  ? "text-primary"
                  : "text-destructive"
              )}
            >
              {data.avgGrowthPct != null
                ? `Groei: ${data.avgGrowthPct >= 0 ? "+" : ""}${data.avgGrowthPct.toFixed(1)}%`
                : "Onvoldoende groeidata"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top dividend payers */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Top dividendbetalers
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {/* Header row */}
          <div className="flex items-center justify-between py-1.5 border-b text-xs text-muted-foreground font-medium min-w-[800px]">
            <div className="flex items-center gap-3">
              <span className="w-16">Ticker</span>
              <span className="w-[160px]">Naam</span>
              <span className="w-20">Frequentie</span>
            </div>
            <div className="flex items-center gap-3 text-right">
              <span className="w-20">Bruto</span>
              <span className="w-16">Belasting</span>
              <span className="w-20">Netto</span>
              <span className="w-14">Yield</span>
              <span className="w-14">Groei</span>
              {hasFundamentals && (
                <>
                  <span className="w-16">5y CAGR</span>
                  <span className="w-16">Payout</span>
                </>
              )}
              <span className="w-10">Aandeel</span>
            </div>
          </div>
          <div className="space-y-0">
            {data.securities.slice(0, 15).map((sec) => {
              const fund = fundamentals?.get(sec.securityId);
              return (
                <div
                  key={sec.securityId}
                  className="flex items-center justify-between py-2 border-b last:border-0 min-w-[700px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium w-16">
                      {sec.ticker}
                    </span>
                    <span className="text-sm text-muted-foreground truncate w-[160px]">
                      {sec.name ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground w-20">
                      {sec.frequency}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-sm tabular-nums font-medium w-20">
                      {fmt(sec.annualDividendEur)}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground w-14">
                      {sec.currentYield != null
                        ? `${sec.currentYield.toFixed(1)}%`
                        : "—"}
                    </span>
                    <span
                      className={cn(
                        "text-xs tabular-nums w-14",
                        (sec.growthPct ?? 0) >= 0
                          ? "text-primary"
                          : "text-destructive"
                      )}
                    >
                      {sec.growthPct != null
                        ? `${sec.growthPct >= 0 ? "+" : ""}${sec.growthPct.toFixed(0)}%`
                        : "—"}
                    </span>
                    {hasFundamentals && (
                      <>
                        <span
                          className={cn(
                            "text-xs tabular-nums w-16",
                            fund?.dividend_cagr_5y != null && fund.dividend_cagr_5y >= 0
                              ? "text-primary"
                              : "text-destructive"
                          )}
                        >
                          {fund?.dividend_cagr_5y != null
                            ? `${(fund.dividend_cagr_5y * 100).toFixed(1)}%`
                            : "—"}
                        </span>
                        <span
                          className={cn(
                            "text-xs tabular-nums w-16",
                            fund?.payout_ratio != null && fund.payout_ratio > 1
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {fund?.payout_ratio != null
                            ? `${(fund.payout_ratio * 100).toFixed(0)}%`
                            : "—"}
                        </span>
                      </>
                    )}
                    <span className="text-xs tabular-nums text-muted-foreground w-10">
                      {sec.incomeShare.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {!hasFundamentals && (
            <p className="text-xs text-muted-foreground mt-3 italic">
              Klik "Fundamentele data ophalen" voor 5y CAGR, payout ratio en meer.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sector breakdown */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Sectorverdeling dividend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.sectorBreakdown.map((s) => (
                <div key={s.sector}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{s.sector}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.pct.toFixed(0)}% · {fmt(s.amount)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(s.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 5-year projection */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Inkomensprognose (5 jaar)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={projectionData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tickFormatter={(v) => formatEur(v)}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  width={70}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    formatEur(v),
                    name === "base"
                      ? "Basis"
                      : name === "optimistic"
                        ? "Optimistisch"
                        : "Conservatief",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="optimistic"
                  fill="hsl(142, 60%, 45%)"
                  fillOpacity={0.08}
                  stroke="hsl(142, 60%, 45%)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  name="optimistic"
                />
                <Area
                  type="monotone"
                  dataKey="base"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.15}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="base"
                />
                <Area
                  type="monotone"
                  dataKey="conservative"
                  fill="hsl(0, 60%, 45%)"
                  fillOpacity={0.08}
                  stroke="hsl(0, 60%, 45%)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  name="conservative"
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              Gebaseerd op historische dividendgroei. Optimistisch: 1.5×
              groeirate, conservatief: 0.5× groeirate.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
