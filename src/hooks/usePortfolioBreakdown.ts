import { useMemo } from "react";
import type { PositionWithDetails } from "@/hooks/usePortfolioData";

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
  // Try exact match then prefix
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

function buildSlices(
  positions: PositionWithDetails[],
  keyFn: (p: PositionWithDetails) => string
): BreakdownSlice[] {
  const total = positions.reduce((s, p) => s + (p.market_value ?? p.total_cost_basis), 0);
  const grouped: Record<string, { value: number; count: number }> = {};

  for (const pos of positions) {
    const key = keyFn(pos);
    const val = pos.market_value ?? pos.total_cost_basis;
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

export function usePortfolioBreakdown(positions: PositionWithDetails[] | undefined) {
  const totalValue = useMemo(
    () => (positions ?? []).reduce((s, p) => s + (p.market_value ?? p.total_cost_basis), 0),
    [positions]
  );

  const assetTypeBreakdown = useMemo(
    () => buildSlices(positions ?? [], (p) => p.security.asset_class),
    [positions]
  );

  const sectorBreakdown = useMemo(
    () => buildSlices(positions ?? [], (p) => p.security.sector ?? "Onbekend"),
    [positions]
  );

  const regionBreakdown = useMemo(
    () => buildSlices(positions ?? [], (p) => getGeo(p.security.exchange).region),
    [positions]
  );

  const countryBreakdown = useMemo(
    () => buildSlices(positions ?? [], (p) => getGeo(p.security.exchange).country),
    [positions]
  );

  const currencyBreakdown = useMemo(
    () => buildSlices(positions ?? [], (p) => p.security.currency),
    [positions]
  );

  const dividendVsGrowth = useMemo(
    () =>
      buildSlices(positions ?? [], (p) =>
        DIVIDEND_CLASSES.has(p.security.asset_class) ? "Dividend/Inkomen" : "Groei/Overig"
      ),
    [positions]
  );

  const positionWeights: PositionWeight[] = useMemo(
    () =>
      (positions ?? [])
        .map((p) => ({
          ticker: p.security.ticker,
          name: p.security.name,
          assetClass: p.security.asset_class,
          marketValue: p.market_value ?? p.total_cost_basis,
          percentage: totalValue > 0 ? ((p.market_value ?? p.total_cost_basis) / totalValue) * 100 : 0,
          sector: p.security.sector,
          currency: p.security.currency,
        }))
        .sort((a, b) => b.marketValue - a.marketValue),
    [positions, totalValue]
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
