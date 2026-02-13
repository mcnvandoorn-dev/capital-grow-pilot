import { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, RefreshCw, Sprout } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

const Strategies = () => {
  const { user } = useAuth();

  const { data: portfolios } = useQuery({
    queryKey: ["portfolios-strategies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("id, name, strategy, base_currency")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const byStrategy = useMemo(() => {
    const map: Record<string, typeof portfolios> = {
      BUY_AND_HOLD: [],
      DIVIDEND_GROWTH: [],
      WORKING_CAPITAL_GROWTH: [],
    };
    for (const p of portfolios ?? []) {
      (map[p.strategy] ??= []).push(p);
    }
    return map;
  }, [portfolios]);

  return (
    <AppLayout title="Strategieën" subtitle="Bekijk je portfolio's per strategie">
      <Tabs defaultValue="buyhold" className="space-y-6">
        <TabsList>
          <TabsTrigger value="buyhold">Buy & Hold</TabsTrigger>
          <TabsTrigger value="dividend">Dividend Growth</TabsTrigger>
          <TabsTrigger value="wcg">Working Capital Growth</TabsTrigger>
        </TabsList>

        <TabsContent value="buyhold">
          <StrategySection
            icon={TrendingUp}
            title="Buy & Hold"
            portfolios={byStrategy.BUY_AND_HOLD ?? []}
            emptyDescription="Geen portfolio's met de Buy & Hold strategie. Wijs een strategie toe bij het koppelen van een Flex Query in Instellingen."
          />
        </TabsContent>

        <TabsContent value="dividend">
          <StrategySection
            icon={Sprout}
            title="Dividend Growth"
            portfolios={byStrategy.DIVIDEND_GROWTH ?? []}
            emptyDescription="Geen portfolio's met de Dividend Growth strategie. Wijs een strategie toe bij het koppelen van een Flex Query in Instellingen."
          />
        </TabsContent>

        <TabsContent value="wcg">
          <StrategySection
            icon={RefreshCw}
            title="Working Capital Growth"
            portfolios={byStrategy.WORKING_CAPITAL_GROWTH ?? []}
            emptyDescription="Geen portfolio's met de Working Capital Growth strategie. Wijs een strategie toe bij het koppelen van een Flex Query in Instellingen."
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

function StrategySection({
  icon: Icon,
  title,
  portfolios,
  emptyDescription,
}: {
  icon: any;
  title: string;
  portfolios: { id: string; name: string; strategy: string }[];
  emptyDescription: string;
}) {
  if (portfolios.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={`Geen ${title} portfolio's`}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      {portfolios.map((p) => (
        <Card key={p.id} className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {p.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Portfolio details worden hier getoond wanneer er posities zijn.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default Strategies;
