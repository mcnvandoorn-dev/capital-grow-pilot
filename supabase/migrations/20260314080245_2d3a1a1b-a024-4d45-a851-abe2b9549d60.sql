-- Allow authenticated users to insert new securities (shared reference data)
CREATE POLICY "Authenticated users can insert securities"
ON public.securities
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to insert market_data (for manual price entry)
CREATE POLICY "Authenticated users can insert market data"
ON public.market_data
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to insert fx_rates
CREATE POLICY "Authenticated users can insert fx rates"
ON public.fx_rates
FOR INSERT
TO authenticated
WITH CHECK (true);