import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Activity } from "lucide-react";

function formatEur(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

type Period = "1M" | "3M" | "YTD" | "1Y" | "ALL";

function getStartDate(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "1M":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3M":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "YTD":
      return new Date(now.getFullYear(), 0, 1);
    case "1Y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "ALL":
      return null;
  }
}

interface PerformanceMetrics {
  twr: number;
  cagr: number;
  maxDrawdown: number;
  volatility: number;
  startValue: number;
  endValue: number;
  dayCount: number;
}

function computeMetrics(
  data: { date: string; value: number }[]
): PerformanceMetrics | null {
  if (data.length < 2) return null;

  const startValue = data[0].value;
  const endValue = data[data.length - 1].value;

  // TWR (simple, no cashflow adjustment)
  const twr = ((endValue - startValue) / startValue) * 100;

  // CAGR
  const startDate = new Date(data[0].date);
  const endDate = new Date(data[data.length - 1].date);
  const dayCount = Math.max(
    1,
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const years = dayCount / 365.25;
  const cagr =
    years > 0 ? (Math.pow(endValue / startValue, 1 / years) - 1) * 100 : 0;

  // Max drawdown
  let peak = data[0].value;
  let maxDrawdown = 0;
  for (const d of data) {
    if (d.value > peak) peak = d.value;
    const drawdown = ((peak - d.value) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Volatility (annualized std dev of daily returns)
  const returns: number[] = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1].value > 0) {
      returns.push((data[i].value - data[i - 1].value) / data[i - 1].value);
    }
  }
  let volatility = 0;
  if (returns.length > 1) {
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance =
      returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) /
      (returns.length - 1);
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  return { twr, cagr, maxDrawdown, volatility, startValue, endValue, dayCount };
}

export function PerformanceChart() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("ALL");

  const { data: allData, isLoading } = useQuery({
    queryKey: ["performance-chart", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_account_summary")
        .select("date, net_liquidation, cash_balance")
        .order("date", { ascending: true });

      if (error) throw error;
      return (data ?? []).map((d) => ({
        date: d.date,
        label: new Date(d.date).toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "short",
        }),
        value: d.net_liquidation,
        cash: d.cash_balance,
      }));
    },
    enabled: !!user,
  });

  // Filter data by period
  const data = useMemo(() => {
    if (!allData) return [];
    const startDate = getStartDate(period);
    if (!startDate) return allData;
    const startStr = startDate.toISOString().split("T")[0];
    return allData.filter((d) => d.date >= startStr);
  }, [allData, period]);

  const metrics = useMemo(() => computeMetrics(data), [data]);

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (!allData || allData.length < 2) {
    return (
      <div className="space-y-4">
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center px-6">
            <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">
              Performance wordt opgebouwd
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              De dagelijkse sync slaat elke dag je Net Liquidation Value op.
              Na meerdere dagen data verschijnen hier je performance metrics
              (TWR, CAGR, drawdown, volatility).
            </p>
            {allData && allData.length === 1 && (
              <p className="text-xs text-muted-foreground mt-2">
                Huidige data: {allData.length} dag ({allData[0].label}) —{" "}
                {formatEur(allData[0].value)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const periods: Period[] = ["1M", "3M", "YTD", "1Y", "ALL"];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-1">
        {periods.map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setPeriod(p)}
          >
            {p}
          </Button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => formatEur(v)}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            width={80}
          />
          <Tooltip
            formatter={(value: number) => [formatEur(value), "Net Liquidation"]}
            labelFormatter={(label) => label}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Metrics row */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            icon={TrendingUp}
            label="TWR"
            value={formatPct(metrics.twr)}
            positive={metrics.twr >= 0}
          />
          <MetricCard
            icon={Activity}
            label="CAGR"
            value={formatPct(metrics.cagr)}
            positive={metrics.cagr >= 0}
          />
          <MetricCard
            icon={TrendingDown}
            label="Max Drawdown"
            value={`-${metrics.maxDrawdown.toFixed(2)}%`}
            positive={metrics.maxDrawdown < 5}
          />
          <MetricCard
            icon={BarChart3}
            label="Volatiliteit"
            value={`${metrics.volatility.toFixed(1)}%`}
            positive={metrics.volatility < 15}
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  positive,
}: {
  icon: any;
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          positive ? "text-primary" : "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}
