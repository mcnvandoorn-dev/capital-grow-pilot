import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Layers,
  RefreshCw,
  Globe,
  Shield,
  TrendingUp,
  Building2,
  AlertTriangle,
} from "lucide-react";
import type { PositionWithDetails } from "@/hooks/usePortfolioData";
import {
  useLookThroughExposures,
  useGenerateExposures,
  type ExposureSlice,
} from "@/hooks/useLookThrough";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#06b6d4",
  "#84cc16",
  "#eab308",
  "#ef4444",
  "#a855f7",
];

function ExposureBarChart({ data }: { data: ExposureSlice[] }) {
  const chartData = data.slice(0, 15).map((d) => ({
    name: d.label.length > 25 ? d.label.slice(0, 22) + "..." : d.label,
    fullName: d.label,
    value: Math.round(d.weight * 100) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(2)}%`, "Exposure"]}
          labelFormatter={(label, payload) =>
            payload?.[0]?.payload?.fullName ?? label
          }
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ExposurePieChart({ data }: { data: ExposureSlice[] }) {
  const chartData = data.map((d) => ({
    name: d.label,
    value: Math.round(d.weight * 100) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, value }) =>
            value > 3 ? `${name} ${value.toFixed(1)}%` : ""
          }
          labelLine={false}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, "Exposure"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TopExposuresTable({
  data,
}: {
  data: { label: string; weight: number; tickers: string[] }[];
}) {
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div
          key={item.label}
          className="flex items-center justify-between py-2 border-b border-border last:border-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-mono text-muted-foreground w-5">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">
                {item.tickers.slice(0, 5).join(", ")}
                {item.tickers.length > 5 && ` +${item.tickers.length - 5}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Progress value={item.weight} className="w-20 h-2" />
            <span className="text-sm font-mono w-14 text-right">
              {item.weight.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LookThroughDashboard({
  positions,
}: {
  positions: PositionWithDetails[];
}) {
  const { data: lookThrough, isLoading, hasData } = useLookThroughExposures(positions);
  const generateMutation = useGenerateExposures();

  const handleGenerate = () => {
    const securities = positions.map((p) => ({
      security_id: p.security_id,
      ticker: p.security.ticker,
      name: p.security.name,
      asset_class: p.security.asset_class,
      sector: p.security.sector,
      industry: null as string | null,
    }));
    generateMutation.mutate(securities);
  };

  const isGenerating = generateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold">
                Look-Through Exposure Engine
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Institutional Grade
              </Badge>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="sm"
            >
              {isGenerating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              {hasData ? "Vernieuwen" : "Analyseer Portfolio"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isGenerating && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                AI analyseert {positions.length} posities op revenue segmentatie,
                geografische exposure en risicoprofielen...
              </p>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          )}

          {generateMutation.isError && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : "Analyse mislukt"}
              </p>
            </div>
          )}

          {!isGenerating && !hasData && !generateMutation.isError && (
            <p className="text-sm text-muted-foreground">
              Klik op "Analyseer Portfolio" om de economische look-through exposure
              van je portefeuille te berekenen. De engine analyseert revenue
              segmentatie, geografische spreiding, kapitaalstructuur en
              risicobuckets per positie.
            </p>
          )}

          {hasData && !isGenerating && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">
                  Dekking: {lookThrough.coveragePercent.toFixed(0)}% van portfolio
                </span>
              </div>
              <span className="text-muted-foreground">
                {lookThrough.revenueExposure.length} revenue segmenten
              </span>
              <span className="text-muted-foreground">
                {lookThrough.geographicExposure.length} landen/regio's
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {hasData && !isGenerating && (
        <>
          {/* Top 25 Economic Exposures */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top 25 Economische Exposures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TopExposuresTable data={lookThrough.topEconomicExposures} />
            </CardContent>
          </Card>

          {/* Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Revenue Segmentation */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Revenue Exposure (Look-through)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExposureBarChart data={lookThrough.revenueExposure} />
              </CardContent>
            </Card>

            {/* Geographic */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Geografische Exposure (Revenue-based)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExposureBarChart data={lookThrough.geographicExposure} />
              </CardContent>
            </Card>

            {/* Risk Buckets */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Risk Concentration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExposurePieChart data={lookThrough.riskBuckets} />
              </CardContent>
            </Card>

            {/* Capital Structure */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Kapitaalstructuur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExposurePieChart data={lookThrough.capitalStructure} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
