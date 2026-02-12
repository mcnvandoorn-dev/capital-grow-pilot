import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/EmptyState";
import {
  DollarSign,
  TrendingUp,
  PieChart,
  Wallet,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <AppLayout title="Portfolio" subtitle="Overzicht van je beleggingen">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard
          label="Totale waarde"
          value="€ 0,00"
          icon={DollarSign}
        />
        <KpiCard
          label="Dagrendement"
          value="€ 0,00"
          change="0,00%"
          changeType="neutral"
          icon={TrendingUp}
        />
        <KpiCard
          label="Dividend YTD"
          value="€ 0,00"
          icon={Wallet}
        />
        <KpiCard
          label="Posities"
          value="0"
          icon={PieChart}
        />
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Holdings — 2/3 width */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Posities</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={LayoutDashboard}
              title="Geen posities"
              description="Voeg een transactie toe of promoveer een bedrijf vanuit je watchlist om te beginnen."
              action={
                <Button variant="outline" size="sm">
                  Transactie toevoegen
                </Button>
              }
            />
          </CardContent>
        </Card>

        {/* Allocation — 1/3 width */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Verdeling</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={PieChart}
              title="Geen data"
              description="Allocatie wordt getoond zodra je posities hebt."
            />
          </CardContent>
        </Card>
      </div>

      {/* Performance chart */}
      <Card className="mt-6 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Rendementsgrafiek verschijnt bij voldoende data
            </p>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Index;
