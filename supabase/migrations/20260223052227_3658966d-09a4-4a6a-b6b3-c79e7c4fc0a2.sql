
-- SP Availability table (persists weekly schedule, blackouts, capacity)
CREATE TABLE public.sp_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sp_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  schedule_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  blackout_dates text[] NOT NULL DEFAULT '{}'::text[],
  max_jobs_per_day integer NOT NULL DEFAULT 5,
  travel_radius_km integer NOT NULL DEFAULT 30,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(sp_id)
);

ALTER TABLE public.sp_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to sp_availability"
ON public.sp_availability FOR ALL
USING (true)
WITH CHECK (true);

-- Availability audit events
CREATE TABLE public.availability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sp_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  changed_by_user_id uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text DEFAULT ''
);

ALTER TABLE public.availability_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to availability_events"
ON public.availability_events FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at on sp_availability
CREATE TRIGGER update_sp_availability_updated_at
BEFORE UPDATE ON public.sp_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
