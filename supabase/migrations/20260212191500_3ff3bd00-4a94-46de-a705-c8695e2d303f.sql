
-- Table for deep dive research items
CREATE TABLE public.deep_dive_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  security_id UUID NOT NULL REFERENCES public.securities(id),
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('scrape', 'upload')),
  title TEXT NOT NULL,
  url TEXT,
  content_markdown TEXT,
  summary TEXT,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deep_dive_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own deep dive items"
  ON public.deep_dive_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_deep_dive_items_updated_at
  BEFORE UPDATE ON public.deep_dive_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for uploaded PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('deep-dive-docs', 'deep-dive-docs', false);

CREATE POLICY "Users can upload own deep dive docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deep-dive-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own deep dive docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deep-dive-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own deep dive docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deep-dive-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
