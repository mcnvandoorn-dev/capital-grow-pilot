import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

function formatEur(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PerformanceChart() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["performance-chart", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_account_summary")
        .select("date, net_liquidation, cash_balance")
        .order("date", { ascending: true });

      if (error) throw error;
      return (data ?? []).map((d) => ({
        date: d.date,
        label: new Date(d.date).toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "short",
        }),
        value: d.net_liquidation,
        cash: d.cash_balance,
      }));
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (!data || data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          Performance wordt zichtbaar na meerdere dagen data (automatische sync om 06:00 UTC)
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <YAxis
          tickFormatter={(v) => formatEur(v)}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          width={80}
        />
        <Tooltip
          formatter={(value: number) => [formatEur(value), "Net Liquidation"]}
          labelFormatter={(label) => label}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(220, 60%, 45%)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
