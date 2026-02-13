import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIbkrDaily, IbkrDailyTrade } from "@/hooks/useIbkrDaily";
import { Activity, DollarSign, Wallet } from "lucide-react";

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function IbkrDailyWidget() {
  const { data, isLoading, error } = useIbkrDaily();

  if (error) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            IBKR Dagoverzicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Geen data beschikbaar. De eerste sync vindt plaats om 06:00 UTC.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">IBKR Dagoverzicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.netLiquidation === null && data.trades.length === 0)) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            IBKR Dagoverzicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nog geen dagelijkse IBKR data. De automatische sync draait elke dag om 06:00 UTC.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            IBKR Dagoverzicht
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {data.date}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Net Liquidation</p>
              <p className="text-sm font-semibold">{formatCurrency(data.netLiquidation)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Cash Balance</p>
              <p className="text-sm font-semibold">{formatCurrency(data.cashBalance)}</p>
            </div>
          </div>
        </div>

        {/* Trades table */}
        {data.trades.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Trades ({data.trades.length})</h4>
            <div className="rounded-md border max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Symbol</TableHead>
                    <TableHead className="text-xs">Side</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs text-right">Prijs</TableHead>
                    <TableHead className="text-xs text-right">P/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trades.map((trade: IbkrDailyTrade, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant={trade.side === "BUY" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">{trade.quantity}</TableCell>
                      <TableCell className="text-xs text-right">
                        {formatCurrency(trade.price)}
                      </TableCell>
                      <TableCell
                        className={`text-xs text-right ${
                          trade.realizedPnl !== null && trade.realizedPnl > 0
                            ? "text-green-600"
                            : trade.realizedPnl !== null && trade.realizedPnl < 0
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {trade.realizedPnl !== null ? formatCurrency(trade.realizedPnl) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
