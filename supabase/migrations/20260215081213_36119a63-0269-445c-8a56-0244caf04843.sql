-- Fix security definer view by making it security invoker
DROP VIEW IF EXISTS public.ibkr_connections_safe;

CREATE VIEW public.ibkr_connections_safe
WITH (security_invoker = on)
AS
SELECT id, user_id, connection_name, client_portal_enabled, 
       last_sync_at, sync_status, strategy, created_at, updated_at
FROM public.ibkr_connections;

GRANT SELECT ON public.ibkr_connections_safe TO authenticated;