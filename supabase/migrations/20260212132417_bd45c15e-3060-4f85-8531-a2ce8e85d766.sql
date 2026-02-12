
-- Add industry column to securities (sector exists, industry not yet)
ALTER TABLE public.securities ADD COLUMN IF NOT EXISTS industry text;

-- Watchlist: many-to-many between users and securities
CREATE TABLE public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  security_id uuid NOT NULL REFERENCES public.securities(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(user_id, security_id)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watchlist"
  ON public.watchlist FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_watchlist_user ON public.watchlist(user_id);
