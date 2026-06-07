export default function DividendAristocrats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="max-w-3xl">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
          style={{ backgroundColor: "#FBF1E0", color: "#BA7517" }}
        >
          Guide
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          Dividend Aristocrats Guide
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-600 sm:text-xl">
          A clean, focused resource on companies with decades of consistent
          dividend growth. Content coming soon.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <button
            className="rounded-md px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#0F6E56" }}
          >
            Start reading
          </button>
          <button
            className="rounded-md border px-5 py-3 text-sm font-semibold transition-colors"
            style={{ borderColor: "#BA7517", color: "#BA7517" }}
          >
            Browse the list
          </button>
        </div>
      </div>
    </section>
  );
}
