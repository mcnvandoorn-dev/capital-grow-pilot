import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ScoreBadge } from "@/components/dashboard/ScoreBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  ShoppingCart,
  FileBarChart,
} from "lucide-react";

const StockDetail = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <AppLayout
      title="Bedrijfsdetails"
      subtitle="Ticker · Exchange"
      actions={
        <Button size="sm">
          <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
          Kopen
        </Button>
      }
    >
      {/* Score overview bar */}
      <Card className="mb-6 shadow-sm">
        <CardContent className="flex items-center gap-8 p-5">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Totaalscore</p>
            <ScoreBadge score={null} size="md" />
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Technisch</p>
            <ScoreBadge score={null} size="md" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Fundamenteel</p>
            <ScoreBadge score={null} size="md" />
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">RSI</p>
              <p className="text-sm font-medium tabular-nums">—</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">P/E</p>
              <p className="text-sm font-medium tabular-nums">—</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Div. Yield</p>
              <p className="text-sm font-medium tabular-nums">—</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard label="Huidige koers" value="—" icon={DollarSign} />
        <KpiCard label="52w bereik" value="— / —" icon={TrendingUp} />
        <KpiCard label="Payout ratio" value="—" icon={BarChart3} />
        <KpiCard label="Div. CAGR 5j" value="—" icon={FileBarChart} />
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="fundamentals">Fundamenteel</TabsTrigger>
          <TabsTrigger value="transactions">Transacties</TabsTrigger>
          <TabsTrigger value="dividends">Dividenden</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Price chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Koersverloop</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">
                    Grafiek verschijnt bij beschikbare koersdata
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Score breakdown */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Score breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "RSI", score: null },
                    { label: "52w Positie", score: null },
                    { label: "P/E Ratio", score: null },
                    { label: "Payout Ratio", score: null },
                    { label: "Div. CAGR", score: null },
                    { label: "Revenue Growth", score: null },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-muted-foreground">
                        {item.label}
                      </span>
                      <ScoreBadge score={item.score} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fundamentals">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Fundamentele indicatoren</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "P/E Ratio", value: "—" },
                  { label: "Dividend Yield", value: "—" },
                  { label: "Payout Ratio", value: "—" },
                  { label: "Dividend CAGR (5j)", value: "—" },
                  { label: "Revenue Growth (3j)", value: "—" },
                  { label: "Revenue Growth (5j)", value: "—" },
                  { label: "Earnings Growth (3j)", value: "—" },
                  { label: "Earnings Growth (5j)", value: "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-lg font-semibold tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Transactiehistorie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                Geen transacties voor dit bedrijf.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dividends">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Dividendhistorie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                Geen dividenddata voor dit bedrijf.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default StockDetail;
