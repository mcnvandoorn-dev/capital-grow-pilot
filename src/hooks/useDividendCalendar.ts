import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolios, usePositions } from "./usePortfolioData";
import { useMemo } from "react";

export interface CalendarDividend {
  securityId: string;
  ticker: string;
  name: string | null;
  expectedExDate: string; // YYYY-MM-DD
  expectedPayDate: string | null;
  amountPerShare: number;
  quantity: number;
  estimatedTotal: number;
  estimatedTax: number;
  estimatedNet: number;
  frequency: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Derives the dividend frequency interval in months from the frequency string
 * or from historical gaps.
 */
function frequencyToMonths(freq: string | null): number {
  switch (freq?.toLowerCase()) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semi-annual":
    case "semiannual":
      return 6;
    case "annual":
    case "annually":
      return 12;
    default:
      return 3; // default to quarterly
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function useDividendCalendar() {
  const { user } = useAuth();
  const { data: portfolios } = usePortfolios();
  const portfolioIds = useMemo(
    () => (portfolios ?? []).map((p) => p.id),
    [portfolios]
  );
  const { data: positions } = usePositions(portfolioIds);

  // Fetch dividend history + security metadata
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["dividend-calendar-raw", portfolioIds],
    queryFn: async () => {
      if (portfolioIds.length === 0) return { history: [], securities: [] };

      const [histRes, secRes] = await Promise.all([
        supabase
          .from("dividend_history")
          .select("security_id, ex_date, pay_date, amount_per_share, total_amount, net_amount, withholding_tax")
          .in("portfolio_id", portfolioIds)
          .order("ex_date", { ascending: false }),
        supabase
          .from("securities")
          .select("id, ticker, name, dividend_frequency")
          .in(
            "id",
            (positions ?? []).map((p) => p.security_id)
          ),
      ]);

      return {
        history: histRes.data ?? [],
        securities: secRes.data ?? [],
      };
    },
    enabled: portfolioIds.length > 0 && (positions ?? []).length > 0,
  });

  const calendarEvents = useMemo<CalendarDividend[]>(() => {
    if (!rawData || !positions) return [];

    const { history, securities } = rawData;
    const secMap = new Map(securities.map((s) => [s.id, s]));
    const posMap = new Map(positions.map((p) => [p.security_id, p]));

    // Group history by security
    const histBySec = new Map<string, typeof history>();
    for (const h of history) {
      const arr = histBySec.get(h.security_id) ?? [];
      arr.push(h);
      histBySec.set(h.security_id, arr);
    }

    const now = new Date();
    const horizonEnd = new Date(now.getFullYear(), now.getMonth() + 12, 0); // 12 months out
    const events: CalendarDividend[] = [];

    for (const [secId, pos] of posMap) {
      const sec = secMap.get(secId);
      if (!sec) continue;

      const secHistory = histBySec.get(secId) ?? [];
      if (secHistory.length === 0) continue;

      // Use most recent dividend as baseline
      const latest = secHistory[0];
      const latestExDate = new Date(latest.ex_date);
      const intervalMonths = frequencyToMonths(sec.dividend_frequency);

      // Derive amount_per_share: use stored value, or fall back to total_amount / quantity
      let derivedAmountPerShare = latest.amount_per_share;
      if (!derivedAmountPerShare || derivedAmountPerShare === 0) {
        const totalAmt = (latest as any).total_amount ?? (latest as any).net_amount ?? 0;
        derivedAmountPerShare = pos.quantity > 0 ? totalAmt / pos.quantity : 0;
      }

      // Calculate pay-date offset from ex-date
      let payDateOffsetDays = 14; // default
      if (latest.pay_date) {
        const diff =
          new Date(latest.pay_date).getTime() - latestExDate.getTime();
        payDateOffsetDays = Math.round(diff / (1000 * 60 * 60 * 24));
      }

      // Confidence based on history depth
      const confidence: "high" | "medium" | "low" =
        secHistory.length >= 4 ? "high" : secHistory.length >= 2 ? "medium" : "low";

      // Project forward from latest ex-date
      let nextDate = addMonths(latestExDate, intervalMonths);
      // If nextDate is in the past, keep advancing
      while (nextDate < now) {
        nextDate = addMonths(nextDate, intervalMonths);
      }

      while (nextDate <= horizonEnd) {
        const exDateStr = nextDate.toISOString().split("T")[0];
        const payDate = new Date(nextDate);
        payDate.setDate(payDate.getDate() + payDateOffsetDays);

        events.push({
          securityId: secId,
          ticker: sec.ticker,
          name: sec.name,
          expectedExDate: exDateStr,
          expectedPayDate: payDate.toISOString().split("T")[0],
          amountPerShare: derivedAmountPerShare,
          quantity: pos.quantity,
          estimatedTotal: derivedAmountPerShare * pos.quantity,
          frequency: sec.dividend_frequency ?? "quarterly",
          confidence,
        });

        nextDate = addMonths(nextDate, intervalMonths);
      }
    }

    // Sort by ex-date
    events.sort((a, b) => a.expectedExDate.localeCompare(b.expectedExDate));
    return events;
  }, [rawData, positions]);

  // Group by month
  const byMonth = useMemo(() => {
    const map = new Map<string, CalendarDividend[]>();
    for (const ev of calendarEvents) {
      const key = ev.expectedExDate.substring(0, 7); // YYYY-MM
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [calendarEvents]);

  return { calendarEvents, byMonth, isLoading };
}
