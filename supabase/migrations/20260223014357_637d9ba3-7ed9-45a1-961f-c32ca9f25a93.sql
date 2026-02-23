
-- Create job_status_events audit table
CREATE TABLE public.job_status_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by_user_id UUID,
  changed_by_sp_id UUID,
  note TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to job_status_events"
ON public.job_status_events
FOR ALL
USING (true)
WITH CHECK (true);

-- Create a DB function to auto-assign next job_number on insert
CREATE OR REPLACE FUNCTION public.assign_job_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  -- Only assign if job_number is empty or null
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    -- Extract numeric parts from existing job_numbers like JOB-1001
    SELECT COALESCE(MAX(
      CASE 
        WHEN job_number ~ '^JOB-[0-9]+$' THEN CAST(SUBSTRING(job_number FROM 5) AS INTEGER)
        ELSE 0
      END
    ), 0) INTO max_num FROM public.jobs;
    
    next_num := max_num + 1;
    NEW.job_number := 'JOB-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_job_number
BEFORE INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.assign_job_number();

-- Backfill any existing jobs that have empty job_number
DO $$
DECLARE
  rec RECORD;
  counter INTEGER;
  max_num INTEGER;
BEGIN
  -- Find current max
  SELECT COALESCE(MAX(
    CASE 
      WHEN job_number ~ '^JOB-[0-9]+$' THEN CAST(SUBSTRING(job_number FROM 5) AS INTEGER)
      ELSE 0
    END
  ), 0) INTO max_num FROM public.jobs;
  
  counter := max_num + 1;
  
  FOR rec IN SELECT id FROM public.jobs WHERE job_number IS NULL OR job_number = '' ORDER BY created_at ASC
  LOOP
    UPDATE public.jobs SET job_number = 'JOB-' || LPAD(counter::TEXT, 4, '0') WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
END;
$$;
