
-- Default scoring weights per user (configurable)
CREATE TABLE public.scoring_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  -- Technical weights (should sum with fundamental weights to 1.0)
  w_technical numeric NOT NULL DEFAULT 0.4,
  w_fundamental numeric NOT NULL DEFAULT 0.6,
  -- Technical sub-weights (should sum to 1.0)
  w_rsi numeric NOT NULL DEFAULT 0.5,
  w_52w_range numeric NOT NULL DEFAULT 0.5,
  -- Fundamental sub-weights (should sum to 1.0)
  w_pe numeric NOT NULL DEFAULT 0.25,
  w_payout_ratio numeric NOT NULL DEFAULT 0.20,
  w_dividend_cagr numeric NOT NULL DEFAULT 0.25,
  w_revenue_growth numeric NOT NULL DEFAULT 0.30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scoring_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scoring weights"
  ON public.scoring_weights FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Computed scores per security per user (user-specific because weights differ)
CREATE TABLE public.security_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  security_id uuid NOT NULL REFERENCES public.securities(id),
  scored_at timestamptz NOT NULL DEFAULT now(),
  
  -- Category scores (0-100)
  technical_score numeric,
  fundamental_score numeric,
  total_score numeric,
  
  -- Individual normalized component scores (0-100) for breakdown
  rsi_score numeric,
  range_52w_score numeric,
  pe_score numeric,
  payout_score numeric,
  dividend_cagr_score numeric,
  revenue_growth_score numeric,
  
  -- Inputs used (for audit/debugging)
  inputs_json jsonb,
  
  UNIQUE(user_id, security_id)
);

ALTER TABLE public.security_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own security scores"
  ON public.security_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_security_scores_user_total ON public.security_scores(user_id, total_score DESC);

-- Scoring function: normalizes inputs and computes weighted score
-- Called from edge function or client; pure SQL for transparency
CREATE OR REPLACE FUNCTION public.calculate_security_score(
  p_user_id uuid,
  p_security_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rsi numeric;
  v_close numeric;
  v_high_52w numeric;
  v_low_52w numeric;
  v_pe numeric;
  v_payout numeric;
  v_div_cagr numeric;
  v_rev_growth numeric;
  
  v_rsi_score numeric;
  v_range_score numeric;
  v_pe_score numeric;
  v_payout_score numeric;
  v_cagr_score numeric;
  v_rev_score numeric;
  
  v_tech_score numeric;
  v_fund_score numeric;
  v_total numeric;
  
  w scoring_weights%ROWTYPE;
  v_tech_parts int;
  v_fund_parts int;
BEGIN
  -- Get user weights (or defaults)
  SELECT * INTO w FROM scoring_weights WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    w.w_technical := 0.4;
    w.w_fundamental := 0.6;
    w.w_rsi := 0.5;
    w.w_52w_range := 0.5;
    w.w_pe := 0.25;
    w.w_payout_ratio := 0.20;
    w.w_dividend_cagr := 0.25;
    w.w_revenue_growth := 0.30;
  END IF;

  -- Latest technical data
  SELECT rsi_14, close_price INTO v_rsi, v_close
  FROM market_data
  WHERE security_id = p_security_id
  ORDER BY data_date DESC LIMIT 1;

  -- 52-week high/low
  SELECT MAX(close_price), MIN(close_price) INTO v_high_52w, v_low_52w
  FROM market_data
  WHERE security_id = p_security_id
    AND data_date >= CURRENT_DATE - INTERVAL '52 weeks';

  -- Latest fundamental data
  SELECT pe_ratio, payout_ratio, dividend_cagr_5y, revenue_growth_5y
  INTO v_pe, v_payout, v_div_cagr, v_rev_growth
  FROM fundamental_data
  WHERE security_id = p_security_id
  ORDER BY data_date DESC LIMIT 1;

  -- === NORMALIZATION (all to 0-100, higher = more attractive) ===

  -- RSI: inverted bell curve centered at 50
  -- RSI 30 (oversold=buy opportunity) → 100, RSI 50 → 60, RSI 70+ (overbought) → 0
  IF v_rsi IS NOT NULL THEN
    v_rsi_score := GREATEST(0, LEAST(100, (70 - v_rsi) * (100.0 / 40)));
  END IF;

  -- 52-week range position: lower = more attractive (closer to 52w low)
  -- 0% of range → 100, 100% of range → 0
  IF v_close IS NOT NULL AND v_high_52w IS NOT NULL AND v_low_52w IS NOT NULL
     AND v_high_52w > v_low_52w THEN
    v_range_score := GREATEST(0, LEAST(100,
      (1 - (v_close - v_low_52w) / (v_high_52w - v_low_52w)) * 100
    ));
  END IF;

  -- P/E: lower is better. Clamp 0-40 range → 100-0
  IF v_pe IS NOT NULL AND v_pe > 0 THEN
    v_pe_score := GREATEST(0, LEAST(100, (1 - v_pe / 40.0) * 100));
  END IF;

  -- Payout ratio: sweet spot 30-70%. Below 30 → slightly penalized, above 80 → risky
  IF v_payout IS NOT NULL THEN
    IF v_payout <= 0 THEN v_payout_score := 0;
    ELSIF v_payout <= 30 THEN v_payout_score := 50 + (v_payout / 30.0) * 30;
    ELSIF v_payout <= 70 THEN v_payout_score := 80 + ((70 - ABS(v_payout - 50)) / 20.0) * 20;
    ELSIF v_payout <= 100 THEN v_payout_score := GREATEST(0, 80 - (v_payout - 70) * (80.0 / 30));
    ELSE v_payout_score := 0;
    END IF;
  END IF;

  -- Dividend CAGR 5y: higher is better. 0% → 30, 5% → 60, 10%+ → 100
  IF v_div_cagr IS NOT NULL THEN
    v_cagr_score := GREATEST(0, LEAST(100, 30 + v_div_cagr * 700));
  END IF;

  -- Revenue growth 5y: higher is better. 0% → 40, 10%+ → 100
  IF v_rev_growth IS NOT NULL THEN
    v_rev_score := GREATEST(0, LEAST(100, 40 + v_rev_growth * 600));
  END IF;

  -- === WEIGHTED AGGREGATION (skip NULL components) ===
  v_tech_parts := 0;
  v_tech_score := 0;
  IF v_rsi_score IS NOT NULL THEN
    v_tech_score := v_tech_score + w.w_rsi * v_rsi_score;
    v_tech_parts := v_tech_parts + 1;
  END IF;
  IF v_range_score IS NOT NULL THEN
    v_tech_score := v_tech_score + w.w_52w_range * v_range_score;
    v_tech_parts := v_tech_parts + 1;
  END IF;
  -- Re-normalize if partial data
  IF v_tech_parts = 1 THEN
    v_tech_score := v_tech_score / (CASE WHEN v_rsi_score IS NOT NULL THEN w.w_rsi ELSE w.w_52w_range END);
  ELSIF v_tech_parts = 0 THEN
    v_tech_score := NULL;
  END IF;

  v_fund_parts := 0;
  v_fund_score := 0;
  DECLARE v_fund_weight_sum numeric := 0;
  BEGIN
    IF v_pe_score IS NOT NULL THEN
      v_fund_score := v_fund_score + w.w_pe * v_pe_score;
      v_fund_weight_sum := v_fund_weight_sum + w.w_pe;
    END IF;
    IF v_payout_score IS NOT NULL THEN
      v_fund_score := v_fund_score + w.w_payout_ratio * v_payout_score;
      v_fund_weight_sum := v_fund_weight_sum + w.w_payout_ratio;
    END IF;
    IF v_cagr_score IS NOT NULL THEN
      v_fund_score := v_fund_score + w.w_dividend_cagr * v_cagr_score;
      v_fund_weight_sum := v_fund_weight_sum + w.w_dividend_cagr;
    END IF;
    IF v_rev_score IS NOT NULL THEN
      v_fund_score := v_fund_score + w.w_revenue_growth * v_rev_score;
      v_fund_weight_sum := v_fund_weight_sum + w.w_revenue_growth;
    END IF;
    IF v_fund_weight_sum > 0 THEN
      v_fund_score := v_fund_score / v_fund_weight_sum;
    ELSE
      v_fund_score := NULL;
    END IF;
  END;

  -- Total score
  IF v_tech_score IS NOT NULL AND v_fund_score IS NOT NULL THEN
    v_total := w.w_technical * v_tech_score + w.w_fundamental * v_fund_score;
  ELSIF v_tech_score IS NOT NULL THEN
    v_total := v_tech_score;
  ELSIF v_fund_score IS NOT NULL THEN
    v_total := v_fund_score;
  END IF;

  -- Upsert into security_scores
  INSERT INTO security_scores (user_id, security_id, scored_at,
    technical_score, fundamental_score, total_score,
    rsi_score, range_52w_score, pe_score, payout_score,
    dividend_cagr_score, revenue_growth_score, inputs_json)
  VALUES (p_user_id, p_security_id, now(),
    ROUND(v_tech_score, 2), ROUND(v_fund_score, 2), ROUND(v_total, 2),
    ROUND(v_rsi_score, 2), ROUND(v_range_score, 2), ROUND(v_pe_score, 2),
    ROUND(v_payout_score, 2), ROUND(v_cagr_score, 2), ROUND(v_rev_score, 2),
    jsonb_build_object(
      'rsi', v_rsi, 'close', v_close, 'high_52w', v_high_52w, 'low_52w', v_low_52w,
      'pe', v_pe, 'payout', v_payout, 'div_cagr', v_div_cagr, 'rev_growth', v_rev_growth
    ))
  ON CONFLICT (user_id, security_id) DO UPDATE SET
    scored_at = EXCLUDED.scored_at,
    technical_score = EXCLUDED.technical_score,
    fundamental_score = EXCLUDED.fundamental_score,
    total_score = EXCLUDED.total_score,
    rsi_score = EXCLUDED.rsi_score,
    range_52w_score = EXCLUDED.range_52w_score,
    pe_score = EXCLUDED.pe_score,
    payout_score = EXCLUDED.payout_score,
    dividend_cagr_score = EXCLUDED.dividend_cagr_score,
    revenue_growth_score = EXCLUDED.revenue_growth_score,
    inputs_json = EXCLUDED.inputs_json;

  RETURN jsonb_build_object(
    'total_score', ROUND(v_total, 2),
    'technical_score', ROUND(v_tech_score, 2),
    'fundamental_score', ROUND(v_fund_score, 2),
    'breakdown', jsonb_build_object(
      'rsi_score', ROUND(v_rsi_score, 2),
      'range_52w_score', ROUND(v_range_score, 2),
      'pe_score', ROUND(v_pe_score, 2),
      'payout_score', ROUND(v_payout_score, 2),
      'dividend_cagr_score', ROUND(v_cagr_score, 2),
      'revenue_growth_score', ROUND(v_rev_score, 2)
    ),
    'weights', jsonb_build_object(
      'technical', w.w_technical, 'fundamental', w.w_fundamental,
      'rsi', w.w_rsi, 'range_52w', w.w_52w_range,
      'pe', w.w_pe, 'payout', w.w_payout_ratio,
      'dividend_cagr', w.w_dividend_cagr, 'revenue_growth', w.w_revenue_growth
    )
  );
END;
$$;
