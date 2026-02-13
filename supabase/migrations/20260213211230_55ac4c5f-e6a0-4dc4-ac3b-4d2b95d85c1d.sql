-- Add DIVIDEND_GROWTH to investor_strategy enum
ALTER TYPE public.investor_strategy ADD VALUE IF NOT EXISTS 'DIVIDEND_GROWTH';

-- Add strategy column to ibkr_connections so user can assign a strategy per connection
ALTER TABLE public.ibkr_connections ADD COLUMN IF NOT EXISTS strategy public.investor_strategy NOT NULL DEFAULT 'BUY_AND_HOLD';

-- Allow users to delete their own portfolios (cascade positions etc.)
-- Add ON DELETE CASCADE to positions -> portfolios FK
ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_portfolio_id_fkey;
ALTER TABLE public.positions ADD CONSTRAINT positions_portfolio_id_fkey 
  FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to transactions -> portfolios FK
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_portfolio_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_portfolio_id_fkey 
  FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to dividend_history -> portfolios FK
ALTER TABLE public.dividend_history DROP CONSTRAINT IF EXISTS dividend_history_portfolio_id_fkey;
ALTER TABLE public.dividend_history ADD CONSTRAINT dividend_history_portfolio_id_fkey 
  FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to capital_events -> portfolios FK
ALTER TABLE public.capital_events DROP CONSTRAINT IF EXISTS capital_events_portfolio_id_fkey;
ALTER TABLE public.capital_events ADD CONSTRAINT capital_events_portfolio_id_fkey 
  FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;