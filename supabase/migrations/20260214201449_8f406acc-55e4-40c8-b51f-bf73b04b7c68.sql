
-- Remove client-side write policies on shared reference tables
-- Edge functions use service_role which bypasses RLS, so these are not needed

-- securities: remove INSERT and UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert securities" ON public.securities;
DROP POLICY IF EXISTS "Authenticated users can update securities" ON public.securities;

-- fx_rates: remove INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert FX rates" ON public.fx_rates;

-- market_data: remove INSERT and UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert market data" ON public.market_data;
DROP POLICY IF EXISTS "Authenticated users can update market data" ON public.market_data;

-- fundamental_data: remove INSERT and UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert fundamental data" ON public.fundamental_data;
DROP POLICY IF EXISTS "Authenticated users can update fundamental data" ON public.fundamental_data;

-- issuer_exposures: remove INSERT, UPDATE, and DELETE policies
DROP POLICY IF EXISTS "Authenticated users can insert issuer exposures" ON public.issuer_exposures;
DROP POLICY IF EXISTS "Authenticated users can update issuer exposures" ON public.issuer_exposures;
DROP POLICY IF EXISTS "Authenticated users can delete issuer exposures" ON public.issuer_exposures;
