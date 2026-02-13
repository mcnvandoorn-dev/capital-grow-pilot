import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PriceChartProps {
  data: { date: string; price: number }[];
  ticker: string;
}

export function PriceChart({ data, ticker }: PriceChartProps) {
  if (data.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Koersverloop</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Geen koersdata beschikbaar voor {ticker}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Koersverloop</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) =>
                new Date(d).toLocaleDateString("nl-NL", { month: "short", year: "2-digit" })
              }
              className="text-xs"
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              className="text-xs"
              width={55}
            />
            <Tooltip
              labelFormatter={(d) =>
                new Date(d).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              }
              formatter={(value: number) => [
                `$${value.toFixed(2)}`,
                "Koers",
              ]}
              contentStyle={{ fontSize: "0.75rem" }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(220, 60%, 45%)"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
