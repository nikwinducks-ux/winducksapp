-- Extend the visit-start auto-progress trigger so jobs still in 'Offered'
-- also get promoted: Offered -> Assigned (assign caller) -> InProgress.
-- This prevents the "Invalid status transition from Offered to Completed"
-- error when an SP tracks visits on a job they never formally accepted.

CREATE OR REPLACE FUNCTION public.tg_job_visits_start_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _job RECORD;
BEGIN
  SELECT id, status, assigned_sp_id INTO _job
    FROM public.jobs WHERE id = NEW.job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Already-accepted path: just bump to InProgress
  IF _job.status IN ('Assigned', 'Accepted') THEN
    UPDATE public.jobs SET status = 'InProgress' WHERE id = NEW.job_id;
    INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_sp_id, note)
      VALUES (NEW.job_id, _job.status, 'InProgress', NEW.sp_id, 'Auto: visit started');
    RETURN NEW;
  END IF;

  -- Offered path: implicitly accept on behalf of the SP starting the visit,
  -- then move to InProgress. Also cancel any other pending offers on the job.
  IF _job.status = 'Offered' THEN
    UPDATE public.jobs
       SET assigned_sp_id = COALESCE(_job.assigned_sp_id, NEW.sp_id),
           status = 'InProgress'
     WHERE id = NEW.job_id;

    -- Make sure the SP is on the crew (lead if no one else)
    INSERT INTO public.job_crew_members (job_id, sp_id, is_lead)
      VALUES (NEW.job_id, NEW.sp_id, true)
      ON CONFLICT (job_id, sp_id) DO UPDATE SET is_lead = true;

    -- Cancel any still-pending offers for this job
    UPDATE public.offers
       SET status = 'Cancelled', responded_at = now()
     WHERE job_id = NEW.job_id AND status = 'Pending';

    -- Mark this SP's pending offer (if any) as Accepted
    UPDATE public.offers
       SET status = 'Accepted', responded_at = now(), acceptance_source = 'Auto'
     WHERE job_id = NEW.job_id AND sp_id = NEW.sp_id AND status = 'Cancelled'
       AND responded_at >= now() - interval '5 seconds';

    INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_sp_id, note)
      VALUES (NEW.job_id, 'Offered', 'InProgress', NEW.sp_id, 'Auto: visit started on offered job');
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also relax the SP status-transition guard to allow the Offered -> Completed
-- safety path (in case a visit isn't recorded but the SP marks the job done).
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
        (OLD.status IN ('Offered', 'Assigned', 'Accepted', 'InProgress') AND NEW.status = 'Completed') OR
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
  IF OLD.status = 'Completed' AND NEW.status <> 'Completed' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;