
-- Asset class enum
CREATE TYPE public.asset_class AS ENUM ('CEF', 'BDC', 'REIT', 'ETF', 'PREFERRED', 'BABY_BOND', 'OTHER');

-- Transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'ROC', 'SPLIT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- Currency enum
CREATE TYPE public.currency_code AS ENUM ('USD', 'EUR', 'CAD', 'GBP', 'CHF', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK');

-- Sync source enum
CREATE TYPE public.sync_source AS ENUM ('FLEX_QUERY', 'CLIENT_PORTAL', 'MANUAL');

-- Investor strategy enum
CREATE TYPE public.investor_strategy AS ENUM ('BUY_AND_HOLD', 'WORKING_CAPITAL_GROWTH');

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  base_currency currency_code NOT NULL DEFAULT 'USD',
  default_strategy investor_strategy NOT NULL DEFAULT 'BUY_AND_HOLD',
  working_capital_gain_min NUMERIC(5,2) DEFAULT 3.0,
  working_capital_gain_max NUMERIC(5,2) DEFAULT 10.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- IBKR CONNECTIONS
-- ============================================
CREATE TABLE public.ibkr_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_name TEXT NOT NULL,
  flex_token TEXT,
  flex_query_id TEXT,
  client_portal_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ibkr_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own IBKR connections" ON public.ibkr_connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PORTFOLIOS
-- ============================================
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ibkr_connection_id UUID REFERENCES public.ibkr_connections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  ibkr_account_id TEXT,
  base_currency currency_code NOT NULL DEFAULT 'USD',
  strategy investor_strategy NOT NULL DEFAULT 'BUY_AND_HOLD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own portfolios" ON public.portfolios FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- SECURITIES (master list, shared across users)
-- ============================================
CREATE TABLE public.securities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  name TEXT,
  asset_class asset_class NOT NULL DEFAULT 'OTHER',
  currency currency_code NOT NULL DEFAULT 'USD',
  exchange TEXT,
  isin TEXT,
  conid TEXT,
  sector TEXT,
  dividend_frequency TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticker, exchange)
);

ALTER TABLE public.securities ENABLE ROW LEVEL SECURITY;

-- Securities are readable by all authenticated users
CREATE POLICY "Authenticated users can read securities" ON public.securities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert securities" ON public.securities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update securities" ON public.securities FOR UPDATE TO authenticated USING (true);

-- ============================================
-- TRANSACTIONS
-- ============================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  security_id UUID NOT NULL REFERENCES public.securities(id),
  transaction_type transaction_type NOT NULL,
  trade_date DATE NOT NULL,
  settlement_date DATE,
  quantity NUMERIC(18,6) NOT NULL,
  price NUMERIC(18,6) NOT NULL,
  commission NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency currency_code NOT NULL,
  fx_rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1.0,
  gross_amount NUMERIC(18,4) NOT NULL,
  net_amount NUMERIC(18,4) NOT NULL,
  ibkr_trade_id TEXT,
  sync_source sync_source NOT NULL DEFAULT 'MANUAL',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()));

-- ============================================
-- POSITIONS (current holdings, materialized from transactions)
-- ============================================
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  security_id UUID NOT NULL REFERENCES public.securities(id),
  quantity NUMERIC(18,6) NOT NULL DEFAULT 0,
  avg_cost_basis NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_cost_basis NUMERIC(18,4) NOT NULL DEFAULT 0,
  currency currency_code NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, security_id)
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own positions" ON public.positions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()));

-- ============================================
-- DIVIDEND HISTORY
-- ============================================
CREATE TABLE public.dividend_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  security_id UUID NOT NULL REFERENCES public.securities(id),
  ex_date DATE NOT NULL,
  pay_date DATE,
  record_date DATE,
  amount_per_share NUMERIC(12,6) NOT NULL,
  total_amount NUMERIC(18,4) NOT NULL,
  currency currency_code NOT NULL,
  fx_rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1.0,
  is_roc BOOLEAN NOT NULL DEFAULT false,
  withholding_tax NUMERIC(12,4) NOT NULL DEFAULT 0,
  net_amount NUMERIC(18,4) NOT NULL,
  sync_source sync_source NOT NULL DEFAULT 'MANUAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dividend_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dividend history" ON public.dividend_history FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()));

-- ============================================
-- FX RATES (historical, at transaction time)
-- ============================================
CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency currency_code NOT NULL,
  to_currency currency_code NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  rate_date DATE NOT NULL,
  source TEXT DEFAULT 'IBKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency, rate_date)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read FX rates" ON public.fx_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert FX rates" ON public.fx_rates FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- SYNC LOGS
-- ============================================
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ibkr_connection_id UUID REFERENCES public.ibkr_connections(id) ON DELETE SET NULL,
  sync_source sync_source NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs" ON public.sync_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync logs" ON public.sync_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sync logs" ON public.sync_logs FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- WORKING CAPITAL TRACKING (for capital growth strategy)
-- ============================================
CREATE TABLE public.capital_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  sell_transaction_id UUID REFERENCES public.transactions(id),
  buy_transaction_id UUID REFERENCES public.transactions(id),
  security_sold_id UUID REFERENCES public.securities(id),
  security_bought_id UUID REFERENCES public.securities(id),
  capital_gain_pct NUMERIC(8,4),
  capital_gain_amount NUMERIC(18,4),
  reinvested_amount NUMERIC(18,4),
  event_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.capital_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own capital events" ON public.capital_events FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()));

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_transactions_portfolio ON public.transactions(portfolio_id);
CREATE INDEX idx_transactions_security ON public.transactions(security_id);
CREATE INDEX idx_transactions_trade_date ON public.transactions(trade_date);
CREATE INDEX idx_positions_portfolio ON public.positions(portfolio_id);
CREATE INDEX idx_dividend_history_portfolio ON public.dividend_history(portfolio_id);
CREATE INDEX idx_dividend_history_ex_date ON public.dividend_history(ex_date);
CREATE INDEX idx_fx_rates_date ON public.fx_rates(rate_date);
CREATE INDEX idx_securities_ticker ON public.securities(ticker);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ibkr_connections_updated_at BEFORE UPDATE ON public.ibkr_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_securities_updated_at BEFORE UPDATE ON public.securities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
