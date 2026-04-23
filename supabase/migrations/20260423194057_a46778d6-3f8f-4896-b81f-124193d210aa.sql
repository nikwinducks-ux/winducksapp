-- 1. Create the job_crew_members table
CREATE TABLE public.job_crew_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sp_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  added_by_user_id uuid NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, sp_id)
);

CREATE INDEX idx_job_crew_members_job_id ON public.job_crew_members(job_id);
CREATE INDEX idx_job_crew_members_sp_id ON public.job_crew_members(sp_id);

ALTER TABLE public.job_crew_members ENABLE ROW LEVEL SECURITY;

-- 2. RLS for job_crew_members
CREATE POLICY "Admin full access"
  ON public.job_crew_members
  FOR ALL
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select own crew rows"
  ON public.job_crew_members
  FOR SELECT
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

-- 3. SECURITY DEFINER helper to check crew membership without RLS recursion
CREATE OR REPLACE FUNCTION public.sp_on_job_crew(_sp_id uuid, _job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.job_crew_members
     WHERE job_id = _job_id
       AND sp_id  = _sp_id
  )
$$;

-- 4. Trigger function: keep jobs.assigned_sp_id mirrored to current lead/first member,
--    and flip job status when crew becomes empty or non-empty.
CREATE OR REPLACE FUNCTION public.sync_job_lead_on_crew_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job_id uuid;
  _new_lead uuid;
  _job RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _job_id := OLD.job_id;
  ELSE
    _job_id := NEW.job_id;
  END IF;

  -- Pick lead = is_lead row, else first added
  SELECT sp_id INTO _new_lead
    FROM public.job_crew_members
   WHERE job_id = _job_id
   ORDER BY is_lead DESC, added_at ASC
   LIMIT 1;

  SELECT * INTO _job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF _new_lead IS NULL THEN
    -- Crew is empty: clear assignment and revert non-terminal job to Created
    IF _job.assigned_sp_id IS NOT NULL OR _job.status IN ('Assigned', 'Accepted') THEN
      UPDATE public.jobs
         SET assigned_sp_id = NULL,
             status = CASE
               WHEN status IN ('Assigned', 'Accepted') THEN 'Created'
               ELSE status
             END
       WHERE id = _job_id;
    END IF;
  ELSE
    -- Crew has members: ensure assigned_sp_id matches lead, and flip Created -> Assigned
    IF _job.assigned_sp_id IS DISTINCT FROM _new_lead OR _job.status = 'Created' THEN
      UPDATE public.jobs
         SET assigned_sp_id = _new_lead,
             status = CASE
               WHEN status = 'Created' THEN 'Assigned'
               ELSE status
             END
       WHERE id = _job_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_job_lead_on_crew_change
AFTER INSERT OR DELETE OR UPDATE OF is_lead ON public.job_crew_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_lead_on_crew_change();

-- 5. Update SP-facing RLS on related tables to include crew membership

-- jobs: SELECT
DROP POLICY IF EXISTS "SP select assigned jobs" ON public.jobs;
CREATE POLICY "SP select assigned jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    assigned_sp_id = get_user_sp_id(auth.uid())
    OR sp_on_job_crew(get_user_sp_id(auth.uid()), id)
  );

-- jobs: UPDATE (status changes by SP)
DROP POLICY IF EXISTS "SP update assigned job status" ON public.jobs;
CREATE POLICY "SP update assigned job status"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    assigned_sp_id = get_user_sp_id(auth.uid())
    OR sp_on_job_crew(get_user_sp_id(auth.uid()), id)
  )
  WITH CHECK (
    assigned_sp_id = get_user_sp_id(auth.uid())
    OR sp_on_job_crew(get_user_sp_id(auth.uid()), id)
  );

-- job_services: SELECT
DROP POLICY IF EXISTS "SP select services of assigned jobs" ON public.job_services;
CREATE POLICY "SP select services of assigned jobs"
  ON public.job_services
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.jobs
       WHERE assigned_sp_id = get_user_sp_id(auth.uid())
    )
    OR sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
  );

-- job_photos: SELECT
DROP POLICY IF EXISTS "SP select photos of assigned jobs" ON public.job_photos;
CREATE POLICY "SP select photos of assigned jobs"
  ON public.job_photos
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.jobs
       WHERE assigned_sp_id = get_user_sp_id(auth.uid())
    )
    OR sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
  );

-- job_status_events: SELECT
DROP POLICY IF EXISTS "SP select own status events" ON public.job_status_events;
CREATE POLICY "SP select own status events"
  ON public.job_status_events
  FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
       WHERE assigned_sp_id = get_user_sp_id(auth.uid())
    )
    OR sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
  );

-- customers: SELECT for SPs whose jobs reference them
DROP POLICY IF EXISTS "SP select customers of assigned jobs" ON public.customers;
CREATE POLICY "SP select customers of assigned jobs"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT customer_id FROM public.jobs
       WHERE customer_id IS NOT NULL
         AND (
           assigned_sp_id = get_user_sp_id(auth.uid())
           OR sp_on_job_crew(get_user_sp_id(auth.uid()), id)
         )
    )
  );

-- 6. Update enforce_sp_job_update to allow crew members to act
CREATE OR REPLACE FUNCTION public.enforce_sp_job_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_privileged boolean;
  _sp_id uuid;
  _is_member boolean;
BEGIN
  _is_privileged := is_admin_or_owner(auth.uid());

  IF NOT _is_privileged THEN
    _sp_id := get_user_sp_id(auth.uid());
    _is_member := (NEW.assigned_sp_id = _sp_id) OR sp_on_job_crew(_sp_id, NEW.id);

    IF NOT _is_member THEN
      RAISE EXCEPTION 'SP not authorized to update this job';
    END IF;

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

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status IN ('Assigned', 'Accepted') AND NEW.status = 'InProgress') OR
        (OLD.status IN ('Assigned', 'Accepted', 'InProgress') AND NEW.status = 'Completed')
      ) THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'InProgress' AND OLD.status != 'InProgress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Backfill existing single-SP jobs into a one-member crew
INSERT INTO public.job_crew_members (job_id, sp_id, is_lead)
SELECT id, assigned_sp_id, true
  FROM public.jobs
 WHERE assigned_sp_id IS NOT NULL
ON CONFLICT (job_id, sp_id) DO NOTHING;
