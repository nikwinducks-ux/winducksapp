
-- 1) job_scheduled_visits table
CREATE TABLE public.job_scheduled_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  sp_id uuid NOT NULL,
  visit_date date NOT NULL,
  start_time text NOT NULL DEFAULT '09:00',
  duration_min integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'Scheduled',
  note text NOT NULL DEFAULT '',
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_scheduled_visits_job ON public.job_scheduled_visits(job_id);
CREATE INDEX idx_job_scheduled_visits_sp_date ON public.job_scheduled_visits(sp_id, visit_date);

ALTER TABLE public.job_scheduled_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.job_scheduled_visits
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select own scheduled visits" ON public.job_scheduled_visits
  FOR SELECT TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

CREATE POLICY "SP insert own scheduled visits" ON public.job_scheduled_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    sp_id = get_user_sp_id(auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_sp_id = get_user_sp_id(auth.uid()))
      OR sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
    )
  );

CREATE POLICY "SP update own scheduled visits" ON public.job_scheduled_visits
  FOR UPDATE TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()))
  WITH CHECK (sp_id = get_user_sp_id(auth.uid()));

CREATE POLICY "SP delete own scheduled visits" ON public.job_scheduled_visits
  FOR DELETE TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

CREATE TRIGGER trg_job_scheduled_visits_updated_at
  BEFORE UPDATE ON public.job_scheduled_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Allow SP to re-open a Completed job
CREATE OR REPLACE FUNCTION public.enforce_sp_job_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_privileged boolean;
  _sp_id uuid;
  _is_member boolean;
  _protected_fields_unchanged boolean;
  _allow_internal_assignment_sync boolean;
BEGIN
  _is_privileged := is_admin_or_owner(auth.uid());

  IF NOT _is_privileged THEN
    _sp_id := get_user_sp_id(auth.uid());
    _is_member := (OLD.assigned_sp_id = _sp_id) OR (NEW.assigned_sp_id = _sp_id) OR sp_on_job_crew(_sp_id, NEW.id);
    _protected_fields_unchanged :=
      NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id
      AND NEW.payout IS NOT DISTINCT FROM OLD.payout
      AND NEW.job_address_street IS NOT DISTINCT FROM OLD.job_address_street
      AND NEW.job_address_city IS NOT DISTINCT FROM OLD.job_address_city
      AND NEW.job_address_region IS NOT DISTINCT FROM OLD.job_address_region
      AND NEW.job_address_postal IS NOT DISTINCT FROM OLD.job_address_postal
      AND NEW.scheduled_date IS NOT DISTINCT FROM OLD.scheduled_date
      AND NEW.scheduled_time IS NOT DISTINCT FROM OLD.scheduled_time
      AND NEW.service_category IS NOT DISTINCT FROM OLD.service_category
      AND NEW.notes IS NOT DISTINCT FROM OLD.notes
      AND NEW.urgency IS NOT DISTINCT FROM OLD.urgency
      AND NEW.is_broadcast IS NOT DISTINCT FROM OLD.is_broadcast
      AND NEW.broadcast_radius_km IS NOT DISTINCT FROM OLD.broadcast_radius_km
      AND NEW.broadcast_note IS NOT DISTINCT FROM OLD.broadcast_note
      AND NEW.started_at IS NOT DISTINCT FROM OLD.started_at
      AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at;

    _allow_internal_assignment_sync :=
      _protected_fields_unchanged
      AND (
        (
          NEW.assigned_sp_id IS DISTINCT FROM OLD.assigned_sp_id
          AND (
            (OLD.status = 'Created' AND NEW.status = 'Assigned')
            OR (OLD.status = 'Offered' AND NEW.status = 'Assigned')
            OR (OLD.status = 'Offered' AND NEW.status = 'Offered')
            OR (OLD.status = 'Accepted' AND NEW.status = 'Accepted')
            OR (OLD.status = 'Assigned' AND NEW.status = 'Assigned')
          )
        )
        OR (
          NEW.assigned_sp_id IS NOT NULL
          AND NEW.assigned_sp_id IS NOT DISTINCT FROM OLD.assigned_sp_id
          AND OLD.status = 'Offered'
          AND NEW.status = 'Assigned'
        )
      );

    IF NOT _is_member AND NOT _allow_internal_assignment_sync THEN
      RAISE EXCEPTION 'SP not authorized to update this job';
    END IF;

    IF NEW.assigned_sp_id IS DISTINCT FROM OLD.assigned_sp_id AND NOT _allow_internal_assignment_sync THEN
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

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT _allow_internal_assignment_sync THEN
      IF NOT (
        (OLD.status IN ('Assigned', 'Accepted') AND NEW.status = 'InProgress') OR
        (OLD.status IN ('Assigned', 'Accepted', 'InProgress') AND NEW.status = 'Completed') OR
        (OLD.status = 'Completed' AND NEW.status = 'Assigned')
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
  -- Clear completed_at when re-opening from Completed
  IF OLD.status = 'Completed' AND NEW.status <> 'Completed' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;
