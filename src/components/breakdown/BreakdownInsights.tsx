import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { BreakdownSlice, PositionWeight } from "@/hooks/usePortfolioBreakdown";

interface InsightsData {
  assetType: BreakdownSlice[];
  sector: BreakdownSlice[];
  region: BreakdownSlice[];
  currency: BreakdownSlice[];
  dividendVsGrowth: BreakdownSlice[];
  topPositions: PositionWeight[];
}

export function BreakdownInsights({ data }: { data: InsightsData }) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "portfolio-insights",
        {
          body: {
            assetType: data.assetType,
            sector: data.sector,
            region: data.region,
            currency: data.currency,
            dividendVsGrowth: data.dividendVsGrowth,
            topPositions: data.topPositions.slice(0, 15),
          },
        }
      );
      if (fnError) throw fnError;
      setInsights(result.insights);
    } catch (e: any) {
      console.error("Insights error:", e);
      setError(e.message ?? "Er is een fout opgetreden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Portfolio Inzichten
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={generateInsights}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {insights ? "Vernieuwen" : "Analyseer"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/6" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && !insights && (
          <p className="text-sm text-muted-foreground">
            Klik op "Analyseer" om AI-gegenereerde inzichten over je portefeuille te ontvangen,
            inclusief concentratierisico's, sector-onevenwichtigheden en geografische blootstelling.
          </p>
        )}

        {!loading && insights && (
          <div className="prose prose-sm max-w-none text-foreground">
            {insights.split("\n").map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              if (line.startsWith("##")) {
                return (
                  <h3 key={i} className="text-sm font-semibold mt-3 mb-1">
                    {line.replace(/^#+\s*/, "")}
                  </h3>
                );
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <p key={i} className="text-sm text-muted-foreground ml-2 mb-0.5">
                    • {line.slice(2)}
                  </p>
                );
              }
              return (
                <p key={i} className="text-sm text-muted-foreground mb-1">
                  {line}
                </p>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
