import type { DividendIntelligence } from "@/hooks/useDividendIntelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

function formatEur(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

interface Props {
  data: DividendIntelligence;
  fmt: (v: number) => string;
}

export function DividendIntelligencePanel({ data, fmt }: Props) {
  if (data.securities.length === 0) return null;

  const projectionData = [
    {
      year: new Date().getFullYear(),
      base: data.totalAnnualIncome,
      optimistic: data.totalAnnualIncome,
      conservative: data.totalAnnualIncome,
    },
    ...data.projectedIncome5y,
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Wallet className="h-4 w-4" /> Dividend Intelligence
      </h3>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">
              Jaarlijks dividend inkomen
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {fmt(data.totalAnnualIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">
              Gewogen yield
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {data.weightedYield != null
                ? `${data.weightedYield.toFixed(2)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">
              Gem. dividendgroei (YoY)
            </p>
            <p
              className={cn(
                "text-xl font-semibold tabular-nums",
                (data.avgGrowthPct ?? 0) >= 0
                  ? "text-primary"
                  : "text-destructive"
              )}
            >
              {data.avgGrowthPct != null
                ? `${data.avgGrowthPct >= 0 ? "+" : ""}${data.avgGrowthPct.toFixed(1)}%`
                : "Onvoldoende data"}
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
        <CardContent>
          {/* Header row */}
          <div className="flex items-center justify-between py-1.5 border-b text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-3">
              <span className="w-16">Ticker</span>
              <span className="w-[180px]">Naam</span>
              <span>Frequentie</span>
            </div>
            <div className="flex items-center gap-4 text-right">
              <span className="w-20">Jaarlijks</span>
              <span className="w-14">Yield</span>
              <span className="w-14">Groei</span>
              <span className="w-10">Aandeel</span>
            </div>
          </div>
          <div className="space-y-0">
            {data.securities.slice(0, 15).map((sec) => (
              <div
                key={sec.securityId}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium w-16">
                    {sec.ticker}
                  </span>
                  <span className="text-sm text-muted-foreground truncate w-[180px]">
                    {sec.name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {sec.frequency}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-right">
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
                  <span className="text-xs tabular-nums text-muted-foreground w-10">
                    {sec.incomeShare.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
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
              Gebaseerd op historische dividendgroei. Optimistisch: 1.5× groeirate, conservatief: 0.5× groeirate.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
