
-- Private Investments table
CREATE TABLE public.private_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('private_equity', 'private_debt', 'real_estate', 'venture_capital', 'family_loan', 'other')),
  invested_amount NUMERIC NOT NULL,
  current_value NUMERIC,
  annual_cashflow NUMERIC NOT NULL DEFAULT 0,
  cashflow_frequency TEXT NOT NULL DEFAULT 'annually' CHECK (cashflow_frequency IN ('monthly', 'quarterly', 'annually')),
  expected_growth_pct NUMERIC DEFAULT 0,
  start_date DATE NOT NULL,
  exit_horizon DATE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  sector_label TEXT,
  geography_label TEXT,
  risk_bucket TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.private_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own private investments"
  ON public.private_investments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Valuation history for tracking value over time
CREATE TABLE public.private_investment_valuations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investment_id UUID NOT NULL REFERENCES public.private_investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  valuation_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.private_investment_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own valuations"
  ON public.private_investment_valuations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cashflow history for realized income
CREATE TABLE public.private_investment_cashflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investment_id UUID NOT NULL REFERENCES public.private_investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cashflow_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  cashflow_type TEXT NOT NULL DEFAULT 'income' CHECK (cashflow_type IN ('income', 'return_of_capital', 'distribution')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.private_investment_cashflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cashflows"
  ON public.private_investment_cashflows FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_private_investments_updated_at
  BEFORE UPDATE ON public.private_investments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
