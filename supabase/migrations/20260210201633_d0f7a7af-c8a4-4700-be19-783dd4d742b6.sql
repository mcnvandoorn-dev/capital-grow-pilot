
-- Tighten securities: only allow insert/update if user is authenticated (already scoped to authenticated role, but make explicit)
DROP POLICY "Authenticated users can insert securities" ON public.securities;
DROP POLICY "Authenticated users can update securities" ON public.securities;

-- Insert: any authenticated user can add securities (needed for IBKR sync)
CREATE POLICY "Authenticated users can insert securities" ON public.securities 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Update: any authenticated user can update securities  
CREATE POLICY "Authenticated users can update securities" ON public.securities 
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- Same for fx_rates
DROP POLICY "Authenticated users can insert FX rates" ON public.fx_rates;

CREATE POLICY "Authenticated users can insert FX rates" ON public.fx_rates 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
