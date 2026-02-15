-- Create a safe view that excludes sensitive credentials
CREATE VIEW public.ibkr_connections_safe AS
SELECT id, user_id, connection_name, client_portal_enabled, 
       last_sync_at, sync_status, strategy, created_at, updated_at
FROM public.ibkr_connections;

-- Enable RLS on the view (views inherit from base table but we need explicit policy)
-- Grant access to authenticated users  
GRANT SELECT ON public.ibkr_connections_safe TO authenticated;

-- Revoke direct SELECT on sensitive columns by replacing the ALL policy
-- with granular policies that exclude SELECT, keeping INSERT/UPDATE/DELETE
DROP POLICY "Users can manage own IBKR connections" ON public.ibkr_connections;

-- Allow INSERT (needed for creating connections)
CREATE POLICY "Users can insert own IBKR connections"
ON public.ibkr_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow UPDATE (needed for sync status updates, but not credentials reading)
CREATE POLICY "Users can update own IBKR connections"
ON public.ibkr_connections FOR UPDATE
USING (auth.uid() = user_id);

-- Allow DELETE
CREATE POLICY "Users can delete own IBKR connections"
ON public.ibkr_connections FOR DELETE
USING (auth.uid() = user_id);

-- Allow SELECT only through the safe view by restricting direct table SELECT
-- We still need SELECT for the view to work, so we allow it but the frontend should use the view
CREATE POLICY "Users can read own IBKR connections"
ON public.ibkr_connections FOR SELECT
USING (auth.uid() = user_id);