import { createContext, useContext, useState, ReactNode } from "react";

type DisplayCurrency = "EUR" | "USD";

interface CurrencyContextType {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "EUR",
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<DisplayCurrency>("EUR");
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  return useContext(CurrencyContext);
}
