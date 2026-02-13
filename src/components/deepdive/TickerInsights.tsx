import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TickerDetail } from "@/hooks/useTickerDetail";
import type { PositionWeight } from "@/hooks/usePortfolioBreakdown";

interface TickerInsightsProps {
  detail: TickerDetail;
  portfolioHoldings: PositionWeight[];
}

export function TickerInsights({ detail, portfolioHoldings }: TickerInsightsProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ticker-insights", {
        body: {
          ticker: detail.security.ticker,
          name: detail.security.name,
          assetClass: detail.security.asset_class,
          sector: detail.security.sector,
          industry: detail.security.industry,
          fundamentals: detail.fundamentals,
          scores: detail.scores,
          dividendCount: detail.dividends.length,
          rocCount: detail.dividends.filter((d) => d.is_roc).length,
          position: {
            quantity: detail.position.quantity,
            marketValue: detail.marketValue,
            unrealizedPnlPct: detail.unrealizedPnlPct,
          },
          portfolioHoldings: portfolioHoldings.slice(0, 20).map((h) => ({
            ticker: h.ticker,
            assetClass: h.assetClass,
            sector: h.sector,
            percentage: h.percentage,
          })),
        },
      });
      if (fnError) throw fnError;
      setInsights(data.insights);
    } catch (e: any) {
      setError(e.message ?? "Fout bij het genereren van inzichten");
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
            AI Ticker Analyse
          </CardTitle>
          <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
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
            Klik op "Analyseer" voor AI-inzichten over risicofactoren, dividendduurzaamheid,
            structurele zwaktes en overlap met andere holdings in je portefeuille.
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
