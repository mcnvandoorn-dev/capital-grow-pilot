import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { BreakdownChart } from "@/components/breakdown/BreakdownChart";
import { PositionWeightsTable } from "@/components/breakdown/PositionWeightsTable";
import { BreakdownInsights } from "@/components/breakdown/BreakdownInsights";
import { LookThroughDashboard } from "@/components/breakdown/LookThroughDashboard";
import { usePortfolios, usePositions } from "@/hooks/usePortfolioData";
import { usePortfolioBreakdown } from "@/hooks/usePortfolioBreakdown";
import { usePrivateInvestments } from "@/hooks/usePrivateInvestments";
import { PieChart, BarChart3 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type FilterMode = "all" | "public" | "private";

export default function PortfolioBreakdown() {
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios();
  const portfolioIds = useMemo(
    () => (portfolios ?? []).map((p) => p.id),
    [portfolios]
  );
  const { data: positions, isLoading: loadingPositions } = usePositions(portfolioIds);
  const { data: privateInvestments, isLoading: loadingPrivate } = usePrivateInvestments();

  const isLoading = loadingPortfolios || loadingPositions || loadingPrivate;

  // Apply filter
  const filteredPositions = filter === "private" ? [] : (positions ?? []);
  const filteredPrivate = filter === "public" ? [] : (privateInvestments ?? []);

  const hasData = (filteredPositions.length ?? 0) > 0 || (filteredPrivate.length ?? 0) > 0;

  const {
    assetTypeBreakdown,
    sectorBreakdown,
    regionBreakdown,
    countryBreakdown,
    currencyBreakdown,
    dividendVsGrowth,
    positionWeights,
  } = usePortfolioBreakdown(
    filteredPositions.length > 0 ? filteredPositions : undefined,
    filteredPrivate.length > 0 ? filteredPrivate : undefined
  );

  if (isLoading) {
    return (
      <AppLayout title="Portfolio Breakdown" subtitle="Gedetailleerde portefeuilleanalyse">
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-[200px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!hasData) {
    return (
      <AppLayout title="Portfolio Breakdown" subtitle="Gedetailleerde portefeuilleanalyse">
        <EmptyState
          icon={PieChart}
          title="Geen posities"
          description="Voeg posities toe aan je portfolio om de breakdown te bekijken."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Portfolio Breakdown" subtitle="Gedetailleerde portefeuilleanalyse">
      {/* Filter toggle */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Toon:</span>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as FilterMode)}
          className="bg-muted rounded-lg p-0.5"
        >
          <ToggleGroupItem value="all" className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">
            Alles
          </ToggleGroupItem>
          <ToggleGroupItem value="public" className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">
            Publiek
          </ToggleGroupItem>
          <ToggleGroupItem value="private" className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">
            Privaat
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Main breakdown charts */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Asset Type Verdeling</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownChart data={assetTypeBreakdown} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Sectorverdeling</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownChart data={sectorBreakdown} variant="bar" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Geografische Spreiding</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="region">
              <TabsList className="mb-3">
                <TabsTrigger value="region">Regio</TabsTrigger>
                <TabsTrigger value="country">Land</TabsTrigger>
              </TabsList>
              <TabsContent value="region">
                <BreakdownChart data={regionBreakdown} />
              </TabsContent>
              <TabsContent value="country">
                <BreakdownChart data={countryBreakdown} variant="bar" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Valutablootstelling</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownChart data={currencyBreakdown} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Dividend vs Groei</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownChart data={dividendVsGrowth} />
          </CardContent>
        </Card>
      </div>

      {/* Position weights */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Gewicht per Positie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PositionWeightsTable positions={positionWeights} />
        </CardContent>
      </Card>

      {/* Look-Through Exposure Engine — only for public positions */}
      {filteredPositions.length > 0 && (
        <LookThroughDashboard positions={filteredPositions} />
      )}

      {/* AI Insights */}
      <div className="mt-6">
        <BreakdownInsights
          data={{
            assetType: assetTypeBreakdown,
            sector: sectorBreakdown,
            region: regionBreakdown,
            currency: currencyBreakdown,
            dividendVsGrowth,
            topPositions: positionWeights,
          }}
        />
      </div>
    </AppLayout>
  );
}
