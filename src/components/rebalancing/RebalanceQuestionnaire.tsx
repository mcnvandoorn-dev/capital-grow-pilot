import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export interface AssetMixTarget {
  equity: number;       // aandelen / ETF / CEF / BDC
  credit: number;       // obligaties / preferreds / baby bonds
  realEstate: number;   // REIT / vastgoed
  privateAssets: number; // private investeringen
  cash: number;         // cash
}

export interface RebalancePreferences {
  primaryGoal: string;
  investmentStyle: string;
  riskTolerance: number;
  targetSectors: string[];
  targetRegions: string[];
  targetYieldMin: number;
  targetYieldMax: number;
  assetMixTarget: AssetMixTarget;
}

const SECTORS = [
  "Energy", "Utilities", "Real Estate", "Financials", "Healthcare",
  "Technology", "Consumer Staples", "Consumer Discretionary",
  "Industrials", "Materials", "Communication Services",
];

const REGIONS = [
  "Noord-Amerika", "Europa", "Azië-Pacific", "Emerging Markets", "Globaal",
];

const ASSET_MIX_PRESETS = [
  {
    label: "Dividend-gedreven",
    desc: "Hoog inkomen, weinig equity groei",
    mix: { equity: 20, credit: 30, realEstate: 30, privateAssets: 15, cash: 5 },
  },
  {
    label: "Gebalanceerd",
    desc: "Mix van inkomen en groei",
    mix: { equity: 40, credit: 20, realEstate: 20, privateAssets: 15, cash: 5 },
  },
  {
    label: "Groei",
    desc: "Focus op kapitaalgroei",
    mix: { equity: 60, credit: 10, realEstate: 15, privateAssets: 10, cash: 5 },
  },
  {
    label: "Conservatief",
    desc: "Laag risico, stabiele cashflow",
    mix: { equity: 15, credit: 40, realEstate: 20, privateAssets: 15, cash: 10 },
  },
];

interface QuestionnaireProps {
  onSubmit: (prefs: RebalancePreferences) => void;
  isLoading: boolean;
}

export function RebalanceQuestionnaire({ onSubmit, isLoading }: QuestionnaireProps) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<RebalancePreferences>({
    primaryGoal: "",
    investmentStyle: "",
    riskTolerance: 5,
    targetSectors: [],
    targetRegions: [],
    targetYieldMin: 4,
    targetYieldMax: 10,
    assetMixTarget: { equity: 40, credit: 20, realEstate: 20, privateAssets: 15, cash: 5 },
  });

  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const mixTotal = Object.values(prefs.assetMixTarget).reduce((s, v) => s + v, 0);
  const mixValid = mixTotal === 100;

  const canAdvance = () => {
    switch (step) {
      case 0: return !!prefs.primaryGoal;
      case 1: return !!prefs.investmentStyle;
      case 2: return true;
      case 3: return mixValid;
      case 4: return prefs.targetSectors.length > 0;
      case 5: return prefs.targetRegions.length > 0;
      case 6: return prefs.targetYieldMin < prefs.targetYieldMax;
      default: return false;
    }
  };

  const updateMix = (key: keyof AssetMixTarget, value: number) => {
    setPrefs((p) => ({ ...p, assetMixTarget: { ...p.assetMixTarget, [key]: value } }));
  };

  const applyPreset = (mix: AssetMixTarget) => {
    setPrefs((p) => ({ ...p, assetMixTarget: mix }));
  };

  const steps = [
    // Step 0: Primary goal
    <Card key="goal" className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Wat is je primaire beleggingsdoel?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={prefs.primaryGoal}
          onValueChange={(v) => setPrefs((p) => ({ ...p, primaryGoal: v }))}
          className="space-y-3"
        >
          {[
            { value: "dividend", label: "Dividend / Inkomen", desc: "Maximaliseer stabiele cashflow uit dividenden" },
            { value: "growth", label: "Groei", desc: "Focus op kapitaalgroei op lange termijn" },
            { value: "balanced", label: "Gebalanceerd", desc: "Combinatie van inkomen en groei" },
            { value: "capital_preservation", label: "Kapitaalbehoud", desc: "Minimaliseer risico, bescherm kapitaal" },
          ].map((opt) => (
            <div key={opt.value} className="flex items-start space-x-3 rounded-lg border p-3">
              <RadioGroupItem value={opt.value} id={`goal-${opt.value}`} className="mt-0.5" />
              <Label htmlFor={`goal-${opt.value}`} className="cursor-pointer flex-1">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.desc}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>,

    // Step 1: Investment style
    <Card key="style" className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Wat is je beleggingsstijl?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={prefs.investmentStyle}
          onValueChange={(v) => setPrefs((p) => ({ ...p, investmentStyle: v }))}
          className="space-y-3"
        >
          {[
            { value: "buy_and_hold", label: "Buy & Hold", desc: "Kopen en lang vasthouden, minimale handel" },
            { value: "active", label: "Actief", desc: "Regelmatig herbalanceren en posities aanpassen" },
            { value: "income_focused", label: "Inkomensgericht", desc: "Optimaliseren voor maandelijkse/kwartaal cashflow" },
            { value: "high_dividend", label: "Hoog Dividend", desc: "Zoeken naar de hoogste yields (>8%)" },
          ].map((opt) => (
            <div key={opt.value} className="flex items-start space-x-3 rounded-lg border p-3">
              <RadioGroupItem value={opt.value} id={`style-${opt.value}`} className="mt-0.5" />
              <Label htmlFor={`style-${opt.value}`} className="cursor-pointer flex-1">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.desc}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>,

    // Step 2: Risk tolerance
    <Card key="risk" className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Wat is je risicotolerantie?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Conservatief</span>
            <span className="text-lg font-bold tabular-nums">{prefs.riskTolerance}/10</span>
            <span className="text-sm text-muted-foreground">Agressief</span>
          </div>
          <Slider
            value={[prefs.riskTolerance]}
            onValueChange={([v]) => setPrefs((p) => ({ ...p, riskTolerance: v }))}
            min={1}
            max={10}
            step={1}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {prefs.riskTolerance <= 3
            ? "Lage risicotolerantie: focus op stabiele, bewezen dividendbetalers met lage volatiliteit."
            : prefs.riskTolerance <= 6
            ? "Gemiddelde risicotolerantie: bereid om enige volatiliteit te accepteren voor hoger rendement."
            : "Hoge risicotolerantie: bereid om significante koersschommelingen te accepteren voor potentieel hogere yields."}
        </p>
      </CardContent>
    </Card>,

    // Step 3: Asset mix target (NEW)
    <Card key="assetmix" className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Wat is je gewenste asset allocatie?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Stel de ideale verdeling in over alle asset categorieën. Totaal moet 100% zijn.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {ASSET_MIX_PRESETS.map((preset) => (
            <Badge
              key={preset.label}
              variant="outline"
              className="cursor-pointer text-xs py-1.5 px-3 hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => applyPreset(preset.mix)}
            >
              {preset.label}
            </Badge>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          {(
            [
              { key: "equity" as const, label: "Aandelen / ETF / CEF / BDC", color: "bg-blue-500" },
              { key: "credit" as const, label: "Credit / Obligaties / Preferreds / Baby Bonds", color: "bg-amber-500" },
              { key: "realEstate" as const, label: "Vastgoed / REIT", color: "bg-emerald-500" },
              { key: "privateAssets" as const, label: "Private investeringen", color: "bg-purple-500" },
              { key: "cash" as const, label: "Cash / Liquide middelen", color: "bg-slate-400" },
            ] as const
          ).map(({ key, label, color }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <Label className="text-sm">{label}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={prefs.assetMixTarget[key]}
                    onChange={(e) => updateMix(key, parseInt(e.target.value) || 0)}
                    className="w-16 h-7 text-xs text-center"
                  />
                  <span className="text-xs text-muted-foreground w-4">%</span>
                </div>
              </div>
              <Slider
                value={[prefs.assetMixTarget[key]]}
                onValueChange={([v]) => updateMix(key, v)}
                min={0}
                max={100}
                step={5}
              />
            </div>
          ))}
        </div>

        {/* Total indicator */}
        <div className={`flex items-center justify-between rounded-lg p-3 text-sm font-medium ${
          mixTotal === 100
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-destructive/10 text-destructive"
        }`}>
          <span>Totaal</span>
          <span>{mixTotal}% {mixTotal === 100 ? "✓" : `(${mixTotal > 100 ? "+" : ""}${mixTotal - 100}%)`}</span>
        </div>
      </CardContent>
    </Card>,

    // Step 4: Target sectors
    <Card key="sectors" className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Welke sectoren wil je benadrukken?
        </CardTitle>
        <p className="text-xs text-muted-foreground">Selecteer minstens één sector</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {SECTORS.map((s) => (
            <Badge
              key={s}
              variant={prefs.targetSectors.includes(s) ? "default" : "outline"}
              className="cursor-pointer text-sm py-1.5 px-3"
              onClick={() =>
                setPrefs((p) => ({ ...p, targetSectors: toggleItem(p.targetSectors, s) }))
              }
            >
              {s}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>,

    // Step 5: Target regions
    <Card key="regions" className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Welke regio's wil je benadrukken?
        </CardTitle>
        <p className="text-xs text-muted-foreground">Selecteer minstens één regio</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <Badge
              key={r}
              variant={prefs.targetRegions.includes(r) ? "default" : "outline"}
              className="cursor-pointer text-sm py-1.5 px-3"
              onClick={() =>
                setPrefs((p) => ({ ...p, targetRegions: toggleItem(p.targetRegions, r) }))
              }
            >
              {r}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>,

    // Step 6: Target yield range
    <Card key="yield" className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Wat is je gewenste dividend yield range?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Minimum (%)</Label>
            <Input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={prefs.targetYieldMin}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, targetYieldMin: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          <span className="text-muted-foreground mt-5">—</span>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Maximum (%)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={prefs.targetYieldMax}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, targetYieldMax: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Yields boven 10-12% kunnen een "yield trap" signaleren — een hoog dividend dat niet
          houdbaar is. De AI zal hiervoor waarschuwen.
        </p>
      </CardContent>
    </Card>,
  ];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {steps[step]}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Vorige
        </Button>

        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
            Volgende
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => onSubmit(prefs)} disabled={!canAdvance() || isLoading}>
            {isLoading ? "Analyseren..." : "Analyseer Portfolio"}
          </Button>
        )}
      </div>
    </div>
  );
}
