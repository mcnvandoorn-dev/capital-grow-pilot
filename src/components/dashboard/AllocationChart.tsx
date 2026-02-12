import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { PositionWithDetails } from "@/hooks/usePortfolioData";

interface AllocationChartProps {
  positions: PositionWithDetails[];
}

const COLORS = [
  "hsl(220, 60%, 45%)",
  "hsl(152, 50%, 45%)",
  "hsl(38, 80%, 55%)",
  "hsl(280, 40%, 55%)",
  "hsl(190, 60%, 45%)",
  "hsl(350, 50%, 55%)",
  "hsl(80, 50%, 45%)",
  "hsl(30, 70%, 50%)",
];

export function AllocationChart({ positions }: AllocationChartProps) {
  // Group by asset class
  const grouped = positions.reduce<Record<string, number>>((acc, pos) => {
    const key = pos.security.asset_class;
    acc[key] = (acc[key] ?? 0) + (pos.market_value ?? pos.total_cost_basis);
    return acc;
  }, {});

  const data = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) =>
              new Intl.NumberFormat("nl-NL", {
                style: "currency",
                currency: "EUR",
              }).format(value)
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground">{item.name}</span>
            </div>
            <span className="tabular-nums font-medium">
              {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
