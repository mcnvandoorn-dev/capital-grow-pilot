
CREATE TABLE public.rebalance_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  preferences jsonb NOT NULL,
  proposal jsonb NOT NULL,
  summary_short text GENERATED ALWAYS AS (left(proposal->>'summary', 120)) STORED
);

ALTER TABLE public.rebalance_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rebalance proposals"
  ON public.rebalance_proposals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_rebalance_proposals_user_created 
  ON public.rebalance_proposals(user_id, created_at DESC);
