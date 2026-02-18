/** Generate a step-by-step tutorial PDF for setting up an IBKR Flex Query */
export function downloadFlexQueryTutorialPdf() {
  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Handleiding: IBKR Flex Query instellen</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; color: #0f172a; }
  .subtitle { color: #64748b; font-size: 12px; margin-bottom: 32px; }
  h2 { font-size: 15px; font-weight: bold; margin: 28px 0 10px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  h3 { font-size: 12px; font-weight: bold; margin: 14px 0 5px; color: #334155; }
  p { margin-bottom: 7px; line-height: 1.6; color: #374151; }
  ul, ol { padding-left: 20px; margin-bottom: 10px; }
  li { margin-bottom: 5px; line-height: 1.6; }
  .step { display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start; }
  .step-num { background: #0f172a; color: #fff; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; margin-top: 1px; }
  .step-body { flex: 1; }
  .tip { background: #f0fdf4; border-left: 3px solid #22c55e; padding: 10px 14px; margin: 10px 0; border-radius: 0 6px 6px 0; }
  .tip strong { color: #15803d; }
  .warning { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; margin: 10px 0; border-radius: 0 6px 6px 0; }
  .warning strong { color: #b45309; }
  .code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 11px; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th { background: #f8fafc; text-align: left; padding: 7px 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #374151; }
  td { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
  td:first-child { font-weight: 500; color: #0f172a; white-space: nowrap; }
  .section-intro { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>

<h1>Handleiding: IBKR Flex Query instellen</h1>
<p class="subtitle">Stap-voor-stap uitleg om je Interactive Brokers account te koppelen · Capital Grow</p>

<div class="section-intro">
  <strong>Wat is een Flex Query?</strong>
  <p style="margin-top:6px;">Een Flex Query is een exportfunctie van Interactive Brokers waarmee jij bepaalt welke data je wil exporteren. Capital Grow gebruikt dit om je transacties, posities en dividenden automatisch te importeren — volledig veilig, zonder dat we toegang hebben tot je account of orders kunnen plaatsen.</p>
</div>

<h2>Stap 1 – Inloggen op IBKR Account Management</h2>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body">
    <p>Ga naar <strong>clientportal.ibkr.com</strong> en log in met je IBKR gebruikersnaam en wachtwoord. Gebruik het <em>Client Portal</em>, niet de Trader Workstation.</p>
  </div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body">
    <p>Klik rechtsboven op je naam → <strong>Settings</strong> → links in het menu op <strong>Account Settings</strong> → zoek naar het blok <strong>Reporting</strong>.</p>
  </div>
</div>

<h2>Stap 2 – Flex Web Service Token aanmaken</h2>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body">
    <p>Ga in <em>Reporting</em> naar <strong>Flex Web Service</strong> en klik op het potlood-icoon om te bewerken.</p>
  </div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body">
    <p>Klik op <strong>Generate Token</strong>. Kopieer de gegenereerde token (lange reeks tekens) en bewaar deze veilig. <strong>Dit is je Flex Token</strong> die je in Capital Grow invult.</p>
  </div>
</div>
<div class="warning">
  <strong>⚠️ Bewaar je token goed.</strong> Na het wegklikken kun je de token niet meer zien. Je kunt altijd een nieuwe genereren, maar dan moet je de koppeling in Capital Grow bijwerken.
</div>

<h2>Stap 3 – Flex Query aanmaken</h2>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body">
    <p>Ga in het <em>Reporting</em> menu naar <strong>Flex Queries</strong> en klik op <strong>Create</strong> (of het + icoon) → kies <strong>Activity Flex Query</strong>.</p>
  </div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body">
    <p>Geef de query een herkenbare naam, bijvoorbeeld: <span class="code">CapitalGrow Sync</span></p>
  </div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body">
    <p>Stel de <strong>Period</strong> (periode) in op: <span class="code">Last 365 Calendar Days</span> of <span class="code">Last Calendar Year</span>. Voor de standaard dagelijkse sync gebruik je "Last 365 Calendar Days".</p>
  </div>
</div>

<h2>Stap 4 – Welke secties moet je aanzetten?</h2>
<p>Selecteer de volgende secties in de Flex Query configuratie. Dit zijn de gegevens die Capital Grow nodig heeft:</p>

<table>
  <thead>
    <tr>
      <th>Sectie</th>
      <th>Waarvoor nodig</th>
      <th>Vereiste velden</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Trades</td>
      <td>Koop- en verkooptransacties importeren</td>
      <td>Symbol, TradeDate, Quantity, TradePrice, Commission, CurrencyPrimary, Buy/Sell, NetCash, IBOrderID, fxRateToBase</td>
    </tr>
    <tr>
      <td>Open Positions</td>
      <td>Huidige portefeuille posities</td>
      <td>Symbol, Quantity, MarkPrice, PositionValue, CostBasisPrice, CostBasisMoney, Currency, FifoPnlUnrealized</td>
    </tr>
    <tr>
      <td>Cash Transactions</td>
      <td>Dividenden, ROC, belastingen en andere kasstromen</td>
      <td>Symbol, Date, Amount, Currency, Type, Description, fxRateToBase</td>
    </tr>
    <tr>
      <td>Equity Summary (in base currency)</td>
      <td>Dagelijkse portefeuille waarde en liquiditeitspositie</td>
      <td>Date, Cash, NetLiquidation, TotalCashValue</td>
    </tr>
    <tr>
      <td>Securities Info</td>
      <td>ISIN, exchange en asset class van effecten</td>
      <td>Symbol, ISIN, Currency, AssetCategory, Description, Conid, PrimaryExch</td>
    </tr>
  </tbody>
</table>

<div class="tip">
  <strong>💡 Tip:</strong> Vink bij elke sectie ook <em>"Include All Subaccounts"</em> aan als je meerdere sub-accounts hebt. Zet de output format op <strong>XML</strong>.
</div>

<h2>Stap 5 – De Query ID ophalen</h2>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body">
    <p>Sla de Flex Query op. Na het opslaan verschijnt de query in de lijst met een <strong>Query ID</strong> (een getal, bijv. <span class="code">123456</span>).</p>
  </div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body">
    <p>Kopieer dit getal. <strong>Dit is je Flex Query ID</strong> die je in Capital Grow invult.</p>
  </div>
</div>

<h2>Stap 6 – Koppeling toevoegen in Capital Grow</h2>
<p>Ga in Capital Grow naar <strong>Instellingen</strong> → klik op <strong>Toevoegen</strong> bij IBKR koppelingen en vul in:</p>
<table>
  <thead>
    <tr><th>Veld</th><th>Wat invullen</th></tr>
  </thead>
  <tbody>
    <tr><td>Naam</td><td>Een herkenbare naam, bijv. "Hoofdaccount" of "Groei portfolio"</td></tr>
    <tr><td>Flex Token</td><td>De token uit Stap 2</td></tr>
    <tr><td>Flex Query ID</td><td>Het ID uit Stap 5</td></tr>
    <tr><td>Strategie</td><td>Kies de beleggingsstrategie die bij dit account past</td></tr>
  </tbody>
</table>
<p>Klik op <strong>Koppeling aanmaken</strong> en daarna op <strong>Sync</strong> om de eerste import te starten.</p>

<h2>Historische import (optioneel)</h2>
<p>Wil je ook historische data importeren (bijv. van vorig jaar)? Maak dan een <em>aparte</em> Flex Query aan in IBKR met als periode <span class="code">Last Calendar Year</span> of een specifieke datumrange. Gebruik de knop <strong>Historisch</strong> naast je koppeling in Capital Grow en vul het ID van deze query in.</p>
<div class="tip">
  <strong>💡 Tip:</strong> Je kunt meerdere historische queries aanmaken voor elk jaar en ze één voor één importeren.
</div>

<h2>Veelgestelde vragen</h2>
<h3>Hoe vaak wordt er gesynchroniseerd?</h3>
<p>Capital Grow synchroniseert automatisch elke ochtend om 06:00 UTC. Je kunt ook handmatig een sync starten via de Sync-knop in Instellingen.</p>
<h3>Kan IBKR via de Flex Query orders plaatsen of geld opnemen?</h3>
<p>Nee. Een Flex Query is alleen-lezen. Er worden geen orders geplaatst en er kan geen geld worden overgemaakt via deze koppeling.</p>
<h3>Mijn sync mislukt steeds, wat nu?</h3>
<p>Controleer of: (1) de Token en Query ID correct zijn, (2) de juiste secties in de Flex Query zijn aangevinkt, en (3) de output format op XML staat. IBKR heeft soms 1–2 minuten nodig om een rapport te genereren bij de eerste aanroep — de sync probeert het automatisch meerdere keren.</p>
<h3>Ik heb meerdere IBKR accounts, wat doe ik?</h3>
<p>Maak per account een aparte Flex Query en voeg ze allemaal toe als losse koppelingen in Capital Grow. Wijs per koppeling een strategie toe (bijv. "Dividend Growth" voor het ene account en "Working Capital Growth" voor het andere).</p>

<div class="footer">
  Capital Grow · Flex Query Handleiding · Dit document is informatief en geen officiële IBKR documentatie. Schermweergave in IBKR Client Portal kan afwijken van deze beschrijving door updates.
</div>
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
