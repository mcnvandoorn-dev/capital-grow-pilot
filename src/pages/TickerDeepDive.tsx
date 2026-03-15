import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PositionOverview } from "@/components/deepdive/PositionOverview";
import { PriceChart } from "@/components/deepdive/PriceChart";
import { DividendHistorySection } from "@/components/deepdive/DividendHistorySection";
import { DeepDiveTab } from "@/components/deepdive/DeepDiveTab";
import { TickerInsights } from "@/components/deepdive/TickerInsights";
import { ScoreBadge } from "@/components/dashboard/ScoreBadge";
import { usePortfolios, usePositions } from "@/hooks/usePortfolioData";
import { useTickerDetail } from "@/hooks/useTickerDetail";
import { usePortfolioBreakdown } from "@/hooks/usePortfolioBreakdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(v);
}

export default function TickerDeepDive() {
  const [searchParams] = useSearchParams();
  const securityFromUrl = searchParams.get("security") || undefined;

  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios();
  const portfolioIds = useMemo(
    () => (portfolios ?? []).map((p) => p.id),
    [portfolios]
  );
  const { data: positions, isLoading: loadingPositions } = usePositions(portfolioIds);
  const { positionWeights } = usePortfolioBreakdown(positions ?? undefined);

  const [selectedSecurityId, setSelectedSecurityId] = useState<string | undefined>(securityFromUrl);
  const [autoAnalysisTriggered, setAutoAnalysisTriggered] = useState(false);

  // Sync URL param to state when it changes
  useEffect(() => {
    if (securityFromUrl && securityFromUrl !== selectedSecurityId) {
      setSelectedSecurityId(securityFromUrl);
      setAutoAnalysisTriggered(false);
    }
  }, [securityFromUrl]);

  const { data: detail, isLoading: loadingDetail } = useTickerDetail(
    selectedSecurityId,
    portfolioIds
  );

  const isLoading = loadingPortfolios || loadingPositions;
  const hasPositions = (positions?.length ?? 0) > 0;

  // Sorted list of tickers for the selector
  const tickerOptions = useMemo(
    () =>
      (positions ?? [])
        .map((p) => ({
          securityId: p.security_id,
          ticker: p.security.ticker,
          name: p.security.name,
          assetClass: p.security.asset_class,
        }))
        .sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [positions]
  );

  if (isLoading) {
    return (
      <AppLayout title="Ticker Deep Dive" subtitle="Diepgaande analyse per ticker">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPositions) {
    return (
      <AppLayout title="Ticker Deep Dive" subtitle="Diepgaande analyse per ticker">
        <EmptyState
          icon={Search}
          title="Geen posities"
          description="Voeg posities toe aan je portfolio om een ticker deep dive te starten."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Ticker Deep Dive" subtitle="Diepgaande analyse per ticker">
      {/* Ticker selector */}
      <div className="mb-6">
        <Select value={selectedSecurityId} onValueChange={setSelectedSecurityId}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Selecteer een ticker uit je portfolio..." />
          </SelectTrigger>
          <SelectContent>
            {tickerOptions.map((opt) => (
              <SelectItem key={opt.securityId} value={opt.securityId}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{opt.ticker}</span>
                  <span className="text-muted-foreground text-xs">
                    {opt.name ? `— ${opt.name}` : ""}
                  </span>
                  <Badge variant="outline" className="text-xs ml-1">
                    {opt.assetClass}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSecurityId && (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Selecteer een ticker hierboven om de deep dive analyse te starten.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedSecurityId && loadingDetail && (
        <div className="space-y-6">
          <Skeleton className="h-[180px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {selectedSecurityId && detail && !loadingDetail && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overzicht</TabsTrigger>
            <TabsTrigger value="dividends">Dividenden</TabsTrigger>
            <TabsTrigger value="transactions">Transacties</TabsTrigger>
            <TabsTrigger value="documents">Documenten</TabsTrigger>
            <TabsTrigger value="ai-insights">AI Analyse</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <PositionOverview detail={detail} />
            <PriceChart data={detail.priceHistory} ticker={detail.security.ticker} />

            {/* Scores */}
            {detail.scores && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Totaal</p>
                      <ScoreBadge score={detail.scores.total_score} size="md" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Technisch</p>
                      <ScoreBadge score={detail.scores.technical_score} size="md" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Fundamenteel</p>
                      <ScoreBadge score={detail.scores.fundamental_score} size="md" />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: "RSI", score: detail.scores.rsi_score },
                      { label: "52w Positie", score: detail.scores.range_52w_score },
                      { label: "P/E Ratio", score: detail.scores.pe_score },
                      { label: "Payout Ratio", score: detail.scores.payout_score },
                      { label: "Div. CAGR", score: detail.scores.dividend_cagr_score },
                      { label: "Revenue Growth", score: detail.scores.revenue_growth_score },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border p-2.5">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <ScoreBadge score={item.score} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fundamentals grid */}
            {detail.fundamentals && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Fundamentele Indicatoren</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "P/E Ratio", value: detail.fundamentals.pe_ratio?.toFixed(1) },
                      { label: "Dividend Yield", value: detail.fundamentals.dividend_yield != null ? `${(detail.fundamentals.dividend_yield * 100).toFixed(2)}%` : null },
                      { label: "Payout Ratio", value: detail.fundamentals.payout_ratio != null ? `${detail.fundamentals.payout_ratio.toFixed(1)}%` : null },
                      { label: "Div. CAGR 5j", value: detail.fundamentals.dividend_cagr_5y != null ? `${(detail.fundamentals.dividend_cagr_5y * 100).toFixed(1)}%` : null },
                      { label: "Revenue Growth 3j", value: detail.fundamentals.revenue_growth_3y != null ? `${(detail.fundamentals.revenue_growth_3y * 100).toFixed(1)}%` : null },
                      { label: "Revenue Growth 5j", value: detail.fundamentals.revenue_growth_5y != null ? `${(detail.fundamentals.revenue_growth_5y * 100).toFixed(1)}%` : null },
                      { label: "Earnings Growth 3j", value: detail.fundamentals.earnings_growth_3y != null ? `${(detail.fundamentals.earnings_growth_3y * 100).toFixed(1)}%` : null },
                      { label: "Earnings Growth 5j", value: detail.fundamentals.earnings_growth_5y != null ? `${(detail.fundamentals.earnings_growth_5y * 100).toFixed(1)}%` : null },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{item.value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="dividends">
            <DividendHistorySection
              dividends={detail.dividends}
              fundamentals={detail.fundamentals}
            />
          </TabsContent>

          <TabsContent value="transactions">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Transactiehistorie</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Geen transacties voor {detail.security.ticker}.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Aantal</TableHead>
                        <TableHead className="text-right">Prijs</TableHead>
                        <TableHead className="text-right">Bedrag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.transactions.map((tx, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">
                            {new Date(tx.trade_date).toLocaleDateString("nl-NL")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={tx.transaction_type === "BUY" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {tx.transaction_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {tx.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatCurrency(tx.price)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatCurrency(tx.net_amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <DeepDiveTab securityId={detail.security.id} ticker={detail.security.ticker} />
          </TabsContent>

          <TabsContent value="ai-insights">
            <TickerInsights detail={detail} portfolioHoldings={positionWeights} />
          </TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
}
