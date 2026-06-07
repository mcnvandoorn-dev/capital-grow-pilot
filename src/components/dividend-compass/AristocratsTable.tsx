import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { aristocrats, type Aristocrat } from "@/data/aristocrats";

type SortKey =
  | "ticker"
  | "name"
  | "sector"
  | "yield"
  | "consecutiveYears"
  | "dividendCAGR5yr"
  | "payoutRatio";
type SortDir = "asc" | "desc";

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "name", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "yield", label: "Yield", align: "right" },
  { key: "consecutiveYears", label: "Years of Growth", align: "right" },
  { key: "dividendCAGR5yr", label: "5yr Div CAGR", align: "right" },
  { key: "payoutRatio", label: "Payout Ratio", align: "right" },
];

function yearsBadgeStyle(years: number): { bg: string; color: string; label: string } {
  if (years >= 50) return { bg: "#FBEFC7", color: "#8A6A0B", label: `${years} yrs` }; // gold
  if (years >= 40) return { bg: "#ECEEF1", color: "#4B5563", label: `${years} yrs` }; // silver
  return { bg: "#E1F1EA", color: "#0F6E56", label: `${years} yrs` }; // green
}

export default function AristocratsTable() {
  const [sortKey, setSortKey] = useState<SortKey>("consecutiveYears");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...aristocrats];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[sortKey] as string | number;
      const bv = b[sortKey] as string | number;
      if (typeof av === "number" && typeof bv === "number") return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
    return arr;
  }, [sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(typeof aristocrats[0][key] === "number" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (k !== sortKey) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline h-3 w-3" />
      : <ArrowDown className="ml-1 inline h-3 w-3" />;
  };

  return (
    <section
      id="aristocrats-table"
      className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          The full Dividend Aristocrats list
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          Click any column header to sort. Tap and scroll horizontally on mobile.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-[820px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`border-b border-neutral-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-600 ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(c.key)}
                    className="inline-flex items-center transition-colors hover:text-neutral-900"
                  >
                    {c.label}
                    <SortIcon k={c.key} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row: Aristocrat, i) => {
              const badge = yearsBadgeStyle(row.consecutiveYears);
              const yieldHigh = row.yield > 3;
              return (
                <tr
                  key={row.ticker}
                  className={i % 2 === 1 ? "bg-neutral-50/60" : "bg-white"}
                >
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-neutral-900">
                    {row.ticker}
                  </td>
                  <td className="px-4 py-3 text-neutral-800">{row.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{row.sector}</td>
                  <td
                    className="px-4 py-3 text-right tabular-nums font-medium"
                    style={yieldHigh ? { color: "#0F6E56" } : { color: "#1f2937" }}
                  >
                    {row.yield.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-800">
                    {row.dividendCAGR5yr.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-800">
                    {row.payoutRatio.toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
