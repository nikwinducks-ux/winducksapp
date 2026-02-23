
-- Create job_services line-item table
CREATE TABLE public.job_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC DEFAULT NULL,
  line_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_job_services_job_id ON public.job_services(job_id);

-- Enable RLS
ALTER TABLE public.job_services ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access" ON public.job_services FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- SP can read services for their assigned jobs
CREATE POLICY "SP select services of assigned jobs" ON public.job_services FOR SELECT
  USING (job_id IN (
    SELECT id FROM public.jobs WHERE assigned_sp_id = get_user_sp_id(auth.uid())
  ));

-- SP can also read services for broadcast jobs they can see
CREATE POLICY "SP select services of broadcast jobs" ON public.job_services FOR SELECT
  USING (
    has_role(auth.uid(), 'sp'::app_role) AND
    job_id IN (
      SELECT id FROM public.jobs WHERE sp_eligible_for_broadcast_job(get_user_sp_id(auth.uid()), id)
    )
  );

-- Backfill: create one job_services row per existing job that has a service_category set
INSERT INTO public.job_services (job_id, service_category, quantity, unit_price, line_total)
SELECT id, service_category, 1, payout, payout
FROM public.jobs
WHERE service_category != '' AND service_category IS NOT NULL;
