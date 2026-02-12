
-- Fundamental indicators per security, one row per security per snapshot date
CREATE TABLE public.fundamental_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id uuid NOT NULL REFERENCES public.securities(id),
  data_date date NOT NULL,
  
  -- Valuation
  pe_ratio numeric,
  
  -- Dividend metrics
  dividend_yield numeric,
  payout_ratio numeric,
  dividend_cagr_5y numeric,
  
  -- Growth metrics
  revenue_growth_3y numeric,
  revenue_growth_5y numeric,
  earnings_growth_3y numeric,
  earnings_growth_5y numeric,
  
  -- Metadata
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(security_id, data_date)
);

ALTER TABLE public.fundamental_data ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (shared reference data)
CREATE POLICY "Authenticated users can read fundamental data"
  ON public.fundamental_data FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fundamental data"
  ON public.fundamental_data FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update fundamental data"
  ON public.fundamental_data FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_fundamental_security_date ON public.fundamental_data(security_id, data_date DESC);
