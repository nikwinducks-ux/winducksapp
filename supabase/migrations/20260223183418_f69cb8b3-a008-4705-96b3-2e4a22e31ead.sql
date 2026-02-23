
-- A) Add started_at and completed_at timestamp columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT NULL;

-- B) Add RLS policy allowing SP to update ONLY status on their assigned jobs
-- Drop any existing SP update policy on jobs first
DO $$
BEGIN
  DROP POLICY IF EXISTS "SP update assigned job status" ON public.jobs;
END$$;

CREATE POLICY "SP update assigned job status"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    assigned_sp_id = get_user_sp_id(auth.uid())
  )
  WITH CHECK (
    assigned_sp_id = get_user_sp_id(auth.uid())
  );

-- C) Create a trigger to enforce SP can only change status/started_at/completed_at
-- and to auto-set timestamps
CREATE OR REPLACE FUNCTION public.enforce_sp_job_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  _is_admin := has_role(auth.uid(), 'admin');
  
  -- If not admin, enforce column-level restrictions
  IF NOT _is_admin THEN
    -- SP must not change these fields
    IF NEW.assigned_sp_id IS DISTINCT FROM OLD.assigned_sp_id THEN
      RAISE EXCEPTION 'SP cannot change assigned_sp_id';
    END IF;
    IF NEW.payout IS DISTINCT FROM OLD.payout THEN
      RAISE EXCEPTION 'SP cannot change payout';
    END IF;
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      RAISE EXCEPTION 'SP cannot change customer_id';
    END IF;
    IF NEW.job_address_street IS DISTINCT FROM OLD.job_address_street
       OR NEW.job_address_city IS DISTINCT FROM OLD.job_address_city
       OR NEW.job_address_region IS DISTINCT FROM OLD.job_address_region
       OR NEW.job_address_postal IS DISTINCT FROM OLD.job_address_postal THEN
      RAISE EXCEPTION 'SP cannot change job address';
    END IF;
    IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
       OR NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time THEN
      RAISE EXCEPTION 'SP cannot change schedule';
    END IF;
    IF NEW.service_category IS DISTINCT FROM OLD.service_category THEN
      RAISE EXCEPTION 'SP cannot change service category';
    END IF;
    
    -- Enforce valid status transitions for SP
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status IN ('Assigned', 'Accepted') AND NEW.status = 'InProgress') OR
        (OLD.status IN ('Assigned', 'Accepted', 'InProgress') AND NEW.status = 'Completed')
      ) THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;
  
  -- Auto-set timestamps regardless of who updates
  IF NEW.status = 'InProgress' AND OLD.status != 'InProgress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    NEW.completed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_enforce_sp_job_update ON public.jobs;

CREATE TRIGGER trg_enforce_sp_job_update
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sp_job_update();
