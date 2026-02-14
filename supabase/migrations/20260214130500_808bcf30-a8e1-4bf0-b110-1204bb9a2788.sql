
-- Issuer exposure: revenue segments and geographic breakdown per security
CREATE TABLE public.issuer_exposures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  security_id UUID NOT NULL REFERENCES public.securities(id) ON DELETE CASCADE,
  exposure_type TEXT NOT NULL, -- 'revenue_segment', 'geographic', 'risk_bucket'
  label TEXT NOT NULL, -- e.g. 'Consumer Electronics', 'United States', 'Cyclical'
  sub_label TEXT, -- e.g. GICS sub-sector or region detail
  weight NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1), -- 0.0 to 1.0
  source TEXT NOT NULL DEFAULT 'ai', -- 'ai', 'scrape', 'manual'
  confidence TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  source_url TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(security_id, exposure_type, label)
);

ALTER TABLE public.issuer_exposures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read issuer exposures"
  ON public.issuer_exposures FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert issuer exposures"
  ON public.issuer_exposures FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update issuer exposures"
  ON public.issuer_exposures FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete issuer exposures"
  ON public.issuer_exposures FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Exposure snapshots for audit trail
CREATE TABLE public.exposure_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_value NUMERIC NOT NULL,
  exposure_data JSONB NOT NULL, -- full aggregated exposure breakdown
  reconciliation_delta NUMERIC, -- diff vs IBKR NAV
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE public.exposure_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own exposure snapshots"
  ON public.exposure_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_issuer_exposures_security ON public.issuer_exposures(security_id, exposure_type);
CREATE INDEX idx_exposure_snapshots_user_date ON public.exposure_snapshots(user_id, snapshot_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_issuer_exposures_updated_at
  BEFORE UPDATE ON public.issuer_exposures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
