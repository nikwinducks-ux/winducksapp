
-- Create offers table
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  sp_id UUID NOT NULL REFERENCES public.service_providers(id),
  allocation_run_id UUID REFERENCES public.allocation_runs(id),
  status TEXT NOT NULL DEFAULT 'Pending',
  offered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  responded_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  acceptance_source TEXT NOT NULL DEFAULT 'Manual',
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);

-- Add columns to allocation_runs
ALTER TABLE public.allocation_runs
  ADD COLUMN IF NOT EXISTS strategy TEXT NOT NULL DEFAULT 'TopNBroadcast',
  ADD COLUMN IF NOT EXISTS top_n INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- Index for quick lookups
CREATE INDEX idx_offers_job_id ON public.offers(job_id);
CREATE INDEX idx_offers_sp_id ON public.offers(sp_id);
CREATE INDEX idx_offers_status ON public.offers(status);
