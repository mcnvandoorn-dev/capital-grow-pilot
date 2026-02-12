
-- Create enums for alert system
CREATE TYPE public.alert_type AS ENUM ('PRICE', 'DISCOUNT_TO_NAV', 'RSI', 'Z_SCORE');
CREATE TYPE public.alert_condition AS ENUM ('ABOVE', 'BELOW', 'CROSSES_ABOVE', 'CROSSES_BELOW');

-- Market data table
CREATE TABLE public.market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id uuid NOT NULL REFERENCES public.securities(id),
  data_date date NOT NULL,
  close_price numeric,
  nav numeric,
  market_price numeric,
  rsi_14 numeric,
  z_score numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(security_id, data_date)
);

ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read market data"
  ON public.market_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert market data"
  ON public.market_data FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update market data"
  ON public.market_data FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- Alerts table
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  security_id uuid NOT NULL REFERENCES public.securities(id),
  portfolio_id uuid REFERENCES public.portfolios(id),
  alert_type public.alert_type NOT NULL,
  condition public.alert_condition NOT NULL,
  threshold numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_triggered boolean NOT NULL DEFAULT false,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alerts"
  ON public.alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Alert notifications table
CREATE TABLE public.alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  triggered_value numeric NOT NULL,
  is_read boolean NOT NULL DEFAULT false
);

ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alert notifications"
  ON public.alert_notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_market_data_security_date ON public.market_data(security_id, data_date DESC);
CREATE INDEX idx_alerts_active ON public.alerts(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_alert_notifications_unread ON public.alert_notifications(user_id, is_read) WHERE is_read = false;
