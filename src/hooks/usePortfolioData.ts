import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export function usePortfolios() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portfolios", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export interface PositionWithDetails {
  id: string;
  quantity: number;
  avg_cost_basis: number;
  total_cost_basis: number;
  currency: string;
  portfolio_id: string;
  security_id: string;
  security: {
    id: string;
    ticker: string;
    name: string | null;
    asset_class: string;
    sector: string | null;
    exchange: string | null;
    currency: string;
  };
  market_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
}

export function usePositions(portfolioIds: string[]) {
  return useQuery({
    queryKey: ["positions", portfolioIds],
    queryFn: async () => {
      if (portfolioIds.length === 0) return [];

      // Fetch positions with securities
      const { data: positions, error } = await supabase
        .from("positions")
        .select(`
          *,
          securities (
            id, ticker, name, asset_class, sector, exchange, currency
          )
        `)
        .in("portfolio_id", portfolioIds)
        .gt("quantity", 0);

      if (error) throw error;
      if (!positions || positions.length === 0) return [];

      // Get latest market prices for all securities
      const securityIds = [...new Set(positions.map((p) => p.security_id))];

      const { data: marketData } = await supabase
        .from("market_data")
        .select("security_id, close_price, data_date")
        .in("security_id", securityIds)
        .order("data_date", { ascending: false });

      // Build a map of latest price per security
      const priceMap = new Map<string, number>();
      if (marketData) {
        for (const md of marketData) {
          if (!priceMap.has(md.security_id) && md.close_price !== null) {
            priceMap.set(md.security_id, md.close_price);
          }
        }
      }

      // Enrich positions
      const enriched: PositionWithDetails[] = positions.map((pos) => {
        const sec = pos.securities as any;
        const price = priceMap.get(pos.security_id) ?? null;
        const marketValue = price !== null ? price * pos.quantity : null;
        const unrealizedPnl =
          marketValue !== null ? marketValue - pos.total_cost_basis : null;
        const unrealizedPnlPct =
          unrealizedPnl !== null && pos.total_cost_basis > 0
            ? (unrealizedPnl / pos.total_cost_basis) * 100
            : null;

        return {
          id: pos.id,
          quantity: pos.quantity,
          avg_cost_basis: pos.avg_cost_basis,
          total_cost_basis: pos.total_cost_basis,
          currency: pos.currency,
          portfolio_id: pos.portfolio_id,
          security_id: pos.security_id,
          security: {
            id: sec.id,
            ticker: sec.ticker,
            name: sec.name,
            asset_class: sec.asset_class,
            sector: sec.sector,
            exchange: sec.exchange,
            currency: sec.currency,
          },
          market_price: price,
          market_value: marketValue,
          unrealized_pnl: unrealizedPnl,
          unrealized_pnl_pct: unrealizedPnlPct,
        };
      });

      return enriched;
    },
    enabled: portfolioIds.length > 0,
  });
}

export function useDividendsYTD(portfolioIds: string[]) {
  return useQuery({
    queryKey: ["dividends-ytd", portfolioIds],
    queryFn: async () => {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0];

      const { data, error } = await supabase
        .from("dividend_history")
        .select("net_amount, fx_rate_to_base")
        .in("portfolio_id", portfolioIds)
        .gte("ex_date", startOfYear);

      if (error) throw error;

      return (data ?? []).reduce(
        (sum, d) => sum + d.net_amount * d.fx_rate_to_base,
        0
      );
    },
    enabled: portfolioIds.length > 0,
  });
}
