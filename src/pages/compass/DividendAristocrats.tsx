import AristocratsTable from "@/components/dividend-compass/AristocratsTable";

export default function DividendAristocrats() {
  const stats = [
    { value: "65", label: "Aristocrats", sub: "Current count" },
    { value: "2.4%", label: "Avg. yield", sub: "Approximate" },
    { value: "25+ yrs", label: "Min. growth", sub: "Eligibility rule" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16 lg:px-8">
        <div className="max-w-3xl">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{ backgroundColor: "#FBF1E0", color: "#BA7517" }}
          >
            Guide · 2025
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
            Dividend Aristocrats 2025: Complete Guide &amp; Filterable List
          </h1>
          <p className="mt-6 text-base leading-relaxed text-neutral-500 sm:text-[17px]">
            S&amp;P 500 companies with 25+ consecutive years of dividend growth —
            screened, sorted and explained.
          </p>
        </div>

        {/* Stat cards */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-neutral-200 bg-white p-5"
            >
              <div
                className="text-3xl font-bold tracking-tight"
                style={{ color: "#0F6E56" }}
              >
                {s.value}
              </div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">
                {s.label}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <a
            href="#aristocrats-table"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("aristocrats-table")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#0F6E56" }}
          >
            Jump to the full list <span aria-hidden>↓</span>
          </a>
        </div>
      </section>

      {/* Educational section */}
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <div className="space-y-10 text-[17px] leading-[1.8] text-neutral-700">
          <div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-neutral-900">
              What is a Dividend Aristocrat?
            </h2>
            <p>
              A Dividend Aristocrat is a member of the S&amp;P 500 that has
              increased its dividend payout for at least 25 consecutive years.
              To qualify, a company must also meet minimum market-cap and
              liquidity thresholds set by S&amp;P (currently a $3 billion
              float-adjusted market cap and $5 million in average daily trading
              value). The list is reviewed annually, so companies that freeze
              or cut their dividend are removed — which keeps the bar genuinely
              high.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-neutral-900">
              Why consecutive dividend growth matters
            </h2>
            <p>
              For income investors, a rising dividend is the clearest signal
              that a business can compound cash flow through full economic
              cycles — recessions, rate shocks, and sector rotations included.
              A 25-year streak spans the dot-com bust, the global financial
              crisis, and the 2020 shutdown. Companies that kept growing
              dividends through all of that tend to have durable moats,
              disciplined capital allocation, and management teams that treat
              the dividend as a non-negotiable commitment rather than a
              residual.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-neutral-900">
              How to use this list
            </h2>
            <p>
              Don't just sort by yield. The highest-yielding Aristocrats are
              often the slowest growers, while the lowest-yielding names may be
              compounding payouts at double-digit rates. Pair yield with the
              5-year dividend growth rate, then sanity-check the payout ratio —
              anything sustained above 75% (or 90% for REITs) deserves a closer
              look. Finally, diversify across sectors: the Aristocrat universe
              is heavy in consumer staples and industrials, so blend in
              healthcare, financials, and utilities to avoid concentration
              risk.
            </p>
          </div>
        </div>
      </section>

      <AristocratsTable />
    </>
  );
}
