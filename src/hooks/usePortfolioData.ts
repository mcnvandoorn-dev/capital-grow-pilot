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

      // Fetch latest FX rates to EUR
      const currencies = [...new Set(positions.map((p) => p.currency))].filter(
        (c) => c !== "EUR"
      );
      const fxMap = new Map<string, number>();
      fxMap.set("EUR", 1);

      if (currencies.length > 0) {
        const { data: fxRates } = await supabase
          .from("fx_rates")
          .select("from_currency, rate, rate_date")
          .eq("to_currency", "EUR")
          .in("from_currency", currencies)
          .order("rate_date", { ascending: false });

        if (fxRates) {
          for (const fx of fxRates) {
            if (!fxMap.has(fx.from_currency)) {
              fxMap.set(fx.from_currency, fx.rate);
            }
          }
        }
      }

      // Check if positions have zero cost basis — if so, compute from transactions
      const hasZeroCost = positions.some((p) => p.total_cost_basis === 0 && p.quantity > 0);
      const txCostMap = new Map<string, { avgCost: number; totalCost: number }>();

      if (hasZeroCost) {
        // Fetch all BUY and SELL transactions for these portfolios
        const { data: txns } = await supabase
          .from("transactions")
          .select("security_id, transaction_type, quantity, price, currency, fx_rate_to_base")
          .in("portfolio_id", portfolioIds)
          .in("transaction_type", ["BUY", "SELL"])
          .order("trade_date", { ascending: true });

        if (txns) {
          // Build cost basis per security using FIFO-like average cost
          const secAgg = new Map<string, { qty: number; totalCost: number }>();
          for (const tx of txns) {
            const entry = secAgg.get(tx.security_id) ?? { qty: 0, totalCost: 0 };
            if (tx.transaction_type === "BUY") {
              entry.qty += tx.quantity;
              entry.totalCost += tx.quantity * tx.price;
            } else {
              // SELL: reduce proportionally
              const avgCostPerUnit = entry.qty > 0 ? entry.totalCost / entry.qty : 0;
              entry.qty = Math.max(0, entry.qty - tx.quantity);
              entry.totalCost = entry.qty * avgCostPerUnit;
            }
            secAgg.set(tx.security_id, entry);
          }
          for (const [secId, agg] of secAgg) {
            if (agg.qty > 0) {
              txCostMap.set(secId, {
                avgCost: agg.totalCost / agg.qty,
                totalCost: agg.totalCost,
              });
            }
          }
        }
      }

      // Enrich positions with EUR-converted values
      const enriched: PositionWithDetails[] = positions.map((pos) => {
        const sec = pos.securities as any;
        const price = priceMap.get(pos.security_id) ?? null;
        const fxRate = fxMap.get(pos.currency) ?? 1;

        // Use transaction-derived cost basis if position cost is 0
        let avgCostBasis = pos.avg_cost_basis;
        let totalCostBasis = pos.total_cost_basis;
        if (totalCostBasis === 0 && txCostMap.has(pos.security_id)) {
          const txCost = txCostMap.get(pos.security_id)!;
          avgCostBasis = txCost.avgCost;
          totalCostBasis = txCost.totalCost;
        }

        // market_value in local currency, then convert to EUR
        const localMarketValue = price !== null ? price * pos.quantity : null;
        const marketValue =
          localMarketValue !== null ? localMarketValue * fxRate : null;
        const costInEur = totalCostBasis * fxRate;
        const unrealizedPnl =
          marketValue !== null ? marketValue - costInEur : null;
        const unrealizedPnlPct =
          unrealizedPnl !== null && costInEur > 0
            ? (unrealizedPnl / costInEur) * 100
            : null;

        return {
          id: pos.id,
          quantity: pos.quantity,
          avg_cost_basis: avgCostBasis,
          total_cost_basis: costInEur,
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
