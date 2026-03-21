import { useMemo } from "react";
import type { PositionWithDetails } from "@/hooks/usePortfolioData";
import type { PrivateInvestment } from "@/hooks/usePrivateInvestments";

export interface BreakdownSlice {
  name: string;
  value: number;
  percentage: number;
  count: number;
}

export interface PositionWeight {
  ticker: string;
  name: string | null;
  assetClass: string;
  marketValue: number;
  percentage: number;
  sector: string | null;
  currency: string;
  isPrivate?: boolean;
}

// Map exchange to region/country (simplified heuristic)
const EXCHANGE_REGION_MAP: Record<string, { region: string; country: string }> = {
  NYSE: { region: "Noord-Amerika", country: "VS" },
  NASDAQ: { region: "Noord-Amerika", country: "VS" },
  AMEX: { region: "Noord-Amerika", country: "VS" },
  ARCA: { region: "Noord-Amerika", country: "VS" },
  BATS: { region: "Noord-Amerika", country: "VS" },
  TSX: { region: "Noord-Amerika", country: "Canada" },
  LSE: { region: "Europa", country: "VK" },
  AEB: { region: "Europa", country: "Nederland" },
  SBF: { region: "Europa", country: "Frankrijk" },
  XETRA: { region: "Europa", country: "Duitsland" },
  SWX: { region: "Europa", country: "Zwitserland" },
  TSEJ: { region: "Azië-Pacific", country: "Japan" },
  HKEX: { region: "Azië-Pacific", country: "Hong Kong" },
  ASX: { region: "Azië-Pacific", country: "Australië" },
};

function getGeo(exchange: string | null) {
  if (!exchange) return { region: "Onbekend", country: "Onbekend" };
  const upper = exchange.toUpperCase();
  return (
    EXCHANGE_REGION_MAP[upper] ??
    Object.entries(EXCHANGE_REGION_MAP).find(([k]) => upper.includes(k))?.[1] ?? {
      region: "Overig",
      country: exchange,
    }
  );
}

// Income-oriented asset classes
const DIVIDEND_CLASSES = new Set(["CEF", "BDC", "REIT", "PREFERRED", "BABY_BOND"]);

// Private asset types that are income-oriented
const PRIVATE_INCOME_TYPES = new Set(["real_estate", "vastgoed", "reit", "bonds", "lending"]);

interface GenericSliceItem {
  value: number;
  keys: {
    assetType: string;
    sector: string;
    region: string;
    country: string;
    currency: string;
    dividendVsGrowth: string;
  };
  weight: {
    ticker: string;
    name: string | null;
    assetClass: string;
    sector: string | null;
    currency: string;
    isPrivate: boolean;
  };
}

function buildSlicesFromItems(
  items: GenericSliceItem[],
  keyFn: (item: GenericSliceItem) => string
): BreakdownSlice[] {
  const total = items.reduce((s, item) => s + item.value, 0);
  const grouped: Record<string, { value: number; count: number }> = {};

  for (const item of items) {
    const key = keyFn(item);
    const val = item.value;
    if (!grouped[key]) grouped[key] = { value: 0, count: 0 };
    grouped[key].value += val;
    grouped[key].count += 1;
  }

  return Object.entries(grouped)
    .map(([name, { value, count }]) => ({
      name,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      count,
    }))
    .sort((a, b) => b.value - a.value);
}

function getPrivateEquity(inv: PrivateInvestment): number {
  const value = inv.current_value ?? inv.invested_amount;
  const loan = inv.has_loan ? (inv.loan_current_balance ?? inv.loan_amount ?? 0) : 0;
  return value - loan;
}

export function usePortfolioBreakdown(
  positions: PositionWithDetails[] | undefined,
  privateInvestments?: PrivateInvestment[]
) {
  // Build unified items list
  const items = useMemo<GenericSliceItem[]>(() => {
    const result: GenericSliceItem[] = [];

    for (const p of positions ?? []) {
      const mv = p.market_value ?? p.total_cost_basis;
      const geo = getGeo(p.security.exchange);
      result.push({
        value: mv,
        keys: {
          assetType: p.security.asset_class,
          sector: p.security.sector ?? "Onbekend",
          region: geo.region,
          country: geo.country,
          currency: p.security.currency,
          dividendVsGrowth: DIVIDEND_CLASSES.has(p.security.asset_class)
            ? "Dividend/Inkomen"
            : "Groei/Overig",
        },
        weight: {
          ticker: p.security.ticker,
          name: p.security.name,
          assetClass: p.security.asset_class,
          sector: p.security.sector,
          currency: p.security.currency,
          isPrivate: false,
        },
      });
    }

    for (const inv of privateInvestments ?? []) {
      const equity = getPrivateEquity(inv);
      if (equity <= 0) continue;
      const geoLabel = (inv.geography_label ?? "Nederland").trim();
      result.push({
        value: equity,
        keys: {
          assetType: `Privaat: ${inv.asset_type}`,
          sector: inv.sector_label ?? "Overig",
          region: geoLabel,
          country: geoLabel,
          currency: inv.currency,
          dividendVsGrowth: PRIVATE_INCOME_TYPES.has(inv.asset_type.toLowerCase())
            ? "Dividend/Inkomen"
            : "Groei/Overig",
        },
        weight: {
          ticker: inv.name,
          name: inv.asset_type,
          assetClass: `Privaat`,
          sector: inv.sector_label,
          currency: inv.currency,
          isPrivate: true,
        },
      });
    }

    return result;
  }, [positions, privateInvestments]);

  const totalValue = useMemo(() => items.reduce((s, item) => s + item.value, 0), [items]);

  const assetTypeBreakdown = useMemo(
    () => buildSlicesFromItems(items, (i) => i.keys.assetType),
    [items]
  );

  const sectorBreakdown = useMemo(
    () => buildSlicesFromItems(items, (i) => i.keys.sector),
    [items]
  );

  const regionBreakdown = useMemo(
    () => buildSlicesFromItems(items, (i) => i.keys.region),
    [items]
  );

  const countryBreakdown = useMemo(
    () => buildSlicesFromItems(items, (i) => i.keys.country),
    [items]
  );

  const currencyBreakdown = useMemo(
    () => buildSlicesFromItems(items, (i) => i.keys.currency),
    [items]
  );

  const dividendVsGrowth = useMemo(
    () => buildSlicesFromItems(items, (i) => i.keys.dividendVsGrowth),
    [items]
  );

  const positionWeights: PositionWeight[] = useMemo(
    () =>
      items
        .map((item) => ({
          ...item.weight,
          marketValue: item.value,
          percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.marketValue - a.marketValue),
    [items, totalValue]
  );

  return {
    totalValue,
    assetTypeBreakdown,
    sectorBreakdown,
    regionBreakdown,
    countryBreakdown,
    currencyBreakdown,
    dividendVsGrowth,
    positionWeights,
  };
}
