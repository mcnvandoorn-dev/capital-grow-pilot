import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";

export function CurrencyToggle() {
  const { currency, setCurrency } = useDisplayCurrency();

  return (
    <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
      <Button
        variant={currency === "EUR" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-3 text-xs font-medium"
        onClick={() => setCurrency("EUR")}
      >
        €&nbsp;EUR
      </Button>
      <Button
        variant={currency === "USD" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-3 text-xs font-medium"
        onClick={() => setCurrency("USD")}
      >
        $&nbsp;USD
      </Button>
    </div>
  );
}
