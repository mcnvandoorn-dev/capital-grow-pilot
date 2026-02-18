import type { RebalanceProposal } from "@/components/rebalancing/RebalanceResults";
import type { RebalancePreferences } from "@/components/rebalancing/RebalanceQuestionnaire";

/** Generate a plain-text PDF of a rebalancing advice using the browser's print API */
export function downloadRebalancePdf(
  proposal: RebalanceProposal,
  preferences: RebalancePreferences,
  date: string
) {
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;
  const fmtDate = new Date(date).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const goalLabels: Record<string, string> = {
    dividend: "Dividend / Inkomen",
    growth: "Groei",
    balanced: "Gebalanceerd",
    capital_preservation: "Kapitaalbehoud",
  };
  const styleLabels: Record<string, string> = {
    buy_and_hold: "Buy & Hold",
    active: "Actief",
    income_focused: "Inkomensgericht",
    high_dividend: "Hoog Dividend",
  };

  const riskRows = [
    { label: "Overwogen sectoren", items: proposal.riskAnalysis.overweightSectors },
    { label: "Onderwogen sectoren", items: proposal.riskAnalysis.underweightSectors },
    { label: "Concentratierisico's", items: proposal.riskAnalysis.concentrationRisks },
    { label: "Yield trap waarschuwingen", items: proposal.riskAnalysis.yieldTrapWarnings },
    { label: "Correlatierisico's", items: proposal.riskAnalysis.correlationRisks },
    { label: "Valutarisico's", items: proposal.riskAnalysis.currencyRisks },
  ].filter((r) => r.items.length > 0);

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Rebalancing Advies – ${fmtDate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #555; font-size: 12px; margin-bottom: 24px; }
  h2 { font-size: 14px; font-weight: bold; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 12px; font-weight: bold; margin: 10px 0 4px; }
  p { margin-bottom: 6px; line-height: 1.5; }
  ul { padding-left: 18px; margin-bottom: 8px; }
  li { margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f0f0f0; text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid #ddd; }
  td { padding: 5px 8px; border: 1px solid #ddd; font-size: 11px; vertical-align: top; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
  .meta-item label { font-size: 10px; color: #777; display: block; }
  .meta-item span { font-weight: bold; }
  .increase { color: #16a34a; }
  .decrease { color: #dc2626; }
  .sell { color: #dc2626; }
  .new { color: #2563eb; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>Rebalancing Advies</h1>
<p class="subtitle">Gegenereerd op ${fmtDate} · AI-gestuurd herbalanceeradvies</p>

<div class="meta-grid">
  <div class="meta-item"><label>Beleggingsdoel</label><span>${goalLabels[preferences.primaryGoal] ?? preferences.primaryGoal}</span></div>
  <div class="meta-item"><label>Beleggingsstijl</label><span>${styleLabels[preferences.investmentStyle] ?? preferences.investmentStyle}</span></div>
  <div class="meta-item"><label>Risicotolerantie</label><span>${preferences.riskTolerance}/10</span></div>
  <div class="meta-item"><label>Yield range</label><span>${preferences.targetYieldMin}% – ${preferences.targetYieldMax}%</span></div>
  <div class="meta-item"><label>Sectoren</label><span>${preferences.targetSectors.join(", ") || "—"}</span></div>
  <div class="meta-item"><label>Regio's</label><span>${preferences.targetRegions.join(", ") || "—"}</span></div>
</div>

<h2>Samenvatting</h2>
${proposal.summary
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => `<p>${l.replace(/^[-*]\s*/, "• ")}</p>`)
  .join("")}

${
  riskRows.length > 0
    ? `<h2>Risicoanalyse</h2>
${riskRows
  .map(
    (r) => `<h3>${r.label}</h3><ul>${r.items.map((i) => `<li>${i}</li>`).join("")}</ul>`
  )
  .join("")}`
    : ""
}

<h2>Gewichtsaanpassingen</h2>
<table>
  <thead>
    <tr><th>Ticker</th><th>Naam</th><th>Actie</th><th>Huidig</th><th>Voorstel</th><th>Δ</th><th>Reden</th></tr>
  </thead>
  <tbody>
    ${proposal.adjustments
      .map((a) => {
        const delta = a.suggestedWeight - a.currentWeight;
        const cls = a.action === "increase" || a.action === "new" ? "increase" : a.action === "decrease" || a.action === "sell" ? "decrease" : "";
        const actionLabels: Record<string, string> = { increase: "Verhogen", decrease: "Verlagen", hold: "Houden", sell: "Verkopen", new: "Nieuw" };
        return `<tr>
          <td><strong>${a.ticker}</strong></td>
          <td>${a.name ?? ""}</td>
          <td class="${cls}">${actionLabels[a.action] ?? a.action}</td>
          <td>${fmtPct(a.currentWeight)}</td>
          <td>${fmtPct(a.suggestedWeight)}</td>
          <td class="${delta > 0 ? "increase" : delta < 0 ? "decrease" : ""}">${delta > 0 ? "+" : ""}${fmtPct(delta)}</td>
          <td>${a.reasoning}</td>
        </tr>`;
      })
      .join("")}
  </tbody>
</table>

${
  proposal.sectorShifts.length > 0
    ? `<h2>Sectorverschuivingen</h2>
<table>
  <thead><tr><th>Sector</th><th>Huidig</th><th>Voorstel</th><th>Δ</th></tr></thead>
  <tbody>
    ${proposal.sectorShifts
      .map((s) => {
        const delta = s.suggestedWeight - s.currentWeight;
        return `<tr><td>${s.sector}</td><td>${fmtPct(s.currentWeight)}</td><td>${fmtPct(s.suggestedWeight)}</td><td class="${delta > 0 ? "increase" : delta < 0 ? "decrease" : ""}">${delta > 0 ? "+" : ""}${fmtPct(delta)}</td></tr>`;
      })
      .join("")}
  </tbody>
</table>`
    : ""
}

${
  proposal.replacements.length > 0
    ? `<h2>Mogelijke Ticker Vervangingen</h2>
${proposal.replacements
  .map(
    (r) => `<p><strong class="sell">Verkoop ${r.sellTicker}:</strong> ${r.sellReason}</p>
<p><strong class="increase">Koop ${r.buyTicker}:</strong> ${r.buyReason}</p><br/>`
  )
  .join("")}`
    : ""
}

${
  proposal.additionalInsights
    ? `<h2>Aanvullende Inzichten</h2>
${proposal.additionalInsights
  .split("\n")
  .filter((l) => l.trim())
  .map((l) =>
    l.startsWith("##")
      ? `<h3>${l.replace(/^#+\s*/, "")}</h3>`
      : `<p>${l.replace(/^[-*]\s*/, "• ")}</p>`
  )
  .join("")}`
    : ""
}

<p style="margin-top:32px;font-size:10px;color:#999;">Dit advies is informatief en vormt geen beleggingsadvies. Er worden geen transacties automatisch uitgevoerd.</p>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}
