import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IbkrDailyTrade {
  symbol: string;
  quantity: number;
  price: number;
  side: string;
  realizedPnl: number | null;
  tradeDate: string;
}

export interface IbkrDailyData {
  date: string;
  netLiquidation: number | null;
  cashBalance: number | null;
  trades: IbkrDailyTrade[];
}

export function useIbkrDaily(date?: string) {
  return useQuery({
    queryKey: ["ibkr-daily", date],
    queryFn: async (): Promise<IbkrDailyData> => {
      const queryParams = date ? `?date=${date}` : "";
      const { data, error } = await supabase.functions.invoke(
        `ibkr-daily${queryParams}`,
        { method: "GET" }
      );

      if (error) throw error;
      return data as IbkrDailyData;
    },
  });
}
