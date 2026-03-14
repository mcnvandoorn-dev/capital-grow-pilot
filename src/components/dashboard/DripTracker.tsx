import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolios } from "@/hooks/usePortfolioData";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sprout, TrendingUp, DollarSign } from "lucide-react";

function formatEur(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface MonthlyDividend {
  month: string;        // "2024-01"
  label: string;        // "jan '24"
  amount: number;       // net dividend received (EUR)
  cumulative: number;   // running total
  compounded: number;   // hypothetical compounded value
}

export function DripTracker() {
  const { user } = useAuth();
  const { data: portfolios } = usePortfolios();
  const portfolioIds = useMemo(
    () => (portfolios ?? []).map((p) => p.id),
    [portfolios]
  );

  const { data: dividends, isLoading } = useQuery({
    queryKey: ["drip-dividends", portfolioIds],
    queryFn: async () => {
      if (portfolioIds.length === 0) return [];
      const { data, error } = await supabase
        .from("dividend_history")
        .select("ex_date, net_amount, fx_rate_to_base, security_id")
        .in("portfolio_id", portfolioIds)
        .order("ex_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: portfolioIds.length > 0,
  });

  const chartData = useMemo(() => {
    if (!dividends || dividends.length === 0) return [];

    // Group by month
    const monthMap = new Map<string, number>();
    for (const d of dividends) {
      const month = d.ex_date.substring(0, 7); // "YYYY-MM"
      const eurAmount = d.net_amount * d.fx_rate_to_base;
      monthMap.set(month, (monthMap.get(month) ?? 0) + eurAmount);
    }

    // Sort months and build cumulative + compounded
    const sortedMonths = [...monthMap.keys()].sort();
    const assumedMonthlyYield = 0.006; // ~7.2% annualized reinvestment yield
    let cumulative = 0;
    let compounded = 0;

    const result: MonthlyDividend[] = sortedMonths.map((month) => {
      const amount = monthMap.get(month)!;
      cumulative += amount;

      // Compound: previous compounded value grows, plus new dividend added
      compounded = compounded * (1 + assumedMonthlyYield) + amount;

      const [year, m] = month.split("-");
      const monthNames = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
      const label = `${monthNames[parseInt(m) - 1]} '${year.slice(2)}`;

      return { month, label, amount, cumulative, compounded };
    });

    return result;
  }, [dividends]);

  // Summary stats
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const totalReceived = chartData[chartData.length - 1].cumulative;
    const compoundedValue = chartData[chartData.length - 1].compounded;
    const compoundGain = compoundedValue - totalReceived;
    const monthCount = chartData.length;
    const avgMonthly = totalReceived / monthCount;
    return { totalReceived, compoundedValue, compoundGain, avgMonthly, monthCount };
  }, [chartData]);

  if (isLoading) {
    return <Skeleton className="h-[320px] w-full rounded-lg" />;
  }

  if (!chartData.length) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center px-6">
          <Sprout className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Nog geen dividenden ontvangen</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Zodra je dividenden ontvangt, verschijnt hier je DRIP compound growth tracker.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={DollarSign}
            label="Totaal ontvangen"
            value={formatEur(stats.totalReceived)}
          />
          <StatCard
            icon={Sprout}
            label="Herbelegd waarde"
            value={formatEur(stats.compoundedValue)}
            accent
          />
          <StatCard
            icon={TrendingUp}
            label="Compound winst"
            value={formatEur(stats.compoundGain)}
            accent
          />
          <StatCard
            icon={DollarSign}
            label="Gem. per maand"
            value={formatEur(stats.avgMonthly)}
          />
        </div>
      )}

      {/* Chart tabs */}
      <Tabs defaultValue="compound" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
          <TabsTrigger value="compound">Compound Growth</TabsTrigger>
          <TabsTrigger value="monthly">Maandelijks</TabsTrigger>
        </TabsList>

        <TabsContent value="compound" className="mt-3">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => formatEur(v)}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                width={70}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatEur(value),
                  name === "compounded" ? "Herbelegd (compound)" : "Cumulatief ontvangen",
                ]}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="url(#gradCumulative)"
              />
              <Area
                type="monotone"
                dataKey="compounded"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#gradCompound)"
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1">
            Gestippeld = ontvangen dividend · Doorgetrokken = herbelegde waarde (7,2% jaarlijks aangenomen rendement)
          </p>
        </TabsContent>

        <TabsContent value="monthly" className="mt-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => formatEur(v)}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                width={70}
              />
              <Tooltip
                formatter={(value: number) => [formatEur(value), "Dividend"]}
                labelFormatter={(label) => label}
              />
              <Bar
                dataKey="amount"
                fill="hsl(var(--primary))"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`text-sm font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}
