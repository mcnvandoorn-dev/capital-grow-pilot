import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export interface TickerDetail {
  security: {
    id: string;
    ticker: string;
    name: string | null;
    asset_class: string;
    sector: string | null;
    industry: string | null;
    exchange: string | null;
    currency: string;
    dividend_frequency: string | null;
    isin: string | null;
  };
  position: {
    quantity: number;
    avg_cost_basis: number;
    total_cost_basis: number;
    currency: string;
  };
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  priceHistory: { date: string; price: number }[];
  fundamentals: {
    pe_ratio: number | null;
    dividend_yield: number | null;
    payout_ratio: number | null;
    dividend_cagr_5y: number | null;
    revenue_growth_3y: number | null;
    revenue_growth_5y: number | null;
    earnings_growth_3y: number | null;
    earnings_growth_5y: number | null;
  } | null;
  scores: {
    total_score: number | null;
    technical_score: number | null;
    fundamental_score: number | null;
    rsi_score: number | null;
    range_52w_score: number | null;
    pe_score: number | null;
    payout_score: number | null;
    dividend_cagr_score: number | null;
    revenue_growth_score: number | null;
  } | null;
  dividends: {
    ex_date: string;
    amount_per_share: number;
    total_amount: number;
    net_amount: number;
    withholding_tax: number;
    is_roc: boolean;
    currency: string;
  }[];
  transactions: {
    trade_date: string;
    transaction_type: string;
    quantity: number;
    price: number;
    net_amount: number;
    currency: string;
  }[];
}

export function useTickerDetail(securityId: string | undefined, portfolioIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ticker-detail", securityId, portfolioIds],
    queryFn: async (): Promise<TickerDetail | null> => {
      if (!securityId || portfolioIds.length === 0) return null;

      // Parallel fetches
      const [secRes, posRes, mdRes, fundRes, scoreRes, divRes, txRes] = await Promise.all([
        supabase.from("securities").select("*").eq("id", securityId).single(),
        supabase
          .from("positions")
          .select("*")
          .eq("security_id", securityId)
          .in("portfolio_id", portfolioIds)
          .gt("quantity", 0)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("market_data")
          .select("data_date, close_price")
          .eq("security_id", securityId)
          .order("data_date", { ascending: true }),
        supabase
          .from("fundamental_data")
          .select("*")
          .eq("security_id", securityId)
          .order("data_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("security_scores")
          .select("*")
          .eq("security_id", securityId)
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("dividend_history")
          .select("ex_date, amount_per_share, total_amount, net_amount, withholding_tax, is_roc, currency")
          .eq("security_id", securityId)
          .in("portfolio_id", portfolioIds)
          .order("ex_date", { ascending: false }),
        supabase
          .from("transactions")
          .select("trade_date, transaction_type, quantity, price, net_amount, currency")
          .eq("security_id", securityId)
          .in("portfolio_id", portfolioIds)
          .order("trade_date", { ascending: false }),
      ]);

      if (secRes.error || !secRes.data) return null;
      const sec = secRes.data;

      const pos = posRes.data;
      const prices = (mdRes.data ?? [])
        .filter((d) => d.close_price !== null)
        .map((d) => ({ date: d.data_date, price: d.close_price! }));

      const latestPrice = prices.length > 0 ? prices[prices.length - 1].price : null;
      const quantity = pos?.quantity ?? 0;
      const totalCost = pos?.total_cost_basis ?? 0;
      const mktVal = latestPrice !== null && quantity > 0 ? latestPrice * quantity : null;
      const pnl = mktVal !== null ? mktVal - totalCost : null;
      const pnlPct = pnl !== null && totalCost > 0 ? (pnl / totalCost) * 100 : null;

      const fund = fundRes.data;
      const score = scoreRes.data;

      return {
        security: {
          id: sec.id,
          ticker: sec.ticker,
          name: sec.name,
          asset_class: sec.asset_class,
          sector: sec.sector,
          industry: sec.industry,
          exchange: sec.exchange,
          currency: sec.currency,
          dividend_frequency: sec.dividend_frequency,
          isin: sec.isin,
        },
        position: {
          quantity,
          avg_cost_basis: pos?.avg_cost_basis ?? 0,
          total_cost_basis: totalCost,
          currency: pos?.currency ?? sec.currency,
        },
        marketPrice: latestPrice,
        marketValue: mktVal,
        unrealizedPnl: pnl,
        unrealizedPnlPct: pnlPct,
        priceHistory: prices,
        fundamentals: fund
          ? {
              pe_ratio: fund.pe_ratio,
              dividend_yield: fund.dividend_yield,
              payout_ratio: fund.payout_ratio,
              dividend_cagr_5y: fund.dividend_cagr_5y,
              revenue_growth_3y: fund.revenue_growth_3y,
              revenue_growth_5y: fund.revenue_growth_5y,
              earnings_growth_3y: fund.earnings_growth_3y,
              earnings_growth_5y: fund.earnings_growth_5y,
            }
          : null,
        scores: score
          ? {
              total_score: score.total_score,
              technical_score: score.technical_score,
              fundamental_score: score.fundamental_score,
              rsi_score: score.rsi_score,
              range_52w_score: score.range_52w_score,
              pe_score: score.pe_score,
              payout_score: score.payout_score,
              dividend_cagr_score: score.dividend_cagr_score,
              revenue_growth_score: score.revenue_growth_score,
            }
          : null,
        dividends: (divRes.data ?? []) as TickerDetail["dividends"],
        transactions: (txRes.data ?? []) as TickerDetail["transactions"],
      };
    },
    enabled: !!securityId && portfolioIds.length > 0 && !!user,
  });
}
