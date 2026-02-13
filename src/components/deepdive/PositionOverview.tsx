import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TickerDetail } from "@/hooks/useTickerDetail";

function fmt(value: number | null, opts?: { style?: string; suffix?: string }) {
  if (value === null || value === undefined) return "—";
  if (opts?.style === "currency") {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(value);
  }
  if (opts?.suffix === "%") return `${value.toFixed(2)}%`;
  return value.toFixed(2);
}

interface PositionOverviewProps {
  detail: TickerDetail;
}

export function PositionOverview({ detail }: PositionOverviewProps) {
  const { security, position, marketPrice, marketValue, unrealizedPnl, unrealizedPnlPct } = detail;

  const metrics = [
    { label: "Aantal", value: position.quantity.toString() },
    { label: "Gem. kostprijs", value: fmt(position.avg_cost_basis, { style: "currency" }) },
    { label: "Totale kostprijs", value: fmt(position.total_cost_basis, { style: "currency" }) },
    { label: "Huidige koers", value: fmt(marketPrice, { style: "currency" }) },
    { label: "Marktwaarde", value: fmt(marketValue, { style: "currency" }) },
    {
      label: "Ongerealiseerd P/L",
      value: `${fmt(unrealizedPnl, { style: "currency" })} (${fmt(unrealizedPnlPct, { suffix: "%" })})`,
      highlight: unrealizedPnl !== null ? (unrealizedPnl >= 0 ? "positive" : "negative") : undefined,
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Positie Overzicht</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{security.asset_class}</Badge>
            {security.sector && <Badge variant="outline">{security.sector}</Badge>}
            {security.industry && <Badge variant="outline">{security.industry}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <p
                className={`text-sm font-semibold tabular-nums ${
                  m.highlight === "positive"
                    ? "text-green-600 dark:text-green-400"
                    : m.highlight === "negative"
                    ? "text-red-600 dark:text-red-400"
                    : ""
                }`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Security metadata */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {security.exchange && <span>Exchange: {security.exchange}</span>}
          <span>Valuta: {security.currency}</span>
          {security.isin && <span>ISIN: {security.isin}</span>}
          {security.dividend_frequency && <span>Div. frequentie: {security.dividend_frequency}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
