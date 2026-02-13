import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { BreakdownSlice } from "@/hooks/usePortfolioBreakdown";

const COLORS = [
  "hsl(220, 60%, 45%)",
  "hsl(152, 50%, 45%)",
  "hsl(38, 80%, 55%)",
  "hsl(280, 40%, 55%)",
  "hsl(190, 60%, 45%)",
  "hsl(350, 50%, 55%)",
  "hsl(80, 50%, 45%)",
  "hsl(30, 70%, 50%)",
  "hsl(260, 50%, 50%)",
  "hsl(10, 60%, 50%)",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface BreakdownChartProps {
  data: BreakdownSlice[];
  variant?: "pie" | "bar";
}

export function BreakdownChart({ data, variant = "pie" }: BreakdownChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Geen data beschikbaar
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
            <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} className="text-xs" />
            <YAxis type="category" dataKey="name" width={100} className="text-xs" />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => [
                `${value.toFixed(1)}% — ${formatCurrency(props.payload.value)}`,
                "Gewicht",
              ]}
              contentStyle={{ fontSize: "0.75rem" }}
            />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Legend data={data} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ fontSize: "0.75rem" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <Legend data={data} />
    </div>
  );
}

function Legend({ data }: { data: BreakdownSlice[] }) {
  return (
    <div className="space-y-1.5">
      {data.map((item, i) => (
        <div key={item.name} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground truncate">{item.name}</span>
            <span className="text-muted-foreground/60 text-xs">({item.count})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(item.value)}
            </span>
            <span className="tabular-nums font-medium w-14 text-right">
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
