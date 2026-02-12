import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitCompare, TrendingUp, RefreshCw, Wallet } from "lucide-react";

const Strategies = () => {
  return (
    <AppLayout title="Strategieën" subtitle="Vergelijk Buy & Hold met Working Capital Growth">
      {/* Strategy tabs */}
      <Tabs defaultValue="comparison" className="space-y-6">
        <TabsList>
          <TabsTrigger value="comparison">Vergelijking</TabsTrigger>
          <TabsTrigger value="buyhold">Buy & Hold</TabsTrigger>
          <TabsTrigger value="wcg">Working Capital Growth</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison">
          {/* Side-by-side KPI comparison */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Buy & Hold column */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-1" />
                  Buy & Hold
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Totale waarde</p>
                    <p className="text-lg font-semibold tabular-nums">€ 0,00</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Totaal rendement</p>
                    <p className="text-lg font-semibold tabular-nums">0,00%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Dividend ontvangen</p>
                    <p className="text-lg font-semibold tabular-nums">€ 0,00</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Posities</p>
                    <p className="text-lg font-semibold tabular-nums">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Working Capital Growth column */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-chart-2" />
                  Working Capital Growth
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Totale waarde</p>
                    <p className="text-lg font-semibold tabular-nums">€ 0,00</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Gerealiseerde winst</p>
                    <p className="text-lg font-semibold tabular-nums">€ 0,00</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Capital events</p>
                    <p className="text-lg font-semibold tabular-nums">0</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Gem. winst %</p>
                    <p className="text-lg font-semibold tabular-nums">0,00%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined performance chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Rendementsvergelijking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-52 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  Vergelijkingsgrafiek verschijnt bij voldoende data in beide strategieën
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buyhold">
          <EmptyState
            icon={TrendingUp}
            title="Geen Buy & Hold portfolio's"
            description="Maak een portfolio met de Buy & Hold strategie om hier gegevens te zien."
          />
        </TabsContent>

        <TabsContent value="wcg">
          {/* Capital events timeline */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Capital Events</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={RefreshCw}
                title="Geen capital events"
                description="Verkoop- en herinvesteringstransacties verschijnen hier wanneer ze worden gekoppeld."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Strategies;
